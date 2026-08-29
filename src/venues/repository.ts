import { prisma } from "../db.ts";

export type VenueCreateInput = {
  name: string;
  address: string;
  capacity: number;
  contactEmail: string;
};

export type VenueUpdateInput = {
  name?: string;
  address?: string;
  capacity?: number;
  contactEmail?: string;
};

export async function create(data: VenueCreateInput) {
  return prisma.venue.create({
    data: {
      name: data.name.trim(),
      address: data.address.trim(),
      capacity: data.capacity,
      contactEmail: data.contactEmail.trim(),
    },
  });
}

export async function list(limit?: number) {
  return prisma.venue.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
  });
}

export async function getById(id: string) {
  return prisma.venue.findUnique({ where: { id } });
}

export async function getByName(name: string) {
  return prisma.venue.findUnique({ where: { name } });
}

export async function update(id: string, data: VenueUpdateInput) {
  return prisma.venue.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.address !== undefined && { address: data.address.trim() }),
      ...(data.capacity !== undefined && { capacity: data.capacity }),
      ...(data.contactEmail !== undefined && { contactEmail: data.contactEmail.trim() }),
    },
  });
}

export async function remove(id: string) {
  return prisma.venue.delete({ where: { id } });
}
