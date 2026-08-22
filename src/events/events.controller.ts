import type { Request, Response, NextFunction } from 'express';
import { EventsService, type ListEventsQuery } from './events.service.ts';
import { HttpError } from '../errors.ts';

export class EventsController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const event = await EventsService.create(req.body);
      res.status(201).json(event);
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
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

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        throw new HttpError(400, 'Invalid ID parameter');
      }
      if (!req.user) {
        throw new HttpError(401, 'Authentication required');
      }

      const event = await EventsService.update(id, req.body, {
        sub: req.user.sub,
        role: req.user.role,
      });
      res.status(200).json(event);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      if (!id || typeof id !== 'string') {
        throw new HttpError(400, 'Invalid ID parameter');
      }
      if (!req.user) {
        throw new HttpError(401, 'Authentication required');
      }

      const event = await EventsService.delete(id, {
        sub: req.user.sub,
        role: req.user.role,
      });
      res.status(200).json(event);
    } catch (error) {
      next(error);
    }
  }
}
