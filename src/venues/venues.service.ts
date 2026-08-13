import { HttpError } from '../errors.ts';

export interface Venue {
  id: string;
  name: string;
  address: string;
  capacity: number;
  contactEmail: string;
  createdAt: string;
}

export type CreateVenueInput = Omit<Venue, 'id' | 'createdAt'>;
export type UpdateVenueInput = Partial<CreateVenueInput>;

// In-memory Map store
const store = new Map<string, Venue>();

export class VenuesService {
  static create(input: CreateVenueInput): Venue {
    // Check if name is unique
    for (const venue of store.values()) {
      if (venue.name.toLowerCase() === input.name.toLowerCase()) {
        throw new HttpError(409, 'Venue name already exists');
      }
    }

    const id = `ven-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const newVenue: Venue = {
      id,
      ...input,
      createdAt: new Date().toISOString(),
    };

    store.set(id, newVenue);
    return newVenue;
  }

  static list(limit?: number): Venue[] {
    const venues = Array.from(store.values());
    if (limit !== undefined) {
      return venues.slice(0, limit);
    }
    return venues;
  }

  static getById(id: string): Venue {
    const venue = store.get(id);
    if (!venue) {
      throw new HttpError(404, 'Venue not found');
    }
    return venue;
  }

  static update(id: string, input: UpdateVenueInput): Venue {
    const existing = this.getById(id);

    // If name is changing, check uniqueness across other venues
    if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
      for (const venue of store.values()) {
        if (venue.id !== id && venue.name.toLowerCase() === input.name.toLowerCase()) {
          throw new HttpError(409, 'Venue name already exists');
        }
      }
    }

    const updatedVenue: Venue = {
      ...existing,
      ...input,
      // Keep original id and createdAt
      id: existing.id,
      createdAt: existing.createdAt,
    };

    store.set(id, updatedVenue);
    return updatedVenue;
  }

  static delete(id: string): void {
    const exists = store.has(id);
    if (!exists) {
      throw new HttpError(404, 'Venue not found');
    }
    store.delete(id);
  }

  // Helper for tests / environment resets
  static clear(): void {
    store.clear();
  }
}
