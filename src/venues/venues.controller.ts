import type { Request, Response, NextFunction } from 'express';
import { VenuesService } from './venues.service.ts';
import { HttpError } from '../errors.ts';

export class VenuesController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const venue = await VenuesService.create(req.body);
      res.status(201).json(venue);
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = res.locals.query as { limit?: number } | undefined;
      const limit = query?.limit;
      const venues = await VenuesService.list(limit);
      res.status(200).json(venues);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id || typeof id !== 'string') {
        throw new HttpError(400, 'Invalid ID');
      }
      const venue = await VenuesService.getById(id);
      res.status(200).json(venue);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id || typeof id !== 'string') {
        throw new HttpError(400, 'Invalid ID');
      }
      const venue = await VenuesService.update(id, req.body);
      res.status(200).json(venue);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      if (!id || typeof id !== 'string') {
        throw new HttpError(400, 'Invalid ID');
      }
      await VenuesService.delete(id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
}
