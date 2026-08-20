import { Router } from "express";
import { validate } from "../middleware/validate.ts";
import { loginSchema } from "./schema.ts";
import { loginHandler, refreshHandler } from "./controller.ts";

const router = Router();

// Issue tokens. Returns { accessToken }; sets the httpOnly refresh cookie.
router.post("/login", validate(loginSchema), loginHandler);

// Rotate: reads the refresh cookie, returns a fresh { accessToken } and
// rotates the cookie. No Bearer token required here.
router.post("/refresh", refreshHandler);

export default router;
