// Prisma 7 configuration.
//
// IMPORTANT: Prisma 7 does NOT auto-load `.env`. We load it explicitly here
// (and again in prisma/seed.ts and src/db.ts) so DATABASE_URL is available to
// the CLI before it touches the database.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
