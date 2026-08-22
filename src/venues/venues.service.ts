import { HttpError } from '../errors.ts';
import { VenuesRepository, type VenueCreateInput, type VenueUpdateInput } from './venues.repository.ts';

export class VenuesService {
  static async create(input: VenueCreateInput) {
    const existing = await VenuesRepository.getByName(input.name);
    if (existing) {
      throw new HttpError(409, 'Venue name already exists');
    }
    return VenuesRepository.create(input);
  }

  static async list(limit?: number) {
    return VenuesRepository.list(limit);
  }

  static async getById(id: string) {
    const venue = await VenuesRepository.getById(id);
    if (!venue) {
      throw new HttpError(404, 'Venue not found');
    }
    return venue;
  }

  static async update(id: string, input: VenueUpdateInput) {
    await this.getById(id); // Throws 404 if missing

    if (input.name !== undefined) {
      const existingWithName = await VenuesRepository.getByName(input.name);
      if (existingWithName && existingWithName.id !== id) {
        throw new HttpError(409, 'Venue name already exists');
      }
    }

    return VenuesRepository.update(id, input);
  }

  static async delete(id: string) {
    await this.getById(id); // Throws 404 if missing
    await VenuesRepository.remove(id);
  }
}
