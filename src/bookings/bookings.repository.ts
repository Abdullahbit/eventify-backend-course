import { prisma } from '../db.ts';

export class BookingsRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async countConfirmed(eventId: string, tx: any) {
    return tx.booking.count({
      where: { eventId, status: 'CONFIRMED' },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async findByUserEvent(userId: string, eventId: string, tx: any) {
    return tx.booking.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async reactivate(bookingId: string, tx: any) {
    return tx.booking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED' },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async create(userId: string, eventId: string, tx: any) {
    return tx.booking.create({
      data: { userId, eventId, status: 'CONFIRMED' },
    });
  }

  static async getById(id: string) {
    return prisma.booking.findUnique({ where: { id } });
  }

  static async cancel(id: string) {
    return prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }
}
