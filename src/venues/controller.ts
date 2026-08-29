import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../http/HttpError.ts";
import * as venueService from "./service.ts";

type VenueRequest = Request & {
  validatedQuery?: Record<string, unknown>;
};

function getVenueId(req: Request): string {
  const venueId = req.params.id;

  if (typeof venueId !== "string" || venueId.length === 0) {
    throw new HttpError(400, "Venue id is required");
  }

  return venueId;
}

export async function createVenue(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const venue = await venueService.createVenue(req.body);
    res.status(201).json(venue);
  } catch (error) {
    next(error);
  }
}

export async function listVenues(
  req: VenueRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const validatedQuery = req.validatedQuery ?? {};
    const limit = typeof validatedQuery.limit === "number" ? validatedQuery.limit : undefined;
    const venues = await venueService.listVenues(limit);
    res.status(200).json(venues);
  } catch (error) {
    next(error);
  }
}

export async function getVenue(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const venueId = getVenueId(req);
    const venue = await venueService.getVenueById(venueId);
    res.status(200).json(venue);
  } catch (error) {
    next(error);
  }
}

export async function updateVenue(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const venueId = getVenueId(req);
    const venue = await venueService.updateVenue(venueId, req.body);
    res.status(200).json(venue);
  } catch (error) {
    next(error);
  }
}

export async function deleteVenue(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const venueId = getVenueId(req);
    const venue = await venueService.deleteVenue(venueId);
    res.status(200).json(venue);
  } catch (error) {
    next(error);
  }
}
