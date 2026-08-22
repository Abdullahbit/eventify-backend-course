import { prisma } from '../db.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { HttpError } from '../errors.ts';
import { BookingsRepository } from './bookings.repository.ts';
import { EventsRepository } from '../events/events.repository.ts';

function isSerializationFailure(error: unknown): boolean {
  const e = error as {
    code?: string;
    cause?: { originalCode?: string; kind?: string };
  };
  if (e?.code === 'P2034' || e?.code === '40001') return true;
  if (e?.cause?.originalCode === '40001') return true;
  if (e?.cause?.kind === 'TransactionWriteConflict') return true;
  return false;
}

export class BookingsService {
  static async create(eventId: string, userId: string) {
    const event = await EventsRepository.getById(eventId);
    if (!event) {
      throw new HttpError(404, 'Event not found');
    }

    const MAX_RETRIES = 8;
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await prisma.$transaction(
          async (tx) => {
            const confirmedCount = await BookingsRepository.countConfirmed(eventId, tx);

            if (confirmedCount >= event.capacity) {
              throw new HttpError(409, 'Event at capacity');
            }

            const existing = await BookingsRepository.findByUserEvent(userId, eventId, tx);

            if (existing) {
              if (existing.status === 'CANCELLED') {
                return BookingsRepository.reactivate(existing.id, tx);
              }

              if (existing.status === 'CONFIRMED') {
                throw new HttpError(409, 'User already has a booking for this event');
              }

              throw new HttpError(409, 'Booking already exists (waitlisted)');
            }

            return BookingsRepository.create(userId, eventId, tx);
          },
          {
            isolationLevel: 'Serializable',
          }
        );
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }

        const prismaError = error as Prisma.PrismaClientKnownRequestError;

        if (prismaError.code === 'P2002') {
          throw new HttpError(409, 'User already has a booking for this event');
        }

        if (isSerializationFailure(error)) {
          lastError = error;
          continue;
        }

        throw error;
      }
    }

    throw lastError ?? new HttpError(500, 'Booking failed after retries');
  }

  static async getById(id: string) {
    const booking = await BookingsRepository.getById(id);
    if (!booking) {
      throw new HttpError(404, 'Booking not found');
    }
    return booking;
  }

  static async delete(id: string) {
    const booking = await this.getById(id);

    if (booking.status === 'CANCELLED') {
      throw new HttpError(409, 'Booking is already cancelled');
    }

    return BookingsRepository.cancel(id);
  }
}
