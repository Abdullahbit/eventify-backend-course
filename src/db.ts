// Shared Prisma client singleton.
//
// - Uses the `@prisma/adapter-pg` driver adapter (required for Prisma 7 on
//   PostgreSQL with Node's native driver).
// - `log: ["query"]` is enabled so we can capture the real SQL for the
//   Task 4 EXPLAIN ANALYZE proof.
// - `Prisma` is re-exported so services can reference error codes
//   (P2002, P2034) and enums without a second import.
import { PrismaClient, Prisma } from "./generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "./config.ts";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: ["query"],
});

export { Prisma };

// Transaction client type — extracted from the $transaction callback parameter.
export type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
