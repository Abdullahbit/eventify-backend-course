import { HttpError } from "../http/HttpError.ts";
import * as venueRepo from "./repository.ts";
import type { VenueCreateInput } from "./repository.ts";

export async function createVenue(input: VenueCreateInput) {
  const existing = await venueRepo.getByName(input.name.trim().toLowerCase());

  if (existing) {
    throw new HttpError(409, "Venue name already exists");
  }

  return venueRepo.create(input);
}

export async function listVenues(limit?: number) {
  return venueRepo.list(limit);
}

export async function getVenueById(id: string) {
  const venue = await venueRepo.getById(id);

  if (!venue) {
    throw new HttpError(404, "Venue not found");
  }

  return venue;
}

export async function updateVenue(id: string, input: UpdateVenueInput) {
  await getVenueById(id);

  if (input.name) {
    const duplicate = await venueRepo.getByName(input.name.trim().toLowerCase());
    if (duplicate && duplicate.id !== id) {
      throw new HttpError(409, "Venue name already exists");
    }
  }

  return venueRepo.update(id, input);
}

export async function deleteVenue(id: string) {
  const existing = await getVenueById(id);
  await venueRepo.remove(id);
  return existing;
}

type UpdateVenueInput = {
  name?: string;
  address?: string;
  capacity?: number;
  contactEmail?: string;
};
