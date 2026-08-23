import { env } from "./config.ts";
import { app } from "./app.ts";
import { connectCache } from "./infra/redis.ts";
import { startCacheMetrics } from "./events/events.service.ts";

const port = env.PORT;

// Connect the Redis cache/limiter client (fail-open if Redis is unreachable —
// see src/infra/redis.ts). Then start the periodic cache-metrics logger.
await connectCache();
startCacheMetrics(60_000);

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}/health`);
});
