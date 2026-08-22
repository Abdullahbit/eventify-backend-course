import { HttpError } from '../errors.ts';
import { EventsRepository } from './events.repository.ts';

export interface ListEventsQuery {
  page: number;
  limit: number;
  venue?: string;
  from?: string;
  to?: string;
}

export class EventsService {
  static async getById(id: string) {
    const event = await EventsRepository.getById(id);
    if (!event) {
      throw new HttpError(404, 'Event not found');
    }
    return event;
  }

  static async list(query: ListEventsQuery) {
    const filters = {
      venue: query.venue,
      from: query.from,
      to: query.to,
    };
    return EventsRepository.list(query.page, query.limit, filters);
  }
}
