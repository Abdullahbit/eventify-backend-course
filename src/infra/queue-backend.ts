// BullMQ v6 connection. BullMQ v6 drops the ioredis dependency in favour of
// node-redis v5, and exposes `createNodeRedisClient` to wrap a node-redis
// client for its use. This is a SECOND, independent Redis connection — never
// the cache client from ./redis.ts. BullMQ holds its connection for blocking
// stream commands; sharing the cache client would stall cache/limiter traffic.
//
// BullMQ manages connect/disconnect itself once this client is handed to a
// Queue/Worker, so we do not call .connect() here.
import { createNodeRedisClient } from "bullmq";
import { env } from "../config.ts";

export const queueConnection = createNodeRedisClient({
  url: env.REDIS_URL,
});
