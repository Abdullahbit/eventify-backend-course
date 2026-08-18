/**
 * Idempotent seed script for Eventify (Session 3).
 *
 * Creates:
 * - 3 users (ORGANIZER, ADMIN, ATTENDEE)
 * - 20 extra users for the parallel-bookings script
 * - 5 events (1 with capacity 5 for the concurrency test)
 * - Some bookings
 *
 * Uses upsert so it can run multiple times without duplicates.
 */
import "dotenv/config";
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
    where: { id: "evt-music-fest-001" },
    update: {},
    create: {
      id: "evt-music-fest-001",
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
    where: { id: "evt-tech-conf-002" },
    update: {},
    create: {
      id: "evt-tech-conf-002",
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
    where: { id: "evt-food-expo-003" },
    update: {},
    create: {
      id: "evt-food-expo-003",
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
    where: { id: "evt-yoga-retreat-004" },
    update: {},
    create: {
      id: "evt-yoga-retreat-004",
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
    where: { id: "evt-capacity-test-005" },
    update: {},
    create: {
      id: "evt-capacity-test-005",
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

  // --- Print info for parallel-bookings fixture ---
  console.log("\n📋 Parallel-bookings fixture data:");
  console.log(`   baseUrl:    http://localhost:3000`);
  console.log(`   eventId:    ${capacityEvent.id}`);
  console.log(`   capacity:   ${capacityEvent.capacity}`);
  console.log(`   Users:`);
  for (const user of parallelUsers) {
    console.log(`     ${user.id}`);
  }

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
