export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Eventify API",
    version: "1.0.0",
    description: "Event booking and management API built with Express 5, Prisma 7, PostgreSQL, Redis, and BullMQ.",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local development server",
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "15-minute access token carrying actor sub and role claims",
      },
      CookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "refreshToken",
        description: "7-day httpOnly opaque refresh token cookie scoped to /v1/auth/refresh",
      },
    },
    schemas: {
      Role: {
        type: "string",
        enum: ["ATTENDEE", "ORGANIZER", "ADMIN"],
      },
      BookingStatus: {
        type: "string",
        enum: ["CONFIRMED", "CANCELLED", "WAITLISTED"],
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string" },
        },
      },
      LoginResponse: {
        type: "object",
        required: ["accessToken", "user"],
        properties: {
          accessToken: { type: "string" },
          user: {
            type: "object",
            required: ["id", "name", "email", "role"],
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              email: { type: "string", format: "email" },
              role: { $ref: "#/components/schemas/Role" },
            },
          },
        },
      },
      Event: {
        type: "object",
        required: ["id", "title", "description", "startsAt", "capacity", "priceCents", "organizerId", "createdAt"],
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string" },
          description: { type: "string" },
          venue: { type: "string", nullable: true },
          startsAt: { type: "string", format: "date-time" },
          capacity: { type: "integer", minimum: 1 },
          priceCents: { type: "integer", minimum: 0 },
          organizerId: { type: "string", format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateEventRequest: {
        type: "object",
        required: ["title", "description", "startsAt", "capacity", "priceCents"],
        properties: {
          title: { type: "string", minLength: 1 },
          description: { type: "string", minLength: 1 },
          venue: { type: "string" },
          startsAt: { type: "string", format: "date-time" },
          capacity: { type: "integer", minimum: 1 },
          priceCents: { type: "integer", minimum: 0 },
          organizerId: { type: "string", format: "uuid" },
        },
      },
      Booking: {
        type: "object",
        required: ["id", "userId", "eventId", "status", "createdAt"],
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          eventId: { type: "string", format: "uuid" },
          status: { $ref: "#/components/schemas/BookingStatus" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateBookingRequest: {
        type: "object",
        required: ["eventId"],
        properties: {
          eventId: { type: "string", format: "uuid" },
        },
      },
      ErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: { type: "string" },
          details: { type: "object", nullable: true },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "Service Health Check",
        responses: {
          "200": {
            description: "Server is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    uptime: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/v1/auth/login": {
      post: {
        summary: "User Login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Login successful; sets refreshToken cookie and returns access token",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginResponse" },
              },
            },
          },
          "401": {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          "429": {
            description: "Rate limit exceeded (5 requests / 60s per IP)",
          },
        },
      },
    },
    "/v1/auth/refresh": {
      post: {
        summary: "Rotate Refresh Token",
        security: [{ CookieAuth: [] }],
        responses: {
          "200": {
            description: "Token rotated; returns new access token and updates cookie",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    accessToken: { type: "string" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Invalid or revoked refresh token (theft detection)",
          },
        },
      },
    },
    "/v1/events": {
      get: {
        summary: "List Events",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Paginated list of upcoming events (cached via Redis)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Event" },
                    },
                    total: { type: "integer" },
                    page: { type: "integer" },
                    limit: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Create Event",
        security: [{ BearerAuth: [] }],
        description: "Restricted to ORGANIZER or ADMIN roles",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateEventRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Event created successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Event" },
              },
            },
          },
          "401": { description: "Unauthenticated" },
          "403": { description: "Forbidden - Role must be ORGANIZER or ADMIN" },
        },
      },
    },
    "/v1/events/{id}": {
      get: {
        summary: "Get Event by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": {
            description: "Event details (cached via Redis)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Event" },
              },
            },
          },
          "404": { description: "Event not found" },
        },
      },
      patch: {
        summary: "Update Event",
        security: [{ BearerAuth: [] }],
        description: "Restricted to event owner or ADMIN (BOLA check). Invalidates cache.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Event updated" },
          "403": { description: "Forbidden - User does not own event" },
          "404": { description: "Event not found" },
        },
      },
      delete: {
        summary: "Delete Event",
        security: [{ BearerAuth: [] }],
        description: "Restricted to event owner or ADMIN. Invalidates cache.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "204": { description: "Event deleted" },
          "403": { description: "Forbidden" },
        },
      },
    },
    "/v1/bookings": {
      post: {
        summary: "Book Tickets / Join Waitlist",
        security: [{ BearerAuth: [] }],
        description: "Requires authentication. Rate-limited to 10 requests / 60s per user. Creates CONFIRMED booking or WAITLISTED if full.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateBookingRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Booking created (CONFIRMED or WAITLISTED)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Booking" },
              },
            },
          },
          "401": { description: "Unauthenticated" },
          "429": { description: "Rate limit exceeded (10 requests / 60s per user)" },
        },
      },
    },
    "/v1/bookings/{id}": {
      get: {
        summary: "Get Booking Details",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": {
            description: "Booking details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Booking" },
              },
            },
          },
          "404": { description: "Booking not found" },
        },
      },
      delete: {
        summary: "Cancel Booking",
        security: [{ BearerAuth: [] }],
        description: "Cancels a booking (owner-only). Cancelling a CONFIRMED booking enqueues waitlist promotion for the oldest waitlisted attendee.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": {
            description: "Booking cancelled",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Booking" },
              },
            },
          },
          "403": { description: "Forbidden - Cannot cancel another user's booking" },
          "409": { description: "Booking already cancelled" },
        },
      },
    },
  },
};
