import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../errors.ts';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
}
