import { Router } from "express";
import { validate, validateQuery } from "../middleware/validate.ts";
import {
  createVenue,
  deleteVenue,
  getVenue,
  listVenues,
  updateVenue,
} from "./controller.ts";
import { createVenueSchema, listVenueQuerySchema, updateVenueSchema } from "./schema.ts";

const router = Router();

router.post("/", validate(createVenueSchema), createVenue);
router.get("/", validateQuery(listVenueQuerySchema), listVenues);
router.get("/:id", getVenue);
router.patch("/:id", validate(updateVenueSchema), updateVenue);
router.delete("/:id", deleteVenue);

export default router;
