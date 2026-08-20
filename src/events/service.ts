import { HttpError } from "../http/HttpError.ts";
import * as eventRepo from "./repository.ts";
import type { EventCreateInput, EventUpdateInput } from "./repository.ts";
import type { Role } from "../domain.ts";

// The authenticated principal performing a mutating action.
type Actor = { sub: string; role: Role };

export async function createEvent(input: EventCreateInput) {
  return eventRepo.create(input);
}

export async function listEvents(query: {
  page?: number;
  limit?: number;
  venue?: string;
  from?: string;
  to?: string;
}): Promise<{ data: unknown[]; page: number; limit: number; total: number }> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const { data, total } = await eventRepo.list(page, limit, {
    venue: query.venue,
    from: query.from,
    to: query.to,
  });

  return { data, page, limit, total };
}

export async function getEventById(id: string) {
  const event = await eventRepo.getById(id);

  if (!event) {
    throw new HttpError(404, "Event not found");
  }

  return event;
}

export async function updateEvent(id: string, input: EventUpdateInput, actor: Actor) {
  const event = await getEventById(id);
  assertCanModify(event, actor);
  return eventRepo.update(id, input);
}

export async function deleteEvent(id: string, actor: Actor) {
  const event = await getEventById(id);
  assertCanModify(event, actor);
  return eventRepo.remove(id);
}

// BOLA guard: only the organizer who owns the event (or an ADMIN) may modify
// or delete it. Anyone else gets a generic 403.
function assertCanModify(
  event: { id: string; organizerId: string },
  actor: Actor,
): void {
  if (actor.role !== "ADMIN" && event.organizerId !== actor.sub) {
    throw new HttpError(403, "You do not have permission to modify this event");
  }
}
