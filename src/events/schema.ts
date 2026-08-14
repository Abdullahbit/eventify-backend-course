import { z } from "zod";

export const listEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  venue: z.string().trim().min(1).optional(),
  from: z.string().datetime({ local: false }).optional(),
  to: z.string().datetime({ local: false }).optional(),
});
