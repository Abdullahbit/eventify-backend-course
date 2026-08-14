import { z } from "zod";

export const createBookingSchema = z.object({
  eventId: z.string().min(1, "eventId is required"),
}).strict();
