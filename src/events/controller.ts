import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../http/HttpError.ts";
import * as eventService from "./service.ts";

export async function createEvent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const event = await eventService.createEvent(req.body);
    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
}

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

export async function getEvent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventId = req.params.id;
    if (typeof eventId !== "string" || eventId.length === 0) {
      throw new HttpError(400, "Event id is required");
    }

    const event = await eventService.getEventById(eventId);
    res.status(200).json(event);
  } catch (error) {
    next(error);
  }
}

export async function updateEvent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventId = req.params.id;
    if (typeof eventId !== "string" || eventId.length === 0) {
      throw new HttpError(400, "Event id is required");
    }

    const event = await eventService.updateEvent(eventId, req.body);
    res.status(200).json(event);
  } catch (error) {
    next(error);
  }
}

export async function deleteEvent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const eventId = req.params.id;
    if (typeof eventId !== "string" || eventId.length === 0) {
      throw new HttpError(400, "Event id is required");
    }

    const event = await eventService.deleteEvent(eventId);
    res.status(200).json(event);
  } catch (error) {
    next(error);
  }
}
