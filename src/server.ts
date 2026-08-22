import { app } from './app.ts';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
  console.log(`Venues API resource active at http://localhost:${PORT}/v1/venues`);
  console.log(`Bookings API resource active at http://localhost:${PORT}/v1/bookings`);
  console.log(`Events API resource active at http://localhost:${PORT}/v1/events`);
});
