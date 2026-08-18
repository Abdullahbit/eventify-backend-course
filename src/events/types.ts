export type EventQuery = {
  page?: number;
  limit?: number;
  venue?: string;
  from?: string;
  to?: string;
};

export type CreateEventInput = {
  title: string;
  description: string;
  venue: string | null;
  startsAt: string;
  capacity: number;
  priceCents: number;
  organizerId: string;
};

export type UpdateEventInput = Partial<CreateEventInput>;
