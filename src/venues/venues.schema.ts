import { z } from 'zod';

export const createVenueSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  capacity: z.number().int().positive('Capacity must be a positive integer'),
  contactEmail: z.string().email('Invalid contact email'),
});

export const updateVenueSchema = createVenueSchema.partial();

export const listVenuesSchema = z.object({
  limit: z.coerce.number().int().positive('Limit must be a positive integer').optional(),
});
