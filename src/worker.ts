// Worker entry point (its own process): `npm run worker`.
//
// Runs TWO BullMQ workers on the same SEPARATE queue connection:
//   1. `booking-email`    — sends the confirmation email (console transport).
//   2. `waitlist-promote` — Option A: promote the oldest WAITLISTED booking to
//                           CONFIRMED inside a capacity-re-checked transaction,
//                           then enqueue its confirmation email.
//
// This file must NEVER import the cache client (src/infra/redis.ts) — BullMQ
// owns the queue connection exclusively.
import { Worker } from "bullmq";
import { prisma } from "./db.ts";
import { queueConnection } from "./infra/queue-backend.ts";
import { sendConfirmation } from "./infra/mailer.ts";
import { promoteWaitlisted } from "./jobs/promote.ts";

interface ConfirmationJobData {
  bookingId: string;
}

interface WaitlistJobData {
  eventId: string;
}

async function loadBookingDetails(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error(`booking ${bookingId} not found`);
  const [user, event] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: booking.userId } }),
    prisma.event.findUniqueOrThrow({ where: { id: booking.eventId } }),
  ]);
  return { user, event };
}

// --- Worker 1: booking-email ---------------------------------------------
const emailWorker = new Worker<ConfirmationJobData>(
  "booking-email",
  async (job) => {
    const { bookingId } = job.data;
    const { user, event } = await loadBookingDetails(bookingId);
    await sendConfirmation({
      to: user.email,
      name: user.name,
      eventTitle: event.title,
    });
  },
  { connection: queueConnection },
);

emailWorker.on("failed", (job, err) =>
  console.error(`[worker:booking-email] job ${job?.id} failed:`, err.message),
);

// --- Worker 2: waitlist-promote (Option A) -------------------------------
const waitlistWorker = new Worker<WaitlistJobData>(
  "waitlist-promote",
  async (job) => {
    const { eventId } = job.data;
    // All the capacity-re-check + FIFO promotion + email-enqueue lives in
    // promoteWaitlisted() (shared with scripts/waitlist-demo.ts).
    await promoteWaitlisted(eventId);
  },
  { connection: queueConnection },
);

waitlistWorker.on("failed", (job, err) =>
  console.error(`[worker:waitlist-promote] job ${job?.id} failed:`, err.message),
);

// Graceful shutdown.
async function shutdown() {
  console.log("\n[worker] shutting down...");
  await Promise.all([emailWorker.close(), waitlistWorker.close()]);
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("[worker] started — booking-email + waitlist-promote workers running");
