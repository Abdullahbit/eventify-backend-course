// BullMQ v6 connection. BullMQ v6 drops the ioredis dependency in favour of
// node-redis v5, and exposes `createNodeRedisClient` to wrap a node-redis
// client for its use. This is a SECOND, independent Redis connection — never
// the cache client from ./redis.ts. BullMQ holds its connection for blocking
// stream commands; sharing the cache client would stall cache/limiter traffic.
//
// BullMQ manages connect/disconnect itself once this client is handed to a
// Queue/Worker, so we do not call .connect() here.
import { createClient } from "redis";
import { createNodeRedisClient } from "bullmq";
import { env } from "../config.ts";
import { sanitizeRedisUrl } from "./redis.ts";

const raw = createClient({
  url: sanitizeRedisUrl(env.REDIS_URL),
});

raw.on("error", (err) => {
  console.error("[redis-queue] connection error:", err.message);
});

export const queueConnection = createNodeRedisClient(raw);

export async function closeQueueConnection(): Promise<void> {
  try {
    raw.disconnect().catch(() => {});
    raw.destroy();
  } catch {
    // ignore
  }
}
