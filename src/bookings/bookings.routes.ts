import { Router } from 'express';
import { BookingsController } from './bookings.controller.ts';
import { validate } from '../middleware/validate.ts';
import { requireAuth } from '../auth/middleware.ts';
import { createBookingSchema } from './bookings.schema.ts';

const router = Router();

router.post('/', requireAuth, validate(createBookingSchema), BookingsController.create);
router.get('/:id', requireAuth, BookingsController.getById);
router.delete('/:id', requireAuth, BookingsController.delete);

export { router as bookingsRouter };
