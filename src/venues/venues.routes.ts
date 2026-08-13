import { Router } from 'express';
import { VenuesController } from './venues.controller.ts';
import { validate, validateQuery } from '../middleware/validate.ts';
import { createVenueSchema, updateVenueSchema, listVenuesSchema } from './venues.schema.ts';

const router = Router();

router.post('/', validate(createVenueSchema), VenuesController.create);
router.get('/', validateQuery(listVenuesSchema), VenuesController.list);
router.get('/:id', VenuesController.getById);
router.patch('/:id', validate(updateVenueSchema), VenuesController.update);
router.delete('/:id', VenuesController.delete);

export { router as venuesRouter };
