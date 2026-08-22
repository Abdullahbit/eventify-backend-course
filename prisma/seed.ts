import "dotenv/config";
import { resolve } from "node:path";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // --- Users ---
  const organizer = await prisma.user.upsert({
    where: { email: "organizer@eventify.dev" },
    update: {},
    create: {
      name: "Orga Nizer",
      email: "organizer@eventify.dev",
      role: "ORGANIZER",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: "admin@eventify.dev" },
    update: {},
    create: {
      name: "Ad Min",
      email: "admin@eventify.dev",
      role: "ADMIN",
    },
  });

  const attendee = await prisma.user.upsert({
    where: { email: "attendee@eventify.dev" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Atten Dee",
      email: "attendee@eventify.dev",
      role: "ATTENDEE",
    },
  });

  // 20 extra users for parallel-bookings script
  const parallelUsers: { id: string }[] = [];
  for (let i = 1; i <= 20; i++) {
    const user = await prisma.user.upsert({
      where: { email: `parallel-user-${i}@eventify.dev` },
      update: {},
      create: {
        name: `Parallel User ${i}`,
        email: `parallel-user-${i}@eventify.dev`,
        role: "ATTENDEE",
      },
    });
    parallelUsers.push(user);
  }

  console.log(`  ✅ Users: ${3 + parallelUsers.length} created/upserted`);

  // --- Events ---
  const event1 = await prisma.event.upsert({
    where: { id: "1f4a1a1a-0000-4000-8000-000000000001" },
    update: {},
    create: {
      id: "1f4a1a1a-0000-4000-8000-000000000001",
      title: "Music Festival 2025",
      description: "A weekend of live music and art.",
      venue: "Central Park",
      startsAt: new Date("2025-09-15T18:00:00Z"),
      capacity: 500,
      priceCents: 5000,
      organizerId: organizer.id,
    },
  });

  const event2 = await prisma.event.upsert({
    where: { id: "1f4a1a1a-0000-4000-8000-000000000002" },
    update: {},
    create: {
      id: "1f4a1a1a-0000-4000-8000-000000000002",
      title: "Tech Conference 2025",
      description: "The latest in web development and AI.",
      venue: "Convention Center",
      startsAt: new Date("2025-10-01T09:00:00Z"),
      capacity: 300,
      priceCents: 10000,
      organizerId: organizer.id,
    },
  });

  await prisma.event.upsert({
    where: { id: "1f4a1a1a-0000-4000-8000-000000000003" },
    update: {},
    create: {
      id: "1f4a1a1a-0000-4000-8000-000000000003",
      title: "Food Expo 2025",
      description: "Taste dishes from top chefs around the world.",
      venue: "Downtown Hall",
      startsAt: new Date("2025-11-10T12:00:00Z"),
      capacity: 200,
      priceCents: 2500,
      organizerId: organizer.id,
    },
  });

  await prisma.event.upsert({
    where: { id: "1f4a1a1a-0000-4000-8000-000000000004" },
    update: {},
    create: {
      id: "1f4a1a1a-0000-4000-8000-000000000004",
      title: "Yoga Retreat",
      description: "A day of mindfulness and relaxation.",
      venue: "Seaside Resort",
      startsAt: new Date("2025-12-05T07:00:00Z"),
      capacity: 50,
      priceCents: 7500,
      organizerId: admin.id,
    },
  });

  // Capacity-5 event for the concurrency test
  const capacityEvent = await prisma.event.upsert({
    where: { id: "1f4a1a1a-0000-4000-8000-000000000005" },
    update: {},
    create: {
      id: "1f4a1a1a-0000-4000-8000-000000000005",
      title: "Capacity Test Event",
      description: "Capacity 5 — used by the parallel-bookings concurrency script.",
      venue: "Test Lab",
      startsAt: new Date("2025-08-20T10:00:00Z"),
      capacity: 5,
      priceCents: 0,
      organizerId: organizer.id,
    },
  });

  console.log(`  ✅ Events: 5 created/upserted`);

  // --- Some bookings ---
  await prisma.booking.upsert({
    where: { userId_eventId: { userId: attendee.id, eventId: event1.id } },
    update: {},
    create: { userId: attendee.id, eventId: event1.id, status: "CONFIRMED" },
  });

  await prisma.booking.upsert({
    where: { userId_eventId: { userId: attendee.id, eventId: event2.id } },
    update: {},
    create: { userId: attendee.id, eventId: event2.id, status: "CONFIRMED" },
  });

  console.log(`  ✅ Bookings: 2 created/upserted`);

  // --- Write the parallel-bookings fixture with the REAL ids ---
  const fixture = {
    baseUrl: "http://localhost:3000",
    eventId: capacityEvent.id,
    capacity: capacityEvent.capacity,
    users: parallelUsers.map((u) => ({ userId: u.id, token: "" })),
  };
  const { writeFile } = await import("node:fs/promises");
  const fixturePath = resolve(process.cwd(), "scripts", "fixtures", "parallel-users.json");
  await writeFile(fixturePath, JSON.stringify(fixture, null, 2) + "\n", "utf-8");
  console.log(`\n💾 Wrote parallel-bookings fixture: ${fixturePath}`);

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
