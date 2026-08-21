import { randomUUID } from 'node:crypto';
import { HttpError } from '../errors.ts';
import { type Booking } from '../domain.ts';
import { EventsService } from '../events/events.service.ts';

// In-memory store for Bookings
const store = new Map<string, Booking>();

export class BookingsService {
  static async create(eventId: string, userId: string): Promise<Booking> {
    // 1. Verify if the event exists (throws 404 if missing)
    const event = await EventsService.getById(eventId);

    // 2. Check for duplicate bookings (any status, including CANCELLED)
    for (const booking of store.values()) {
      if (booking.userId === userId && booking.eventId === eventId) {
        throw new HttpError(409, 'User already has a booking for this event');
      }
    }

    // 3. Check capacity rules (only count CONFIRMED bookings)
    const confirmedCount = Array.from(store.values()).filter(
      (b) => b.eventId === eventId && b.status === 'CONFIRMED'
    ).length;

    if (confirmedCount >= event.capacity) {
      throw new HttpError(409, 'Event at capacity');
    }

    // 4. Create the booking
    const newBooking: Booking = {
      id: randomUUID(),
      userId,
      eventId,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
    };

    store.set(newBooking.id, newBooking);
    return newBooking;
  }

  static getById(id: string): Booking {
    const booking = store.get(id);
    if (!booking) {
      throw new HttpError(404, 'Booking not found');
    }
    return booking;
  }

  static delete(id: string): Booking {
    const booking = this.getById(id); // Throws 404 if missing

    // Perform state change (soft delete)
    booking.status = 'CANCELLED';
    store.set(id, booking);

    return booking;
  }
}
