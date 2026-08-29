// The `waitlist-promote` queue (Option A). When a CONFIRMED booking is
// cancelled, we enqueue a promotion job; the `waitlist-promote` Worker in
// src/worker.ts picks it up, re-checks capacity inside a transaction, and
// promotes the oldest WAITLISTED booking.
//
// Uses the same SEPARATE queue connection as the email queue.
import { Queue } from "bullmq";
import { queueConnection } from "../infra/queue-backend.ts";

export const WAITLIST_QUEUE_NAME = "waitlist-promote";

interface WaitlistJobData {
  eventId: string;
}

export const waitlistQueue = new Queue<WaitlistJobData>(WAITLIST_QUEUE_NAME, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

// Payload { eventId }.
export async function addWaitlistPromotion(eventId: string): Promise<void> {
  await waitlistQueue.add("promote", { eventId });
}
