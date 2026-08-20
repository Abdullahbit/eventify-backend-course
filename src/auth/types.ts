import type { AccessTokenClaims } from "./tokens.ts";

// Augment Express's Request so the authenticated principal is available after
// `requireAuth` runs. This is compile-time only; at runtime `req.user` is just
// a property the middleware assigns.
declare module "express" {
  interface Request {
    user?: AccessTokenClaims;
  }
}
