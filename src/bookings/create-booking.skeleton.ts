// ===========================================================================
// create-booking.skeleton.ts  (Session 3 — student fill-in, NOW COMPLETED)
// ---------------------------------------------------------------------------
// Shipped by the starter branch with three TODO(student) sections and a stubbed
// retry loop. The sections are filled in below, and the finished `createBooking`
// is folded into src/bookings/service.ts (which re-exports it) and called from
// the controller.
//
// Whole create path runs inside ONE serializable transaction so the capacity
// check and the insert can never be interleaved with another request in a way
// that oversells the event. The DB-enforced unique constraint on
// (userId, eventId) is the backstop that makes overselling impossible.
// ===========================================================================

import { prisma } from "../db.ts";
import { Prisma } from "../generated/prisma/client.ts";
import { HttpError } from "../http/HttpError.ts";
import * as bookingRepo from "./repository.ts";
import * as eventRepo from "../events/repository.ts";

const MAX_RETRIES = 3;

export async function createBooking(userId: string, eventId: string) {
  // Quick guard: the event must exist. The real capacity check happens inside
  // the transaction below.
  const event = await eventRepo.getById(eventId);
  if (!event) {
    throw new HttpError(404, "Unknown eventId");
  }

  let lastError: unknown;

  // STRETCH: retry loop for serialization failures (Prisma error P2034).
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          // TODO(student) #1 — capacity check (CONFIRMED only)
          const confirmedCount = await bookingRepo.countConfirmed(eventId, tx);

          if (confirmedCount >= event.capacity) {
            throw new HttpError(409, "Event at capacity");
          }

          // TODO(student) #2 — rebooking flip + create.
          // Re-use the one existing row per (user, event) instead of inserting
          // a second one (the unique constraint would reject that anyway).
          const existing = await bookingRepo.findByUserEvent(userId, eventId, tx);

          if (existing) {
            if (existing.status === "CANCELLED") {
              // cancelled -> flip the SAME row back to CONFIRMED
              return bookingRepo.reactivate(existing.id, tx);
            }

            if (existing.status === "CONFIRMED") {
              // TODO(student) #3 — duplicate. Let the unique constraint fire
              // (P2002); the outer catch maps it to 409.
              throw new HttpError(409, "This user already has a booking for this event");
            }

            // WAITLISTED — leave it alone; promotion is Session 5's job.
            throw new HttpError(409, "Booking already exists (waitlisted)");
          }

          // none -> create a fresh CONFIRMED booking
          return bookingRepo.create(userId, eventId, tx);
        },
        // Serializable: the strictest isolation. Combined with the unique
        // constraint this prevents oversell even under 20 concurrent requests.
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      // Narrow to the Prisma error type so we can read `.code`.
      const prismaError = error as Prisma.PrismaClientKnownRequestError;

      // STRETCH: retry only on serialization failures, up to MAX_RETRIES.
      if (prismaError.code === "P2034" && attempt < MAX_RETRIES) {
        lastError = error;
        continue;
      }

      // TODO(student) — P2002 -> 409 mapping.
      if (prismaError.code === "P2002") {
        throw new HttpError(409, "This user already has a booking for this event");
      }

      // Any other error (including our own HttpErrors) propagates as-is.
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new HttpError(500, "Booking failed after retries");
}
