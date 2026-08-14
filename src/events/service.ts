import { readFile } from "node:fs/promises";
import type { Event } from "../domain.ts";
import type { EventQuery } from "./types.ts";

const eventsFilePath = "data/events.json";

let cachedEvents: Event[] | null = null;

async function loadEvents(): Promise<Event[]> {
  if (cachedEvents) {
    return cachedEvents;
  }

  const file = await readFile(eventsFilePath, "utf-8");
  cachedEvents = JSON.parse(file) as Event[];
  return cachedEvents;
}

export async function listEvents(query: EventQuery): Promise<{ data: Event[]; page: number; limit: number; total: number }> {
  const events = await loadEvents();
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const filtered = events.filter((event) => {
    if (query.venue !== undefined && event.venue !== query.venue) {
      return false;
    }

    if (query.from !== undefined && new Date(event.startsAt) < new Date(query.from)) {
      return false;
    }

    if (query.to !== undefined && new Date(event.startsAt) > new Date(query.to)) {
      return false;
    }

    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  const end = start + limit;

  return {
    data: filtered.slice(start, end),
    page: safePage,
    limit,
    total,
  };
}
