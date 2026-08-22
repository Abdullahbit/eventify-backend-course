// Centralised environment access.
//
// Every piece of configuration is read ONCE here through a Zod schema. App
// code must import `env` from this module and never read `process.env`
// directly — that keeps the set of required variables explicit and validated
// at startup.
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
