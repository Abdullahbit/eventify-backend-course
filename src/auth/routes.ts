import { Router } from "express";
import { validate } from "../middleware/validate.ts";
import { rateLimit } from "../infra/rate-limit.ts";
import { loginSchema } from "./schema.ts";
import { loginHandler, refreshHandler } from "./controller.ts";

const router = Router();

// Strict per-IP rate limit on login: 5 requests / 60s. Login is the
// credential-stuffing / brute-force surface, so we key on the source IP and
// keep the ceiling low enough to throttle automated attacks while still
// allowing a human to mistype a few times.
const loginRateLimit = rateLimit({
  max: 5,
  windowMs: 60_000,
  label: "auth:login",
  keyOf: (req) => req.ip ?? "unknown",
});

// Issue tokens. Returns { accessToken }; sets the httpOnly refresh cookie.
router.post("/login", loginRateLimit, validate(loginSchema), loginHandler);

// Rotate: reads the refresh cookie, returns a fresh { accessToken } and
// rotates the cookie. No Bearer token required here.
router.post("/refresh", refreshHandler);

export default router;
