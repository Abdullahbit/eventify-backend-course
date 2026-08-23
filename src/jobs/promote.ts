// Shared waitlist-promotion logic (Option A), reused by:
//   - the `waitlist-promote` Worker (src/worker.ts), and
//   - scripts/waitlist-demo.ts (which calls it directly for a dependency-free
//     demo that needs only Postgres, not a running worker).
//
// Promotion runs inside a Serializable transaction that RE-CHECKS capacity at
// promotion time. The worker fires this after a cancel frees a seat, but
// concurrent cancels/bookings mean we must verify "is there still a free seat?"
// here — if the freed seat was already taken by a competing promotion/booking,
// we simply no-op instead of over-promoting.
// Promoting the OLDEST waitlisted row (FIFO) and flipping it to CONFIRMED means
// a re-run can never double-promote: their row is no longer WAITLISTED, so the
// next run picks the next person (or no one). Idempotent by construction.
import { prisma } from "../db.ts";
import * as bookingRepo from "../bookings/repository.ts";
import * as eventRepo from "../events/repository.ts";
import { addConfirmation } from "./email.queue.ts";

/**
 * Promote the oldest WAITLISTED booking for an event to CONFIRMED, if a seat is
 * free after re-checking capacity. No-ops when the event is already at capacity
 * (no room) or nobody is waitlisted. Returns the promoted booking id, or null.
 */
export async function promoteWaitlisted(eventId: string): Promise<string | null> {
  let promotedId: string | null = null;

  await prisma.$transaction(
    async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      const event = await eventRepo.getById(eventId, tx);
      if (!event) {
        throw new Error(`event ${eventId} not found`);
      }

      const confirmedCount = await bookingRepo.countConfirmed(eventId, tx);
      // Only promote when there is actually a free seat (a CONFIRMED cancel
      // dropped confirmedCount below capacity). Promoting while full would
      // over-sell the event.
      if (confirmedCount < event.capacity) {
        const oldest = await bookingRepo.findOldestWaitlisted(eventId, tx);
        if (oldest) {
          await bookingRepo.reactivate(oldest.id, tx); // WAITLISTED -> CONFIRMED
          promotedId = oldest.id;
          // Fire the confirmation email for the promoted user.
          await addConfirmation(oldest.id);
        }
      }
    },
    { isolationLevel: "Serializable" },
  );

  return promotedId;
}
