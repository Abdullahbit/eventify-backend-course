import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../http/HttpError.ts";
import type { Role } from "../domain.ts";
import { verifyAccessToken } from "./tokens.ts";

// NOTE on Express 5 (router@2.2.0): when an async middleware RESOLVES, the
// router calls `ret.then(null, onRejected)` — the onFulfilled handler is null,
// so `next()` is NOT auto-invoked. Therefore a middleware MUST call `next()`
// explicitly on success. Rejections (thrown / returned errors) ARE forwarded to
// the error handler via `onRejected`, so throwing is still fine for failures.
// We use try/catch + `next(err)` which covers both paths reliably.

// Authenticates the Bearer access token and populates `req.user`. Any failure
// becomes a generic 401 (no user enumeration, no exact failure hints).
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new HttpError(401, "Authentication required");
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      throw new HttpError(401, "Authentication required");
    }

    // verifyAccessToken validates the payload with Zod and throws 401 on any
    // failure (bad signature, expired, malformed claims).
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

// Factory: ensures the authenticated user holds one of the allowed roles.
// Assumes `requireAuth` already ran (so `req.user` is present). Returns 403 on
// role mismatch, 401 if somehow unauthenticated.
export function requireRole(...roles: Role[]) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        throw new HttpError(401, "Authentication required");
      }
      if (!roles.includes(user.role)) {
        throw new HttpError(403, "You are not allowed to perform this action");
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
