// scripts/waitlist-demo.ts — Option A (waitlist promotion) end-to-end demo.
//
// Runs against Postgres only (no Redis / no running worker required): it calls
// the booking service and the shared `promoteWaitlisted()` directly. In
// production, `cancelBooking()` enqueues a `waitlist-promote` job that the
// Worker (src/worker.ts) consumes by calling the very same `promoteWaitlisted`.
//
// Usage:  npm run worker   # (in one terminal, to process real jobs)
//         npx tsx scripts/waitlist-demo.ts
//
// (This script exercises the logic directly, so it works without the worker.)
import { prisma } from "../src/db.ts";
import * as bookingService from "../src/bookings/service.ts";
import { promoteWaitlisted } from "../src/jobs/promote.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error("ASSERT FAILED:", msg);
    process.exit(1);
  }
  console.log("  ✓", msg);
}

async function main() {
  const runSuffix = Math.random().toString(36).slice(2, 10);

  // 1. Seed an organizer + two attendees + one tiny event (capacity = 1).
  const organizer = await prisma.user.create({
    data: {
      email: `organizer-${runSuffix}@eventify.dev`,
      name: "Organizer",
      role: "ORGANIZER",
    },
  });
  const alice = await prisma.user.create({
    data: { email: `alice-${runSuffix}@eventify.dev`, name: "Alice", role: "ATTENDEE" },
  });
  const bob = await prisma.user.create({
    data: { email: `bob-${runSuffix}@eventify.dev`, name: "Bob", role: "ATTENDEE" },
  });

  const event = await prisma.event.create({
    data: {
      title: `Demo Event ${runSuffix}`,
      description: "Capacity 1 event for waitlist demo",
      startsAt: new Date(Date.now() + 86400000),
      capacity: 1,
      priceCents: 0,
      organizerId: organizer.id,
    },
  });

  console.log(`\n[setup] event ${event.id} (capacity ${event.capacity})`);

  // 2. Alice books first → CONFIRMED (takes the only seat).
  const a = await bookingService.createBooking(alice.id, event.id);
  assert(a.status === "CONFIRMED", "Alice is CONFIRMED (seat taken)");

  // 3. Bob books → event full → WAITLISTED.
  const b = await bookingService.createBooking(bob.id, event.id);
  assert(b.status === "WAITLISTED", "Bob is WAITLISTED (event full)");

  // 4. Alice cancels → frees the seat. In production this enqueues a
  //    waitlist-promote job; here we drive promotion directly.
  console.log("\n[cancel] Alice cancels her CONFIRMED booking");
  await bookingService.cancelBooking(a.id, { sub: alice.id, role: "ATTENDEE" });

  const promotedId = await promoteWaitlisted(event.id);
  assert(promotedId === b.id, "Bob (oldest waitlisted) is promoted to CONFIRMED");

  // 5. Idempotency: a second promotion pass must NOT double-promote.
  const secondPass = await promoteWaitlisted(event.id);
  assert(secondPass === null, "Second promotion pass is a no-op (no double-promote)");

  // 6. Verify final state.
  const bobFinal = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
  assert(bobFinal.status === "CONFIRMED", "Bob's booking is now CONFIRMED");

  console.log("\n[done] waitlist promotion verified ✅");
  console.log(
    "       (The confirmation email would be logged by the worker's",
    "booking-email job — see src/infra/mailer.ts console transport.)",
  );
}

main()
  .catch((err) => {
    console.error("DEMO ERROR:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
