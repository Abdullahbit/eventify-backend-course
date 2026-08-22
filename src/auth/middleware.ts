import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../errors.ts';
import type { Role } from '../domain.ts';
import { verifyAccessToken } from './tokens.ts';

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new HttpError(401, 'Authentication required');
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      throw new HttpError(401, 'Authentication required');
    }

    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: Role[]) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        throw new HttpError(401, 'Authentication required');
      }
      if (!roles.includes(user.role)) {
        throw new HttpError(403, 'You are not allowed to perform this action');
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
