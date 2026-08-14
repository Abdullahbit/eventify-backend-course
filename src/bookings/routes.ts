import { Router } from "express";
import { validate } from "../middleware/validate.ts";
import { cancelBooking, createBooking, getBooking } from "./controller.ts";
import { createBookingSchema } from "./schema.ts";

const router = Router();

router.post("/", validate(createBookingSchema), createBooking);
router.get("/:id", getBooking);
router.delete("/:id", cancelBooking);

export default router;
