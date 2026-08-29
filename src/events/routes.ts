import { Router } from "express";
import { validate, validateQuery } from "../middleware/validate.ts";
import { requireAuth, requireRole } from "../auth/middleware.ts";
import { createEventSchema, listEventsQuerySchema, updateEventSchema } from "./schema.ts";
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  updateEvent,
} from "./controller.ts";

const router = Router();

// POST requires an authenticated ORGANIZER or ADMIN. ATTENDEE -> 403.
router.post(
  "/",
  requireAuth,
  requireRole("ORGANIZER", "ADMIN"),
  validate(createEventSchema),
  createEvent,
);
// GET stays public (event discovery).
router.get("/", validateQuery(listEventsQuerySchema), listEvents);
router.get("/:id", getEvent);
// PATCH/DELETE are owner-only (or ADMIN) — BOLA check lives in the service.
router.patch("/:id", requireAuth, validate(updateEventSchema), updateEvent);
router.delete("/:id", requireAuth, deleteEvent);

export default router;
