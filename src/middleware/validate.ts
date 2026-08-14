import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "../http/HttpError.ts";

type ValidatedRequest = Request & {
  validatedQuery?: Record<string, unknown>;
};

export function validate<T>(schema: z.ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
        .join("; ");

      return next(new HttpError(400, message, result.error.issues));
    }

    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: z.ZodType<T>) {
  return (req: ValidatedRequest, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join(".") || "query"}: ${issue.message}`)
        .join("; ");

      return next(new HttpError(400, message, result.error.issues));
    }

    res.locals.query = result.data;
    req.validatedQuery = result.data as Record<string, unknown>;
    next();
  };
}
