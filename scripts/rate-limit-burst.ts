/**
 * Rate-limit proof (homework task #3 acceptance).
 *
 * Hits POST /v1/auth/login in a tight burst from a single IP and shows that
 * the strict per-IP limiter (5 / 60s) returns 429 once the threshold is
 * exceeded. Then it waits out the window and confirms the limit resets.
 *
 * This is a SCRIPTED proof, not a claim — run it against a live server with
 * Redis up:
 *
 *   1. docker compose up -d            # postgres + redis
 *   2. npx prisma db seed
 *   3. npm run dev                     # terminal 1
 *   4. npm run worker                  # terminal 2 (not needed for this script)
 *   5. node scripts/rate-limit-burst.ts
 */
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const MAX = 5; // must match the login limiter in src/auth/routes.ts
const WINDOW_MS = 60_000;

// Any valid seeded email works; the password is ignored by the course login.
const EMAIL = process.env.PROOF_EMAIL ?? "organizer@eventify.dev";

async function loginOnce(): Promise<number> {
  const res = await fetch(`${BASE_URL}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: "ignored" }),
  });
  return res.status;
}

async function main() {
  console.log(`Bursting ${MAX + 3} login requests from one IP (limit = ${MAX}/60s)...\n`);

  const codes: number[] = [];
  for (let i = 1; i <= MAX + 3; i++) {
    const status = await loginOnce();
    codes.push(status);
    const marker = status === 429 ? "  <-- 429 RATE LIMITED" : "";
    console.log(`  request ${String(i).padStart(2)} -> ${status}${marker}`);
  }

  const okCount = codes.filter((c) => c === 200).length;
  const limitedCount = codes.filter((c) => c === 429).length;
  console.log(`\n  ${okCount} allowed, ${limitedCount} rate-limited (expected ${MAX} ok, rest 429)`);

  if (limitedCount === 0) {
    console.error("\nFAIL: no 429s — is Redis running and the limiter applied?");
    process.exit(1);
  }

  console.log(`\nWaiting out the ${WINDOW_MS / 1000}s window so the limit resets...`);
  await new Promise((r) => setTimeout(r, WINDOW_MS + 500));

  const after = await loginOnce();
  console.log(`  request after window -> ${after}`);
  if (after !== 200) {
    console.error(`\nFAIL: expected 200 after the window, got ${after}`);
    process.exit(1);
  }

  console.log("\nPASS: threshold enforced (429) and recovered after the window.");
}

main().catch((err) => {
  console.error("Burst script errored:", err);
  process.exit(1);
});
