import type { NextFunction, Request, Response } from "express";
import * as bookingService from "./service.ts";
import { HttpError } from "../http/HttpError.ts";

// Session 4 will read the authenticated user from the JWT instead of the body.
export async function createBooking(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.body.userId;
    const booking = await bookingService.createBooking(userId, req.body.eventId);
    res.status(201).json(booking);
  } catch (error) {
    next(error);
  }
}

export async function getBooking(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const bookingId = req.params.id;
    if (typeof bookingId !== "string" || bookingId.length === 0) {
      throw new HttpError(400, "Booking id is required");
    }

    const booking = await bookingService.getBookingById(bookingId);
    res.status(200).json(booking);
  } catch (error) {
    next(error);
  }
}

export async function cancelBooking(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const bookingId = req.params.id;
    if (typeof bookingId !== "string" || bookingId.length === 0) {
      throw new HttpError(400, "Booking id is required");
    }

    const booking = await bookingService.cancelBooking(bookingId);
    res.status(200).json(booking);
  } catch (error) {
    next(error);
  }
}
