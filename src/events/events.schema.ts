import { z } from 'zod';

export const listEventsQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1, 'Page must be >= 1').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be >= 1').max(100, 'Limit must be <= 100').default(20),
  venue: z.string().optional(),
  from: z.string().datetime({ message: 'from must be a valid ISO date' }).optional(),
  to: z.string().datetime({ message: 'to must be a valid ISO date' }).optional(),
});
