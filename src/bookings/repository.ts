import { prisma } from "../db.ts";

// In Prisma 7, the transaction client type is a strict Omit that doesn't
// expose model delegates in the type system. The repository functions below
// accept the transaction client `tx` and cast inside (see the `any` params) —
// the runtime object DOES have the model delegates.

/**
 * Count CONFIRMED bookings for an event.
 * Used inside the transaction for the capacity check.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function countConfirmed(eventId: string, tx: any) {
  return tx.booking.count({
    where: { eventId, status: "CONFIRMED" },
  });
}

/**
 * Find an existing booking row for (userId, eventId).
 * Returns null when no row exists.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findByUserEvent(userId: string, eventId: string, tx: any) {
  return tx.booking.findUnique({
    where: { userId_eventId: { userId, eventId } },
  });
}

/**
 * Flip a CANCELLED booking back to CONFIRMED.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function reactivate(bookingId: string, tx: any) {
  return tx.booking.update({
    where: { id: bookingId },
    data: { status: "CONFIRMED" },
  });
}

/**
 * Create a new CONFIRMED booking.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function create(userId: string, eventId: string, tx: any) {
  return tx.booking.create({
    data: { userId, eventId, status: "CONFIRMED" },
  });
}

/**
 * Get a booking by id (outside transaction).
 */
export async function getById(id: string) {
  return prisma.booking.findUnique({ where: { id } });
}

/**
 * Soft-cancel: flip status to CANCELLED (row stays).
 */
export async function cancel(id: string) {
  return prisma.booking.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
}
