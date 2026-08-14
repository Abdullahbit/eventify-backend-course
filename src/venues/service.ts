import { randomUUID } from "node:crypto";
import { HttpError } from "../http/HttpError.ts";
import type { CreateVenueInput, UpdateVenueInput, Venue } from "./types.ts";

const venues = new Map<string, Venue>();

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

export function listVenues(limit?: number): Venue[] {
  const items = [...venues.values()];

  if (limit === undefined) {
    return items;
  }

  return items.slice(0, limit);
}

export function getVenueById(id: string): Venue {
  const venue = venues.get(id);

  if (!venue) {
    throw new HttpError(404, "Venue not found");
  }

  return venue;
}

export function createVenue(input: CreateVenueInput): Venue {
  const normalizedName = normalizeName(input.name);

  const duplicate = [...venues.values()].find(
    (venue) => normalizeName(venue.name) === normalizedName,
  );

  if (duplicate) {
    throw new HttpError(409, "Venue name already exists");
  }

  const now = new Date().toISOString();

  const venue: Venue = {
    id: randomUUID(),
    name: input.name.trim(),
    address: input.address.trim(),
    capacity: input.capacity,
    contactEmail: input.contactEmail.trim(),
    createdAt: now,
  };

  venues.set(venue.id, venue);

  return venue;
}

export function updateVenue(id: string, input: UpdateVenueInput): Venue {
  const existing = getVenueById(id);

  if (input.name) {
    const normalizedName = normalizeName(input.name);
    const duplicate = [...venues.values()].find(
      (venue) => venue.id !== id && normalizeName(venue.name) === normalizedName,
    );

    if (duplicate) {
      throw new HttpError(409, "Venue name already exists");
    }
  }

  const updated: Venue = {
    ...existing,
    ...input,
    name: input.name?.trim() ?? existing.name,
    address: input.address?.trim() ?? existing.address,
    contactEmail: input.contactEmail?.trim() ?? existing.contactEmail,
  };

  venues.set(id, updated);

  return updated;
}

export function deleteVenue(id: string): Venue {
  const existing = getVenueById(id);
  venues.delete(id);
  return existing;
}
