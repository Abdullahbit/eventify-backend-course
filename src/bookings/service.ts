import { prisma } from "../db.ts";
import { Prisma } from "../generated/prisma/client.ts";
import { HttpError } from "../http/HttpError.ts";
import type { Role } from "../domain.ts";
import * as bookingRepo from "./repository.ts";
import * as eventRepo from "../events/repository.ts";
import { addWaitlistPromotion } from "../jobs/waitlist.queue.ts";

// The authenticated principal performing a mutating action.
type Actor = { sub: string; role: Role };

/**
 * A serialization failure means Postgres aborted this transaction because
 * concurrent writers collided (SQLSTATE 40001 / "could not serialize
 * access"). The correct response is to RETRY the whole transaction.
 *
 * Prisma can surface this two ways:
 *  - its own code `P2034`, or
 *  - via the pg driver adapter as a `DriverAdapterError` whose `cause`
 *    carries `originalCode: "40001"` / `kind: "TransactionWriteConflict"`.
 * We match both so the retry loop actually fires.
 */
function isSerializationFailure(error: unknown): boolean {
  const e = error as {
    code?: string;
    cause?: { originalCode?: string; kind?: string };
  };
  if (e?.code === "P2034" || e?.code === "40001") return true;
  if (e?.cause?.originalCode === "40001") return true;
  if (e?.cause?.kind === "TransactionWriteConflict") return true;
  return false;
}

/**
 * Transactional booking creation.
 *
 * Runs inside prisma.$transaction with Serializable isolation.
 * - Checks capacity (CONFIRMED count only).
 * - Handles rebooking: flips CANCELLED → CONFIRMED.
 * - Maps P2002 (unique constraint) → 409.
 */
export async function createBooking(userId: string, eventId: string) {
  // Quick check: event must exist
  const event = await eventRepo.getById(eventId);
  if (!event) {
    throw new HttpError(404, "Unknown eventId");
  }

  // The whole race-safe flow runs inside a Serializable transaction.
  // Serializable can abort transactions with a serialization failure
  // (P2034) when many writers collide. The correct response is to RETRY
  // the whole transaction — so we wrap it in a bounded retry loop.
  const MAX_RETRIES = 8;
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
          // 1. Capacity check — count only CONFIRMED bookings
          const confirmedCount = await bookingRepo.countConfirmed(eventId, tx);

          // 2. Look for an existing booking row (handles rebooking)
          const existing = await bookingRepo.findByUserEvent(userId, eventId, tx);

          if (confirmedCount >= event.capacity) {
            // Event is FULL → Option A waitlist path. We never oversell: the
            // capacity check above is inside the Serializable transaction, and
            // we insert/flip a WAITLISTED row (not CONFIRMED), so the
            // confirmed count is untouched.
            if (existing) {
              if (existing.status === "WAITLISTED") {
                // Already on the waitlist — idempotent, return as-is.
                return existing;
              }
              if (existing.status === "CANCELLED") {
                // Same (user,event) row exists but is cancelled; flip it to the
                // waitlist (can't insert a second row — unique constraint).
                return bookingRepo.waitlist(existing.id, tx);
              }
              // CONFIRMED → genuine duplicate; let the unique constraint fire.
              throw new HttpError(409, "This user already has a booking for this event");
            }
            // No row yet → create a fresh WAITLISTED booking.
            return bookingRepo.createWaitlisted(userId, eventId, tx);
          }

          if (existing) {
            if (existing.status === "CANCELLED") {
              // Flip back to CONFIRMED — same transaction, same capacity check
              return bookingRepo.reactivate(existing.id, tx);
            }

            if (existing.status === "CONFIRMED") {
              // Duplicate — let the unique constraint fire → P2002 → 409
              throw new HttpError(409, "This user already has a booking for this event");
            }

            // WAITLISTED — leave alone; promotion is the worker's job.
            throw new HttpError(409, "Booking already exists (waitlisted)");
          }

          // 3. No existing row and not full — create new CONFIRMED booking
          return bookingRepo.create(userId, eventId, tx);
        },
        {
          isolationLevel: "Serializable",
        },
      );
    } catch (error) {
      // Business/validation errors must NOT be retried.
      if (error instanceof HttpError) {
        throw error;
      }

      const prismaError = error as Prisma.PrismaClientKnownRequestError;

      // P2002 = unique constraint violation → 409 (final, no retry)
      if (prismaError.code === "P2002") {
        throw new HttpError(409, "This user already has a booking for this event");
      }

      // Serialization failure (40001 / P2034) → retry the whole transaction.
      if (isSerializationFailure(error)) {
        lastError = error;
        continue;
      }

      // Any other unexpected error — don't retry.
      throw error;
    }
  }

  throw lastError ?? new HttpError(500, "Booking failed after retries");
}

export async function getBookingById(id: string) {
  const booking = await bookingRepo.getById(id);

  if (!booking) {
    throw new HttpError(404, "Booking not found");
  }

  return booking;
}

export async function cancelBooking(id: string, actor: Actor) {
  const booking = await getBookingById(id);

  // BOLA guard: only the booking owner (or an ADMIN) may cancel it.
  if (actor.role !== "ADMIN" && booking.userId !== actor.sub) {
    throw new HttpError(403, "You do not have permission to cancel this booking");
  }

  if (booking.status === "CANCELLED") {
    throw new HttpError(409, "Booking is already cancelled");
  }

  const cancelled = await bookingRepo.cancel(id);

  // Option A: freeing a CONFIRMED seat may let the oldest waitlisted user in.
  // Enqueue a promotion job; the worker re-checks capacity inside a
  // transaction and no-ops if the event is no longer full. We only promote
  // when a CONFIRMED booking was cancelled (not a WAITLISTED one).
  if (booking.status === "CONFIRMED") {
    await addWaitlistPromotion(booking.eventId).catch((err) => {
      // Enqueue failure must not fail the cancel — log and move on.
      console.error("[waitlist] failed to enqueue promotion:", (err as Error).message);
    });
  }

  return cancelled;
}
