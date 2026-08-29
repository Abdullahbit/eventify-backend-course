import { z } from "zod";

// Login accepts an identity (email) + a password. The course schema has no
// password column yet, so the service authenticates by verified email (see
// service.ts). Both fields are still required + validated so malformed bodies
// fail fast with a 400 before any auth logic runs.
export const loginSchema = z
  .object({
    email: z.string().email("Invalid email"),
    password: z.string().min(1, "Password is required"),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
