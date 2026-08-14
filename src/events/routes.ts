import { Router } from "express";
import { validateQuery } from "../middleware/validate.ts";
import { listEvents } from "./controller.ts";
import { listEventsQuerySchema } from "./schema.ts";

const router = Router();

router.get("/", validateQuery(listEventsQuerySchema), listEvents);

export default router;
