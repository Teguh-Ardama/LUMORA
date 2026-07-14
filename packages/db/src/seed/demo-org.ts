import { hashPassword } from "@lumora/core";
import { prisma } from "../client";
import type { Border, Layout } from "@prisma/client";

const DEMO_PASSWORD = "Lumora123!";

export async function seedDemoOrg(deps: { layouts: Layout[]; borders: Border[] }) {
  if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO !== "true") {
    console.log("↷ demo org skipped in production (set SEED_DEMO=true to force)");
    return;
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const admin = await prisma.user.upsert({
    where: { email: "admin@lumora.dev" },
    update: {},
    create: { email: "admin@lumora.dev", name: "Demo Admin", passwordHash },
  });
  const operator = await prisma.user.upsert({
    where: { email: "operator@lumora.dev" },
    update: {},
    create: { email: "operator@lumora.dev", name: "Demo Operator", passwordHash },
  });

  let org = await prisma.organization.findUnique({ where: { slug: "lumora-demo" } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: "Lumora Demo Studio", slug: "lumora-demo", supportEmail: "support@lumora.dev" },
    });
  }

  for (const [userId, role] of [
    [admin.id, "OWNER"],
    [operator.id, "OPERATOR"],
  ] as const) {
    await prisma.membership.upsert({
      where: { userId_organizationId: { userId, organizationId: org.id } },
      update: {},
      create: { userId, organizationId: org.id, role },
    });
  }

  const gridLayout = deps.layouts.find((l) => l.name.startsWith("Grid 4"));
  const whiteBorder = deps.borders.find((b) => b.name.startsWith("Classic White"));

  let event = await prisma.event.findFirst({ where: { organizationId: org.id, name: "Demo Wedding Expo" } });
  if (!event) {
    event = await prisma.event.create({
      data: {
        organizationId: org.id,
        name: "Demo Wedding Expo",
        clientName: "Internal Demo",
        venue: "Grand Ballroom",
        status: "ACTIVE",
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        defaultLayoutId: gridLayout?.id,
        defaultBorderId: whiteBorder?.id,
        framesPerSession: 4,
        countdownSeconds: 3,
        createdById: admin.id,
      },
    });
  }

  await prisma.eventOperator.upsert({
    where: { eventId_userId: { eventId: event.id, userId: operator.id } },
    update: {},
    create: { eventId: event.id, userId: operator.id },
  });

  // Welcome credit so a fresh install can run sessions immediately.
  const existingCredit = await prisma.creditTransaction.findFirst({
    where: { organizationId: org.id, type: "ADJUSTMENT", note: "Welcome credit" },
  });
  if (!existingCredit) {
    await prisma.creditTransaction.create({
      data: {
        organizationId: org.id,
        type: "ADJUSTMENT",
        amount: 100_000,
        note: "Welcome credit",
        createdById: admin.id,
      },
    });
  }
}
