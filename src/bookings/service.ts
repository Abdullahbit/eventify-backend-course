import { randomUUID } from "node:crypto";
import { HttpError } from "../http/HttpError.ts";
import { findById } from "../domain.ts";
import { readFile } from "node:fs/promises";
import type { Booking, BookingStatus } from "./types.ts";
import type { Event } from "../domain.ts";

const currentUserId = "user-1";
const bookings = new Map<string, Booking>();
let cachedEvents: Event[] | null = null;

async function loadEvents(): Promise<Event[]> {
  if (cachedEvents) {
    return cachedEvents;
  }

  const file = await readFile("data/events.json", "utf-8");
  cachedEvents = JSON.parse(file) as Event[];
  return cachedEvents;
}

function getConfirmedCountForEvent(eventId: string): number {
  return [...bookings.values()].filter(
    (booking) => booking.eventId === eventId && booking.status === "CONFIRMED",
  ).length;
}

export async function createBooking(eventId: string): Promise<Booking> {
  const events = await loadEvents();
  const event = findById(events, eventId);

  if (!event) {
    throw new HttpError(404, "Unknown eventId");
  }

  const duplicate = [...bookings.values()].find(
    (booking) => booking.userId === currentUserId && booking.eventId === eventId,
  );

  if (duplicate) {
    throw new HttpError(409, "This user already has a booking for this event");
  }

  const confirmedCount = getConfirmedCountForEvent(eventId);

  if (confirmedCount >= event.capacity) {
    throw new HttpError(409, "Event at capacity");
  }

  const booking: Booking = {
    id: randomUUID(),
    userId: currentUserId,
    eventId,
    status: "CONFIRMED",
    createdAt: new Date().toISOString(),
  };

  bookings.set(booking.id, booking);

  return booking;
}

export function getBookingById(id: string): Booking {
  const booking = bookings.get(id);

  if (!booking) {
    throw new HttpError(404, "Unknown booking id");
  }

  return booking;
}

export function cancelBooking(id: string): Booking {
  const booking = getBookingById(id);

  const cancelled: Booking = {
    ...booking,
    status: "CANCELLED" as BookingStatus,
  };

  bookings.set(id, cancelled);

  return cancelled;
}
