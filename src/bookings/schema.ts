import { z } from "zod";

export const createBookingSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  eventId: z.string().min(1, "eventId is required"),
}).strict();
