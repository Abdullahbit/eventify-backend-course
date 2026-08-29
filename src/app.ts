import express from "express";
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./http/HttpError.ts";
import authRoutes from "./auth/routes.ts";
import bookingRoutes from "./bookings/routes.ts";
import eventRoutes from "./events/routes.ts";
import venueRoutes from "./venues/routes.ts";
import { openApiDocument } from "./openapi.ts";

// The Express app, built once and exported so it can be imported by both the
// server entrypoint (src/server.ts) and the test suite without auto-listening.
export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", uptime: process.uptime() });
});

app.get("/openapi.json", (_req, res) => {
  res.status(200).json(openApiDocument);
});

app.use("/v1/auth", authRoutes);
app.use("/v1/venues", venueRoutes);
app.use("/v1/events", eventRoutes);
app.use("/v1/bookings", bookingRoutes);

// Centralised error handler (Express 5 still invokes 4-arg middleware).
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
