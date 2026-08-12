// Minimal stub for the Session 1 live-code blocks.
//
// Session 1 homework, task 1: replace this with the full domain model -
// `User`, `Event`, `Booking` interfaces matching the course domain exactly
// (roles ATTENDEE | ORGANIZER | ADMIN and booking statuses
// CONFIRMED | CANCELLED | WAITLISTED as literal-union types, not enums),
// plus the generic `findById`. Acceptance: `npm run typecheck` passes and
// there is no `any` anywhere.

type Role = 'ATTENDEE' | 'ORGANIZER' | 'ADMIN';
type Status = 'CONFIRMED' | 'CANCELLED' | 'WAITLISTED';
interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}
export interface Events { id: string; title: string; description: string; organizerId: string; date: Date; location: string; }
interface Booking { id: string; userId: string; eventId: string; status: Status; }
function findByid<T>(items: T[], id: string): T | undefined {
  return items.find(item => (item as any).id === id);
}