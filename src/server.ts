import express from "express";
import type { NextFunction, Request, Response } from "express";
import bookingRoutes from "./bookings/routes.ts";
import { HttpError } from "./http/HttpError.ts";
import eventRoutes from "./events/routes.ts";
import venueRoutes from "./venues/routes.ts";

const app = express();
const port = 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

app.use("/v1/venues", venueRoutes);
app.use("/v1/events", eventRoutes);
app.use("/v1/bookings", bookingRoutes);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  void _next;

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ error: error.message, details: error.details });
    return;
  }

  if (
    error instanceof SyntaxError &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status === 400
  ) {
    res.status(400).json({ error: "Invalid JSON body", details: null });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Internal Server Error", details: null });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not Found", details: null });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}/health`);
});