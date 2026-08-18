import { Router } from "express";
import { validate, validateQuery } from "../middleware/validate.ts";
import { createEventSchema, listEventsQuerySchema, updateEventSchema } from "./schema.ts";
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  updateEvent,
} from "./controller.ts";

const router = Router();

router.post("/", validate(createEventSchema), createEvent);
router.get("/", validateQuery(listEventsQuerySchema), listEvents);
router.get("/:id", getEvent);
router.patch("/:id", validate(updateEventSchema), updateEvent);
router.delete("/:id", deleteEvent);

export default router;
