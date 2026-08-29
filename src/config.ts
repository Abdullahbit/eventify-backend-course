// Centralised environment access.
//
// Every piece of configuration is read ONCE here through a Zod schema. App
// code must import `env` from this module and never read `process.env`
// directly — that keeps the set of required variables explicit and validated
// at startup.
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Session 4 auth secrets / config. Read ONLY through this module — never
  // touch `process.env` directly in app code.
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  WEB_ORIGIN: z.string().min(1, "WEB_ORIGIN is required").default("http://localhost:3000"),

  // Session 5 infra. Redis backs the cache, rate limiter, and BullMQ queue.
  // A localhost default keeps local dev / tests working without an .env entry.
  REDIS_URL: z.string().min(1, "REDIS_URL is required").default("redis://localhost:6379"),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);

// `config` is the canonical accessor used by auth code
// (config.JWT_ACCESS_SECRET, config.WEB_ORIGIN). It is the same parsed object
// as `env` so existing imports keep working.
export const config = env;
