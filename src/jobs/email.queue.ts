// The `booking-email` queue. Jobs enqueued here are consumed by the
// `booking-email` Worker in src/worker.ts.
//
// Default job options (homework contract: retry / backoff / dead-letter):
//   - attempts: 3            -> retry transient mailer/DB failures
//   - backoff: exponential   -> back off between retries
//   - removeOnComplete        -> keep a small history, then drop
//   - removeOnFail            -> failed jobs remain inspectable (BullMQ's
//                               equivalent of a dead-letter: they sit in the
//                               `failed` set with their stack instead of being
//                               silently dropped)
//
// Uses the SEPARATE queue connection from src/infra/queue-backend.ts — never
// the cache client.
import { Queue } from "bullmq";
import { queueConnection } from "../infra/queue-backend.ts";

export const EMAIL_QUEUE_NAME = "booking-email";

interface ConfirmationJobData {
  bookingId: string;
}

export const emailQueue = new Queue<ConfirmationJobData>(EMAIL_QUEUE_NAME, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

// Job name `confirmation`, payload { bookingId }.
export async function addConfirmation(bookingId: string): Promise<void> {
  await emailQueue.add("confirmation", { bookingId });
}
