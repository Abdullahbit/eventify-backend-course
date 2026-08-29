import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app } from "../app.ts";
import { prisma } from "../db.ts";

const ORGANIZER_EMAIL = "organizer-capstone@eventify.dev";
const ATTENDEE_1_EMAIL = "attendee1-capstone@eventify.dev";
const ATTENDEE_2_EMAIL = "attendee2-capstone@eventify.dev";

async function login(email: string): Promise<{ accessToken: string; cookie: string }> {
  const res = await request(app)
    .post("/v1/auth/login")
    .send({ email, password: "does-not-matter" })
    .expect(200);

  const setCookie = res.headers["set-cookie"] as unknown as string[] | undefined;
  const refreshCookie = (setCookie ?? []).find((c) => c.startsWith("refreshToken="));
  assert.ok(refreshCookie, "login should set a refreshToken cookie");

  return { accessToken: res.body.accessToken, cookie: refreshCookie! };
}

describe("Capstone v1.0 — Integration Test Suite", () => {
  let organizerId: string;

  before(async () => {
    // Seed users for capstone integration testing
    const org = await prisma.user.upsert({
      where: { email: ORGANIZER_EMAIL },
      update: {},
      create: { name: "Organizer Capstone", email: ORGANIZER_EMAIL, role: "ORGANIZER" },
    });
    organizerId = org.id;

    await prisma.user.upsert({
      where: { email: ATTENDEE_1_EMAIL },
      update: {},
      create: { name: "Attendee One", email: ATTENDEE_1_EMAIL, role: "ATTENDEE" },
    });

    await prisma.user.upsert({
      where: { email: ATTENDEE_2_EMAIL },
      update: {},
      create: { name: "Attendee Two", email: ATTENDEE_2_EMAIL, role: "ATTENDEE" },
    });
  });

  after(async () => {
    await prisma.$disconnect();
  });

  // 1. Register/login, refresh rotation & reuse theft tripwire
  describe("1. Auth & Refresh Token Rotation", () => {
    it("logs in, rotates token, and rejects reuse with 401", async () => {
      const initial = await login(ORGANIZER_EMAIL);
      assert.ok(initial.accessToken, "access token should be returned");
      assert.match(initial.cookie, /HttpOnly/i);

      // Rotate token
      const refreshRes = await request(app)
        .post("/v1/auth/refresh")
        .set("Cookie", initial.cookie)
        .expect(200);

      assert.ok(refreshRes.body.accessToken);
      assert.notEqual(refreshRes.body.accessToken, initial.accessToken);

      // Replay attack with spent token must be rejected (theft detection)
      await request(app)
        .post("/v1/auth/refresh")
        .set("Cookie", initial.cookie)
        .expect(401);
    });
  });

  // 2. Role-gated event creation (ORGANIZER yes, ATTENDEE 403)
  describe("2. Role-Gated Event Creation", () => {
    it("allows ORGANIZER to create event and rejects ATTENDEE with 403", async () => {
      const attendee = await login(ATTENDEE_1_EMAIL);
      const organizer = await login(ORGANIZER_EMAIL);

      const eventPayload = {
        title: "Capstone Role Gate Test",
        description: "Testing role permissions",
        venue: "Main Hall",
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        capacity: 10,
        priceCents: 2500,
        organizerId,
      };

      // Attendee attempt -> 403 Forbidden
      await request(app)
        .post("/v1/events")
        .set("Authorization", `Bearer ${attendee.accessToken}`)
        .send(eventPayload)
        .expect(403);

      // Organizer attempt -> 201 Created
      const res = await request(app)
        .post("/v1/events")
        .set("Authorization", `Bearer ${organizer.accessToken}`)
        .send(eventPayload)
        .expect(201);

      assert.equal(res.body.title, eventPayload.title);
      assert.equal(res.body.organizerId, organizerId);
    });
  });

  // 3. Booking a full event (yields WAITLISTED)
  describe("3. Full Event Waitlist Behavior", () => {
    it("returns WAITLISTED booking when booking an event at capacity", async () => {
      const organizer = await login(ORGANIZER_EMAIL);
      const att1 = await login(ATTENDEE_1_EMAIL);
      const att2 = await login(ATTENDEE_2_EMAIL);

      // Create event with capacity = 1
      const eventRes = await request(app)
        .post("/v1/events")
        .set("Authorization", `Bearer ${organizer.accessToken}`)
        .send({
          title: "Waitlist Test Event",
          description: "Capacity 1 for testing waitlist",
          venue: "Small Room",
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          capacity: 1,
          priceCents: 0,
          organizerId,
        })
        .expect(201);

      const eventId = eventRes.body.id;

      // First booking -> CONFIRMED
      const booking1Res = await request(app)
        .post("/v1/bookings")
        .set("Authorization", `Bearer ${att1.accessToken}`)
        .send({ eventId })
        .expect(201);

      assert.equal(booking1Res.body.status, "CONFIRMED");

      // Second booking on full event -> WAITLISTED
      const booking2Res = await request(app)
        .post("/v1/bookings")
        .set("Authorization", `Bearer ${att2.accessToken}`)
        .send({ eventId })
        .expect(201);

      assert.equal(booking2Res.body.status, "WAITLISTED");
    });
  });

  // 4. Cancel-then-rebook soft-cancel semantics
  describe("4. Cancel-Then-Rebook Soft-Cancel Semantics", () => {
    it("cancelling a confirmed booking and rebooking reactivates to CONFIRMED without 409", async () => {
      const organizer = await login(ORGANIZER_EMAIL);
      const att1 = await login(ATTENDEE_1_EMAIL);

      // Create event with capacity = 5
      const eventRes = await request(app)
        .post("/v1/events")
        .set("Authorization", `Bearer ${organizer.accessToken}`)
        .send({
          title: "Soft Cancel Reactivation Test",
          description: "Testing cancel and rebook",
          venue: "Room B",
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          capacity: 5,
          priceCents: 1500,
          organizerId,
        })
        .expect(201);

      const eventId = eventRes.body.id;

      // 1. Initial booking -> CONFIRMED
      const initialBooking = await request(app)
        .post("/v1/bookings")
        .set("Authorization", `Bearer ${att1.accessToken}`)
        .send({ eventId })
        .expect(201);

      assert.equal(initialBooking.body.status, "CONFIRMED");
      const bookingId = initialBooking.body.id;

      // 2. Cancel booking -> CANCELLED
      const cancelRes = await request(app)
        .delete(`/v1/bookings/${bookingId}`)
        .set("Authorization", `Bearer ${att1.accessToken}`)
        .expect(200);

      assert.equal(cancelRes.body.status, "CANCELLED");

      // 3. Re-book the same event -> must reactivate same booking to CONFIRMED (no 409)
      const rebookRes = await request(app)
        .post("/v1/bookings")
        .set("Authorization", `Bearer ${att1.accessToken}`)
        .send({ eventId })
        .expect(201);

      assert.equal(rebookRes.body.id, bookingId, "should reuse the same booking row");
      assert.equal(rebookRes.body.status, "CONFIRMED", "should flip status back to CONFIRMED");
    });
  });

  // 5. Cache invalidation on write (Session 5)
  describe("5. Cache-Aside & Invalidation", () => {
    it("GET /v1/events/:id serves fresh state after PATCH invalidates cache", async () => {
      const organizer = await login(ORGANIZER_EMAIL);

      // Create event
      const created = await request(app)
        .post("/v1/events")
        .set("Authorization", `Bearer ${organizer.accessToken}`)
        .send({
          title: "Initial Cache Title",
          description: "Cache invalidation test",
          venue: "Auditorium",
          startsAt: new Date(Date.now() + 86400000).toISOString(),
          capacity: 100,
          priceCents: 5000,
          organizerId,
        })
        .expect(201);

      const eventId = created.body.id;

      // 1. Initial GET (populates cache)
      const getRes1 = await request(app).get(`/v1/events/${eventId}`).expect(200);
      assert.equal(getRes1.body.title, "Initial Cache Title");

      // 2. PATCH event (invalidates cache key + bumps list version)
      await request(app)
        .patch(`/v1/events/${eventId}`)
        .set("Authorization", `Bearer ${organizer.accessToken}`)
        .send({ title: "Updated Cache Title" })
        .expect(200);

      // 3. Subsequent GET -> must return updated title
      const getRes2 = await request(app).get(`/v1/events/${eventId}`).expect(200);
      assert.equal(getRes2.body.title, "Updated Cache Title");
    });
  });
});
