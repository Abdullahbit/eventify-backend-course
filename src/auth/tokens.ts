import jwt from 'jsonwebtoken';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { env } from '../config.ts';
import { HttpError } from '../errors.ts';
import type { Role } from '../domain.ts';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const REFRESH_COOKIE_NAME = 'refreshToken';
export const REFRESH_COOKIE_PATH = '/v1/auth/refresh';

export const accessTokenClaimsSchema = z
  .object({
    sub: z.string().min(1),
    role: z.enum(['ATTENDEE', 'ORGANIZER', 'ADMIN']),
    iat: z.number(),
    exp: z.number(),
    jti: z.string(),
  })
  .strict();

export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function generateRefreshToken(): {
  raw: string;
  hash: string;
  expiresAt: Date;
} {
  const raw = randomBytes(32).toString('base64url');
  const hash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  return { raw, hash, expiresAt };
}

export function signAccessToken(sub: string, role: Role): string {
  return jwt.sign({ sub, role, jti: randomUUID() }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
    });
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }

  const parsed = accessTokenClaimsSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new HttpError(401, 'Invalid or expired token');
  }
  return parsed.data;
}

function cookieDomain(webOrigin: string): string | undefined {
  try {
    const host = new URL(webOrigin).hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
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
  sameSite: 'strict';
  path: string;
  domain?: string;
} {
  const domain = cookieDomain(env.WEB_ORIGIN);
  return {
    maxAge: REFRESH_TOKEN_TTL_MS,
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    ...(domain ? { domain } : {}),
  };
}
