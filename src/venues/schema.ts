import { z } from "zod";

export const createVenueSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(100, "name is too long"),
  address: z.string().trim().min(1, "address is required").max(255, "address is too long"),
  capacity: z.number().int("capacity must be an integer").positive("capacity must be positive"),
  contactEmail: z.email("contactEmail must be a valid email"),
});

export const updateVenueSchema = createVenueSchema.partial().strict();

export const listVenueQuerySchema = z.object({
  limit: z.coerce
    .number({ message: "limit must be a number" })
    .int("limit must be an integer")
    .positive("limit must be positive")
    .max(100, "limit must be <= 100")
    .optional(),
});
