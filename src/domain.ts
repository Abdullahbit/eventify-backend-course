// Minimal stub for the Session 1 live-code blocks.
//
// Session 1 homework, task 1: replace this with the full domain model -
// `User`, `Event`, `Booking` interfaces matching the course domain exactly
// (roles ATTENDEE | ORGANIZER | ADMIN and booking statuses
// CONFIRMED | CANCELLED | WAITLISTED as literal-union types, not enums),
// plus the generic `findById`. Acceptance: `npm run typecheck` passes and
// there is no `any` anywhere.

export type Role = 'ATTENDEE' | 'ORGANIZER' | 'ADMIN';
export type Status = 'CONFIRMED' | 'CANCELLED' | 'WAITLISTED';
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}
export interface Events { id: string; title: string; description: string; organizerId: string; date: Date; location: string; }
export interface Booking { id: string; userId: string; eventId: string; status: Status; }

export function findById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}