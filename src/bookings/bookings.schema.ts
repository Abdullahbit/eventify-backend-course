import { z } from 'zod';

export const createBookingSchema = z.strictObject({
  eventId: z.string().min(1, 'eventId is required'),
});
