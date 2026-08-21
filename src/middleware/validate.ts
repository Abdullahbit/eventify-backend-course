import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { HttpError } from '../errors.ts';

interface ZodErrorLike {
  errors: { message: string }[];
}

function isZodErrorLike(error: unknown): error is ZodErrorLike {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const err = error as Record<string, unknown>;
  return 'errors' in err && Array.isArray(err.errors);
}

export function validate(schema: z.ZodTypeAny) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      const errorMessage = isZodErrorLike(error) && error.errors[0] ? error.errors[0].message : 'Invalid request body';
      next(new HttpError(400, errorMessage));
    }
  };
}

export function validateQuery(schema: z.ZodTypeAny) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.locals.query = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      console.error('Validation Query Error:', error);
      const errorMessage = isZodErrorLike(error) && error.errors[0] ? error.errors[0].message : 'Invalid query parameters';
      next(new HttpError(400, errorMessage));
    }
  };
}
