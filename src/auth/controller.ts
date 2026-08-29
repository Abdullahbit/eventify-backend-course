import type { Request, Response } from "express";
import { HttpError } from "../http/HttpError.ts";
import { login, rotateRefresh } from "./service.ts";
import { REFRESH_COOKIE_NAME, refreshCookieOptions } from "./tokens.ts";

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };

  const { accessToken, refreshToken } = await login({ email, password });

  // Refresh token goes ONLY in the httpOnly/Secure/SameSite=strict cookie
  // scoped to /v1/auth/refresh. The access token is the only thing in the
  // JSON body.
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
  res.status(200).json({ accessToken });
}

export async function refreshHandler(req: Request, res: Response): Promise<void> {
  const rawToken = getRefreshCookie(req);
  if (!rawToken) {
    throw new HttpError(401, "Invalid or expired refresh token");
  }

  const { accessToken, refreshToken } = await rotateRefresh(rawToken);

  // Rotate the cookie too — the old token is now revoked server-side.
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
  res.status(200).json({ accessToken });
}

// Read the refresh cookie from the Cookie header. We avoid the cookie-parser
// dependency: `res.cookie` (Express built-in) sets the cookie, and we parse
// the header manually on read.
function getRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === REFRESH_COOKIE_NAME) return value;
  }
  return undefined;
}
