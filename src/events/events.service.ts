import { HttpError } from '../errors.ts';
import { EventsRepository, type EventCreateInput, type EventUpdateInput } from './events.repository.ts';
import type { Role } from '../domain.ts';

type Actor = { sub: string; role: Role };

export interface ListEventsQuery {
  page: number;
  limit: number;
  venue?: string;
  from?: string;
  to?: string;
}

export class EventsService {
  static async create(input: EventCreateInput) {
    return EventsRepository.create(input);
  }

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

  static async update(id: string, input: EventUpdateInput, actor: Actor) {
    const event = await this.getById(id);
    this.assertCanModify(event, actor);
    return EventsRepository.update(id, input);
  }

  static async delete(id: string, actor: Actor) {
    const event = await this.getById(id);
    this.assertCanModify(event, actor);
    return EventsRepository.remove(id);
  }

  private static assertCanModify(
    event: { organizerId: string },
    actor: Actor
  ): void {
    if (actor.role !== 'ADMIN' && event.organizerId !== actor.sub) {
      throw new HttpError(403, 'You do not have permission to modify this event');
    }
  }
}
