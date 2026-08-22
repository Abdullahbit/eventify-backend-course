import { z } from 'zod';

export const createEventSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(200),
  description: z.string().trim().min(1, 'description is required'),
  venue: z.string().trim().min(1).optional().nullable(),
  startsAt: z.string().datetime({ local: false }),
  capacity: z.number().int().positive('capacity must be positive'),
  priceCents: z.number().int().min(0).optional().default(0),
  organizerId: z.string().min(1, 'organizerId is required'),
}).strict();

export const updateEventSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).optional(),
  venue: z.string().trim().min(1).optional().nullable(),
  startsAt: z.string().datetime({ local: false }).optional(),
  capacity: z.number().int().positive().optional(),
  priceCents: z.number().int().min(0).optional(),
  organizerId: z.string().min(1).optional(),
}).strict();

export const listEventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  venue: z.string().trim().min(1).optional(),
  from: z.string().datetime({ local: false }).optional(),
  to: z.string().datetime({ local: false }).optional(),
});
