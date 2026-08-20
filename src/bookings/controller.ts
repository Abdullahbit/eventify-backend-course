import type { NextFunction, Request, Response } from "express";
import * as bookingService from "./service.ts";
import { HttpError } from "../http/HttpError.ts";

// Session 4: the booking is created for the authenticated user (req.user.sub),
// not a body-supplied userId (prevents booking on behalf of another user).
export async function createBooking(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new HttpError(401, "Authentication required");
    }
    const booking = await bookingService.createBooking(
      req.user.sub,
      req.body.eventId,
    );
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
    if (!req.user) {
      throw new HttpError(401, "Authentication required");
    }

    const booking = await bookingService.cancelBooking(bookingId, {
      sub: req.user.sub,
      role: req.user.role,
    });
    res.status(200).json(booking);
  } catch (error) {
    next(error);
  }
}
