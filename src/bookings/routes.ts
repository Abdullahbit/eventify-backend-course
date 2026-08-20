import { Router } from "express";
import { validate } from "../middleware/validate.ts";
import { requireAuth } from "../auth/middleware.ts";
import { cancelBooking, createBooking, getBooking } from "./controller.ts";
import { createBookingSchema } from "./schema.ts";

const router = Router();

// Booking creation requires any authenticated user; the booking is created for
// the authenticated user (the JWT `sub`), never a body-supplied id.
router.post("/", requireAuth, validate(createBookingSchema), createBooking);
// Read stays open for now (discovery); ownership is enforced on mutate.
router.get("/:id", getBooking);
// Cancel is owner-only (or ADMIN) — BOLA check lives in the service.
router.delete("/:id", requireAuth, cancelBooking);

export default router;
