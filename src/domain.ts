export type Role = "ATTENDEE" | "ORGANIZER" | "ADMIN";
export type BookingStatus = "CONFIRMED" | "CANCELLED" | "WAITLISTED";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  venue: string | null;
  startsAt: string;
  capacity: number;
  priceCents: number;
  organizerId: string;
  createdAt: string;
}

export interface Booking {
  id: string;
  userId: string;
  eventId: string;
  status: BookingStatus;
  createdAt: string;
}

export function findById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find((item) => item.id === id);
}