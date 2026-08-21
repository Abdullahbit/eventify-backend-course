import type { Request, Response, NextFunction } from 'express';
import { BookingsService } from './bookings.service.ts';
import { HttpError } from '../errors.ts';


export class BookingsController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.body;
      const userId = (req.headers['x-user-id'] as string) || '00000000-0000-0000-0000-000000000001';
      const booking = await BookingsService.create(eventId, userId);
      res.status(201).json(booking);
    } catch (error) {
      next(error);
    }
  }

  static getById(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        throw new HttpError(400, 'Invalid booking ID');
      }
      const booking = BookingsService.getById(id);
      res.status(200).json(booking);
    } catch (error) {
      next(error);
    }
  }

  static delete(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        throw new HttpError(400, 'Invalid booking ID');
      }
      const booking = BookingsService.delete(id);
      res.status(200).json(booking); // Retain status code 200 since we return the cancelled booking body
    } catch (error) {
      next(error);
    }
  }
}
