import type { Request, Response, NextFunction } from 'express';
import { BookingsService } from './bookings.service.ts';
import { HttpError } from '../errors.ts';

export class BookingsController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { eventId } = req.body;
      if (!req.user) {
        throw new HttpError(401, 'Authentication required');
      }
      const userId = req.user.sub;
      const booking = await BookingsService.create(eventId, userId);
      res.status(201).json(booking);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        throw new HttpError(400, 'Invalid booking ID');
      }
      if (!req.user) {
        throw new HttpError(401, 'Authentication required');
      }
      const booking = await BookingsService.getById(id, {
        sub: req.user.sub,
        role: req.user.role,
      });
      res.status(200).json(booking);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        throw new HttpError(400, 'Invalid booking ID');
      }
      if (!req.user) {
        throw new HttpError(401, 'Authentication required');
      }
      const booking = await BookingsService.delete(id, {
        sub: req.user.sub,
        role: req.user.role,
      });
      res.status(200).json(booking);
    } catch (error) {
      next(error);
    }
  }
}
