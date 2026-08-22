import express from 'express';
import { venuesRouter } from './venues/venues.routes.ts';
import { bookingsRouter } from './bookings/bookings.routes.ts';
import { eventsRouter } from './events/events.routes.ts';
import authRouter from './auth/routes.ts';
import { errorHandler } from './middleware/error.ts';
import { HttpError } from './errors.ts';

export const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

app.use('/v1/auth', authRouter);
app.use('/v1/venues', venuesRouter);
app.use('/v1/bookings', bookingsRouter);
app.use('/v1/events', eventsRouter);

app.use((req, res, next) => {
  next(new HttpError(404, 'Not found'));
});

app.use(errorHandler);
