import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpError } from '../errors.ts';
import { type Event } from '../domain.ts';

const DATA_FILE_PATH = join(process.cwd(), 'data', 'events.json');
let cachedEvents: Event[] | null = null;

export interface ListEventsQuery {
  page: number;
  limit: number;
  venue?: string;
  from?: string;
  to?: string;
}

export interface PaginatedEvents {
  data: Event[];
  page: number;
  limit: number;
  total: number;
}

export class EventsService {
  static async getEvents(): Promise<Event[]> {
    if (cachedEvents !== null) {
      return cachedEvents;
    }

    try {
      const fileContent = await readFile(DATA_FILE_PATH, 'utf-8');
      cachedEvents = JSON.parse(fileContent) as Event[];
      return cachedEvents;
    } catch (error) {
      console.error('Error reading events data file:', error);
      throw new HttpError(500, 'Failed to load events data');
    }
  }

  static async getById(id: string): Promise<Event> {
    const events = await this.getEvents();
    const event = events.find((e) => e.id === id);
    if (!event) {
      throw new HttpError(404, 'Event not found');
    }
    return event;
  }

  static async list(query: ListEventsQuery): Promise<PaginatedEvents> {
    let events = await this.getEvents();

    // 1. Filtering (must happen before pagination)
    if (query.venue !== undefined) {
      events = events.filter((e) => e.venue === query.venue);
    }

    if (query.from !== undefined) {
      const fromTime = Date.parse(query.from);
      events = events.filter((e) => Date.parse(e.startsAt) >= fromTime);
    }

    if (query.to !== undefined) {
      const toTime = Date.parse(query.to);
      events = events.filter((e) => Date.parse(e.startsAt) <= toTime);
    }

    const total = events.length;

    // 2. Pagination
    const startIndex = (query.page - 1) * query.limit;
    const paginatedData = events.slice(startIndex, startIndex + query.limit);

    return {
      data: paginatedData,
      page: query.page,
      limit: query.limit,
      total,
    };
  }
}
