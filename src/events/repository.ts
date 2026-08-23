import { prisma } from "../db.ts";
import type { Prisma } from "../generated/prisma/client.ts";

export type EventWhereInput = {
  venue?: string;
  from?: string;
  to?: string;
};

export type EventCreateInput = {
  title: string;
  description: string;
  venue?: string | null;
  startsAt: string;
  capacity: number;
  priceCents?: number;
  organizerId: string;
};

export type EventUpdateInput = {
  title?: string;
  description?: string;
  venue?: string | null;
  startsAt?: string;
  capacity?: number;
  priceCents?: number;
  organizerId?: string;
};

export async function create(data: EventCreateInput) {
  return prisma.event.create({
    data: {
      title: data.title,
      description: data.description,
      venue: data.venue ?? null,
      startsAt: new Date(data.startsAt),
      capacity: data.capacity,
      priceCents: data.priceCents ?? 0,
      organizerId: data.organizerId,
    },
  });
}

export async function list(
  page: number,
  limit: number,
  filters: EventWhereInput,
) {
  const where: Prisma.EventWhereInput = {};

  if (filters.venue !== undefined) {
    where.venue = filters.venue;
  }

  if (filters.from !== undefined || filters.to !== undefined) {
    where.startsAt = {};
    if (filters.from !== undefined) {
      where.startsAt.gte = new Date(filters.from);
    }
    if (filters.to !== undefined) {
      where.startsAt.lte = new Date(filters.to);
    }
  }

  const [data, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { startsAt: "asc" },
    }),
    prisma.event.count({ where }),
  ]);

  return { data, total };
}

export async function getById(
  id: string,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
) {
  const db = tx ?? prisma;
  return db.event.findUnique({ where: { id } });
}

export async function update(id: string, data: EventUpdateInput) {
  const updateData: Prisma.EventUpdateInput = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.venue !== undefined) updateData.venue = data.venue;
  if (data.startsAt !== undefined) updateData.startsAt = new Date(data.startsAt);
  if (data.capacity !== undefined) updateData.capacity = data.capacity;
  if (data.priceCents !== undefined) updateData.priceCents = data.priceCents;
  if (data.organizerId !== undefined) updateData.organizer = { connect: { id: data.organizerId } };

  return prisma.event.update({ where: { id }, data: updateData });
}

export async function remove(id: string) {
  return prisma.event.delete({ where: { id } });
}
