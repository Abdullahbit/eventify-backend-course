/**
 * Concurrency proof: fires 20 simultaneous POST /v1/bookings for one event
 * as 20 distinct users. Prints a status-code tally and exits non-zero on
 * oversell (more than `capacity` 201s).
 *
 * Usage:
 *   1. Run `npx prisma db seed` and copy user ids + eventId into
 *      scripts/fixtures/parallel-users.json.
 *   2. Start the dev server: `npm run dev`
 *   3. Run: `node scripts/parallel-bookings.ts`
 */
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface Fixture {
  baseUrl: string;
  eventId: string;
  capacity: number;
  users: Array<{ userId: string; token: string }>;
}

async function main() {
  const fixturePath = resolve(__dirname, "fixtures", "parallel-users.json");
  const fixture: Fixture = JSON.parse(await readFile(fixturePath, "utf-8"));

  console.log(`Firing ${fixture.users.length} concurrent bookings for event ${fixture.eventId}`);
  console.log(`Capacity: ${fixture.capacity}`);

  const results = await Promise.allSettled(
    fixture.users.map(async (user) => {
      const res = await fetch(`${fixture.baseUrl}/v1/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.userId,
          ...(user.token ? { Authorization: `Bearer ${user.token}` } : {}),
        },
        body: JSON.stringify({ eventId: fixture.eventId }),
      });
      return { userId: user.userId, status: res.status };
    }),
  );

  // Tally status codes
  const tally: Record<number, number> = {};
  for (const result of results) {
    if (result.status === "fulfilled") {
      const code = result.value.status;
      tally[code] = (tally[code] ?? 0) + 1;
    } else {
      tally[0] = (tally[0] ?? 0) + 1; // network error
    }
  }

  console.log("\n--- Status code tally ---");
  for (const [code, count] of Object.entries(tally).sort(([a], [b]) => Number(a) - Number(b))) {
    console.log(`  ${code === "0" ? "ERR" : code}: ${count}`);
  }

  const successCount = tally[201] ?? 0;
  console.log(`\n201 count: ${successCount} (expected ≤ ${fixture.capacity})`);

  if (successCount > fixture.capacity) {
    console.error(`\n❌ OVERSELL: ${successCount} bookings succeeded but capacity is ${fixture.capacity}`);
    process.exit(1);
  }

  if (successCount === fixture.capacity) {
    console.log(`\n✅ No oversell. Exactly ${successCount} confirmed, rest rejected.`);
  } else {
    console.log(`\n⚠️  Only ${successCount} confirmed (expected ${fixture.capacity}). Check server logs.`);
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
