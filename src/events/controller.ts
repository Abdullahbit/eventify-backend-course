import type { NextFunction, Request, Response } from "express";
import * as eventService from "./service.ts";

export async function listEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = res.locals.query as {
      page?: number;
      limit?: number;
      venue?: string;
      from?: string;
      to?: string;
    };

    const result = await eventService.listEvents(query);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
