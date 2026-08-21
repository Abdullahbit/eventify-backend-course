import type { Request, Response, NextFunction } from 'express';
import { EventsService, type ListEventsQuery } from './events.service.ts';
import { HttpError } from '../errors.ts';

export class EventsController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Read parsed values from res.locals.query
      const query = res.locals.query as ListEventsQuery;
      const result = await EventsService.list(query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        throw new HttpError(400, 'Invalid ID parameter');
      }
      const event = await EventsService.getById(id);
      res.status(200).json(event);
    } catch (error) {
      next(error);
    }
  }
}
