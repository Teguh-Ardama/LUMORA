import type { DeliveryChannel, DeliveryStatus, Prisma } from "@prisma/client";
import { prisma } from "../client";

export const deliveryTokenRepo = {
  create(data: { sessionId: string; tokenHash: string; expiresAt: Date }) {
    return prisma.deliveryToken.create({ data });
  },

  findByHash(tokenHash: string) {
    return prisma.deliveryToken.findUnique({
      where: { tokenHash },
      include: {
        session: {
          include: {
            event: { select: { name: true, organization: { select: { name: true } } } },
          },
        },
      },
    });
  },

  /** FR-06: kill every live token for a session the moment a new one starts. */
  revokeForSession(sessionId: string) {
    return prisma.deliveryToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  revokeForEvent(eventId: string) {
    return prisma.deliveryToken.updateMany({
      where: { session: { eventId }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  recordView(id: string) {
    return prisma.deliveryToken.update({
      where: { id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    });
  },

  deleteExpired() {
    return prisma.deliveryToken.deleteMany({
      where: { expiresAt: { lt: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
    });
  },
};

export const deliveryRepo = {
  create(data: Prisma.DeliveryUncheckedCreateInput) {
    return prisma.delivery.create({ data });
  },

  findById(id: string) {
    return prisma.delivery.findUnique({
      where: { id },
      include: { session: true, event: { select: { name: true } } },
    });
  },

  markSent(id: string) {
    return prisma.delivery.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date(), error: null },
    });
  },

  markFailed(id: string, error: string) {
    return prisma.delivery.update({
      where: { id },
      data: { status: "FAILED", error: error.slice(0, 1000) },
    });
  },

  list(params: {
    organizationId: string;
    eventId?: string;
    channel?: DeliveryChannel;
    status?: DeliveryStatus;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.DeliveryWhereInput = {
      organizationId: params.organizationId,
      ...(params.eventId ? { eventId: params.eventId } : {}),
      ...(params.channel ? { channel: params.channel } : {}),
      ...(params.status ? { status: params.status } : {}),
    };
    return prisma.$transaction([
      prisma.delivery.findMany({
        where,
        include: { event: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.delivery.count({ where }),
    ]);
  },
};

export const printJobRepo = {
  create(data: Prisma.PrintJobUncheckedCreateInput) {
    return prisma.printJob.create({ data, include: { session: true } });
  },

  findById(id: string) {
    return prisma.printJob.findUnique({ where: { id }, include: { session: true } });
  },

  update(id: string, data: Prisma.PrintJobUncheckedUpdateInput) {
    return prisma.printJob.update({ where: { id }, data, include: { session: true } });
  },

  list(params: { organizationId: string; eventId?: string; page: number; pageSize: number }) {
    const where: Prisma.PrintJobWhereInput = {
      organizationId: params.organizationId,
      ...(params.eventId ? { eventId: params.eventId } : {}),
    };
    return prisma.$transaction([
      prisma.printJob.findMany({
        where,
        include: {
          session: { select: { id: true, composedKey: true, guestName: true } },
          event: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.printJob.count({ where }),
    ]);
  },
};
