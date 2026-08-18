import { prisma } from "../db.ts";
import { Prisma } from "../generated/prisma/client.ts";
import { HttpError } from "../http/HttpError.ts";
import * as bookingRepo from "./repository.ts";
import * as eventRepo from "../events/repository.ts";

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

  try {
    const booking = await prisma.$transaction(
      async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
        // 1. Capacity check — count only CONFIRMED bookings
        const confirmedCount = await bookingRepo.countConfirmed(eventId, tx);

        if (confirmedCount >= event.capacity) {
          throw new HttpError(409, "Event at capacity");
        }

        // 2. Look for an existing booking row (handles rebooking)
        const existing = await bookingRepo.findByUserEvent(userId, eventId, tx);

        if (existing) {
          if (existing.status === "CANCELLED") {
            // Flip back to CONFIRMED — same transaction, same capacity check
            return bookingRepo.reactivate(existing.id, tx);
          }

          if (existing.status === "CONFIRMED") {
            // Duplicate — let the unique constraint fire → P2002 → 409
            throw new HttpError(409, "This user already has a booking for this event");
          }

          // WAITLISTED — leave alone (Session 5's job)
          throw new HttpError(409, "Booking already exists (waitlisted)");
        }

        // 3. No existing row — create new CONFIRMED booking
        return bookingRepo.create(userId, eventId, tx);
      },
      {
        isolationLevel: "Serializable",
      },
    );

    return booking;
  } catch (error) {
    // Re-throw HttpError as-is
    if (error instanceof HttpError) {
      throw error;
    }

    // P2002 = unique constraint violation → 409
    const prismaError = error as Prisma.PrismaClientKnownRequestError;
    if (prismaError.code === "P2002") {
      throw new HttpError(409, "This user already has a booking for this event");
    }
    // P2034 = serialization failure → rethrow (stretch: retry loop)
    if (prismaError.code === "P2034") {
      throw error;
    }

    throw error;
  }
}

export async function getBookingById(id: string) {
  const booking = await bookingRepo.getById(id);

  if (!booking) {
    throw new HttpError(404, "Booking not found");
  }

  return booking;
}

export async function cancelBooking(id: string) {
  const booking = await getBookingById(id);

  if (booking.status === "CANCELLED") {
    throw new HttpError(409, "Booking is already cancelled");
  }

  return bookingRepo.cancel(id);
}
