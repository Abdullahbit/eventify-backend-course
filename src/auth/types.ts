import type { AccessTokenClaims } from './tokens.ts';

declare module 'express' {
  interface Request {
    user?: AccessTokenClaims;
  }
}
