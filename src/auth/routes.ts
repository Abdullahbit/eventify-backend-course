import { Router } from 'express';
import { validate } from '../middleware/validate.ts';
import { loginSchema } from './schema.ts';
import { loginHandler, refreshHandler } from './controller.ts';

const router = Router();

router.post('/login', validate(loginSchema), loginHandler);
router.post('/refresh', refreshHandler);

export default router;
