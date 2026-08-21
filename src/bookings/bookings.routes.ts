import { Router } from 'express';
import { BookingsController } from './bookings.controller.ts';
import { validate } from '../middleware/validate.ts';
import { createBookingSchema } from './bookings.schema.ts';

const router = Router();

router.post('/', validate(createBookingSchema), BookingsController.create);
router.get('/:id', BookingsController.getById);
router.delete('/:id', BookingsController.delete);

export { router as bookingsRouter };
