import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import request from "supertest";
import { app } from "../app.ts";
import { prisma } from "../db.ts";

// These are integration tests: they hit the real Express app against a live
// Postgres (migrated + seeded). Run with:
//   docker compose up -d && npx prisma migrate dev && npx prisma db seed
//   npm test
//
// A second organizer is upserted here so we can exercise the BOLA (object-level
// authorization) path between two organizers.

const ORGANIZER_EMAIL = "organizer@eventify.dev";
const ATTENDEE_EMAIL = "attendee@eventify.dev";
const SECOND_ORGANIZER_EMAIL = "organizer2@eventify.dev";

const EVENT_BODY = {
  title: "BOLA test event",
  description: "Created by the auth integration test",
  venue: "Test Venue",
  startsAt: "2026-09-15T18:00:00Z",
  capacity: 50,
  priceCents: 1000,
};

function decodeSub(accessToken: string): string {
  const payload = jwt.decode(accessToken) as { sub?: string } | null;
  assert.ok(payload?.sub, "access token should carry a sub claim");
  return payload!.sub!;
}

async function login(email: string): Promise<{ accessToken: string; cookie: string }> {
  const res = await request(app)
    .post("/v1/auth/login")
    .send({ email, password: "does-not-matter" })
    .expect(200);

  const setCookie = res.headers["set-cookie"] as unknown as string[] | undefined;
  const refreshCookie = (setCookie ?? []).find((c) => c.startsWith("refreshToken="));
  assert.ok(refreshCookie, "login should set a refreshToken cookie");

  // Return the FULL Set-Cookie string (including the HttpOnly/Secure/SameSite/
  // Path flags) so callers can assert on those attributes. When sent back via
  // the `Cookie` request header the server's parser extracts just the value.
  return { accessToken: res.body.accessToken, cookie: refreshCookie! };
}

before(async () => {
  await prisma.user.upsert({
    where: { email: SECOND_ORGANIZER_EMAIL },
    update: {},
    create: { name: "Orga Nizer Two", email: SECOND_ORGANIZER_EMAIL, role: "ORGANIZER" },
  });
});

after(async () => {
  await prisma.$disconnect();
});

describe("Session 4 — auth, authorization, BOLA, refresh rotation", () => {
  it("GET /v1/events stays public", async () => {
    await request(app).get("/v1/events").expect(200);
  });

  it("POST /v1/events without a token returns 401", async () => {
    await request(app).post("/v1/events").send({ ...EVENT_BODY, organizerId: "x" }).expect(401);
  });

  it("POST /v1/events as ATTENDEE returns 403 (role gate)", async () => {
    const { accessToken } = await login(ATTENDEE_EMAIL);
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: ATTENDEE_EMAIL } });

    await request(app)
      .post("/v1/events")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ ...EVENT_BODY, organizerId: owner.id })
      .expect(403);
  });

  it("BOLA: a different organizer cannot PATCH another organizer's event (403)", async () => {
    const owner = await login(ORGANIZER_EMAIL);
    const ownerId = decodeSub(owner.accessToken);

    const created = await request(app)
      .post("/v1/events")
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ ...EVENT_BODY, organizerId: ownerId })
      .expect(201);
    const eventId = created.body.id;

    const attacker = await login(SECOND_ORGANIZER_EMAIL);
    await request(app)
      .patch(`/v1/events/${eventId}`)
      .set("Authorization", `Bearer ${attacker.accessToken}`)
      .send({ title: "hacked" })
      .expect(403);

    // The owner themselves can modify it.
    await request(app)
      .patch(`/v1/events/${eventId}`)
      .set("Authorization", `Bearer ${owner.accessToken}`)
      .send({ title: "legit update" })
      .expect(200);
  });

  it("login issues an access token and a refresh cookie", async () => {
    const { accessToken, cookie } = await login(ORGANIZER_EMAIL);
    assert.ok(accessToken);
    assert.match(cookie, /^refreshToken=/);
    // Cookie must be httpOnly + Secure + SameSite=strict + scoped to the refresh path.
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /SameSite=Strict/i);
    assert.match(cookie, /Path=\/v1\/auth\/refresh/i);
  });

  it("refresh rotates the token and returns a new access token", async () => {
    const { accessToken, cookie } = await login(ORGANIZER_EMAIL);
    assert.ok(accessToken);

    const refreshRes = await request(app)
      .post("/v1/auth/refresh")
      .set("Cookie", cookie)
      .expect(200);

    assert.ok(refreshRes.body.accessToken);
    assert.notEqual(refreshRes.body.accessToken, accessToken);

    // The new access token is usable.
    const me = decodeSub(refreshRes.body.accessToken);
    assert.equal(me, decodeSub(accessToken));
  });

  it("reuse of a rotated refresh token is rejected (401)", async () => {
    const { cookie } = await login(ORGANIZER_EMAIL);

    // First refresh rotates + revokes the presented token.
    await request(app).post("/v1/auth/refresh").set("Cookie", cookie).expect(200);

    // Replaying the SAME (now-revoked) cookie must fail.
    await request(app).post("/v1/auth/refresh").set("Cookie", cookie).expect(401);
  });
});
