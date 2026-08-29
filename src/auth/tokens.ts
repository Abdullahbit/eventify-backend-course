import jwt from "jsonwebtoken";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { config } from "../config.ts";
import { HttpError } from "../http/HttpError.ts";
import type { Role } from "../domain.ts";

// --- Constants ---------------------------------------------------------------
const ACCESS_TOKEN_TTL = "15m";
// Refresh tokens live 7 days; the cookie mirrors this via `maxAge`.
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Cookie name + the single path the refresh endpoint is served from. The
// refresh token cookie is locked to this path so it is NEVER sent to any
// other route (e.g. /v1/events).
export const REFRESH_COOKIE_NAME = "refreshToken";
export const REFRESH_COOKIE_PATH = "/v1/auth/refresh";

// --- JWT claims validation (NEVER cast the payload) --------------------------
// Every access token is validated against this schema before `req.user` is
// trusted. We never use `as Payload` — Zod is the single source of truth.
export const accessTokenClaimsSchema = z
  .object({
    sub: z.string().min(1),
    role: z.enum(["ATTENDEE", "ORGANIZER", "ADMIN"]),
    iat: z.number(),
    exp: z.number(),
    // Unique per-issued-token id. Guarantees every access token is distinct
    // (jwt.sign only stamps second-resolution iat/exp, so two tokens minted in
    // the same second would otherwise be byte-identical) and enables future
    // revocation/audit by token id.
    jti: z.string(),
  })
  .strict();

export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

// --- Crypto helpers ----------------------------------------------------------
// Store only the sha256 hash of the opaque token. The raw 32-byte base64url
// token exists only in the httpOnly cookie.
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// Opaque, unguessable refresh token — NEVER a JWT.
export function generateRefreshToken(): {
  raw: string;
  hash: string;
  expiresAt: Date;
} {
  const raw = randomBytes(32).toString("base64url");
  const hash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  return { raw, hash, expiresAt };
}

// Sign with HS256 pinned.
export function signAccessToken(sub: string, role: Role): string {
  return jwt.sign({ sub, role, jti: randomUUID() }, config.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

// Verify with HS256 pinned; validate the claims with Zod and return a typed
// object. Any failure (bad signature, expired, malformed claims) becomes a
// generic 401 — never a 500.
export function verifyAccessToken(token: string): AccessTokenClaims {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, config.JWT_ACCESS_SECRET, {
      algorithms: ["HS256"],
    });
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }

  const parsed = accessTokenClaimsSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new HttpError(401, "Invalid or expired token");
  }
  return parsed.data;
}

// --- Cookie options ----------------------------------------------------------
// Derive a cookie `domain` from WEB_ORIGIN, but never pin it to localhost /
// loopback (browsers reject `Domain=localhost` and it would break local dev).
function cookieDomain(webOrigin: string): string | undefined {
  try {
    const host = new URL(webOrigin).hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return undefined;
    }
    return host;
  } catch {
    return undefined;
  }
}

export function refreshCookieOptions(): {
  maxAge: number;
  httpOnly: true;
  secure: true;
  sameSite: "strict";
  path: string;
  domain?: string;
} {
  const domain = cookieDomain(config.WEB_ORIGIN);
  return {
    maxAge: REFRESH_TOKEN_TTL_MS,
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
    ...(domain ? { domain } : {}),
  };
}
