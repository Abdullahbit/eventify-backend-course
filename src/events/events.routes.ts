import { Router } from 'express';
import { EventsController } from './events.controller.ts';
import { validateQuery } from '../middleware/validate.ts';
import { listEventsQuerySchema } from './events.schema.ts';

const router = Router();

router.get('/', validateQuery(listEventsQuerySchema), EventsController.list);
router.get('/:id', EventsController.getById);

export { router as eventsRouter };
