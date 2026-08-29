import { z } from "zod";

// Session 4: identity comes from the JWT, so only the event being booked is
// supplied in the body. `userId` is no longer accepted/trusted from the body.
export const createBookingSchema = z
  .object({
    eventId: z.string().min(1, "eventId is required"),
  })
  .strict();
