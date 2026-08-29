// Types are now derived from Prisma. Re-export for convenience.
export type { Booking } from "../generated/prisma/client.ts";
export { BookingStatus } from "../generated/prisma/client.ts";

export type CreateBookingInput = {
  userId: string;
  eventId: string;
};
