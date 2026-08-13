import type { Request, Response, NextFunction } from 'express';
import { VenuesService } from './venues.service.ts';

export class VenuesController {
  static create(req: Request, res: Response, next: NextFunction): void {
    try {
      const venue = VenuesService.create(req.body);
      res.status(201).json(venue);
    } catch (error) {
      next(error);
    }
  }

  static list(req: Request, res: Response, next: NextFunction): void {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const venues = VenuesService.list(limit);
      res.status(200).json(venues);
    } catch (error) {
      next(error);
    }
  }

  static getById(req: Request, res: Response, next: NextFunction): void {
    try {
      const id = req.params.id;
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid ID');
      }
      const venue = VenuesService.getById(id);
      res.status(200).json(venue);
    } catch (error) {
      next(error);
    }
  }

  static update(req: Request, res: Response, next: NextFunction): void {
    try {
      const id = req.params.id;
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid ID');
      }
      const venue = VenuesService.update(id, req.body);
      res.status(200).json(venue);
    } catch (error) {
      next(error);
    }
  }

  static delete(req: Request, res: Response, next: NextFunction): void {
    try {
      const id = req.params.id;
      if (!id || typeof id !== 'string') {
        throw new Error('Invalid ID');
      }
      VenuesService.delete(id);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }
}
