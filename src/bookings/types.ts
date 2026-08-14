export type BookingStatus = "CONFIRMED" | "CANCELLED" | "WAITLISTED";

export type Booking = {
  id: string;
  userId: string;
  eventId: string;
  status: BookingStatus;
  createdAt: string;
};

export type CreateBookingInput = {
  eventId: string;
};
