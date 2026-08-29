import { Router } from "express";
import { validate } from "../middleware/validate.ts";
import { rateLimit } from "../infra/rate-limit.ts";
import { requireAuth } from "../auth/middleware.ts";
import { cancelBooking, createBooking, getBooking } from "./controller.ts";
import { createBookingSchema } from "./schema.ts";

const router = Router();

// Per-USER rate limit on booking creation: 10 requests / 60s. This is keyed on
// the authenticated principal's id (req.user.sub) — NOT req.ip — so one
// shared-IP office can't be throttled as a group, and a single abusive account
// is capped independently. requireAuth MUST run first so req.user is populated.
const bookingRateLimit = rateLimit({
  max: 10,
  windowMs: 60_000,
  label: "bookings:create",
  keyOf: (req) => req.user?.sub ?? "",
});

// Booking creation requires any authenticated user; the booking is created for
// the authenticated user (the JWT `sub`), never a body-supplied id.
router.post("/", requireAuth, bookingRateLimit, validate(createBookingSchema), createBooking);
// Read stays open for now (discovery); ownership is enforced on mutate.
router.get("/:id", getBooking);
// Cancel is owner-only (or ADMIN) — BOLA check lives in the service.
router.delete("/:id", requireAuth, cancelBooking);

export default router;
