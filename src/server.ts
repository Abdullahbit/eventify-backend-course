import express from 'express';
import { venuesRouter } from './venues/venues.routes.ts';
import { bookingsRouter } from './bookings/bookings.routes.ts';
import { eventsRouter } from './events/events.routes.ts';
import { errorHandler } from './middleware/error.ts';
import { HttpError } from './errors.ts';

const app = express();
const PORT = process.env.PORT || 3000;

// Parse incoming JSON payloads
app.use(express.json());

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Mount Resource Routes
app.use('/v1/venues', venuesRouter);
app.use('/v1/bookings', bookingsRouter);
app.use('/v1/events', eventsRouter);

// Fallback route handler for non-existent paths
app.use((req, res, next) => {
  next(new HttpError(404, 'Not found'));
});

// Centralized error handling middleware (must be defined last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
  console.log(`Venues API resource active at http://localhost:${PORT}/v1/venues`);
  console.log(`Bookings API resource active at http://localhost:${PORT}/v1/bookings`);
  console.log(`Events API resource active at http://localhost:${PORT}/v1/events`);
});
