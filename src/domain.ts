// Minimal stub for the Session 1 live-code blocks.
//
// Session 1 homework, task 1: replace this with the full domain model -
// `User`, `Event`, `Booking` interfaces matching the course domain exactly
// (roles ATTENDEE | ORGANIZER | ADMIN and booking statuses
// CONFIRMED | CANCELLED | WAITLISTED as literal-union types, not enums),
// plus the generic `findById`. Acceptance: `npm run typecheck` passes and
// there is no `any` anywhere.

export type Role = 'ATTENDEE' | 'ORGANIZER' | 'ADMIN';
export type BookingStatus = 'CONFIRMED' | 'CANCELLED' | 'WAITLISTED';

export interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
    createdAt: string;
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
