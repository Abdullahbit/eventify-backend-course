import { Router } from 'express';
import { EventsController } from './events.controller.ts';
import { validate, validateQuery } from '../middleware/validate.ts';
import { requireAuth, requireRole } from '../auth/middleware.ts';
import { createEventSchema, listEventsQuerySchema, updateEventSchema } from './events.schema.ts';

const router = Router();

router.post(
  '/',
  requireAuth,
  requireRole('ORGANIZER', 'ADMIN'),
  validate(createEventSchema),
  EventsController.create
);

router.get('/', validateQuery(listEventsQuerySchema), EventsController.list);
router.get('/:id', EventsController.getById);

router.patch('/:id', requireAuth, validate(updateEventSchema), EventsController.update);
router.delete('/:id', requireAuth, EventsController.delete);

export { router as eventsRouter };
