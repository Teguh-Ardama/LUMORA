import type { Prisma } from "@prisma/client";
import { prisma } from "../client";

export const notificationRepo = {
  /** Fan a notification out to specific users (or all active org members). */
  async fanOut(params: {
    organizationId: string;
    kind: string;
    title: string;
    body: string;
    meta?: Record<string, unknown>;
    userIds?: string[];
  }) {
    let userIds = params.userIds;
    if (!userIds) {
      const members = await prisma.membership.findMany({
        where: { organizationId: params.organizationId, isActive: true },
        select: { userId: true },
      });
      userIds = members.map((m) => m.userId);
    }
    if (userIds.length === 0) return [];
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        organizationId: params.organizationId,
        userId,
        kind: params.kind,
        title: params.title,
        body: params.body,
        meta: (params.meta as Prisma.InputJsonValue) ?? undefined,
      })),
    });
    return userIds;
  },

  listForUser(params: { userId: string; organizationId: string; page: number; pageSize: number; unreadOnly?: boolean }) {
    const where: Prisma.NotificationWhereInput = {
      userId: params.userId,
      organizationId: params.organizationId,
      ...(params.unreadOnly ? { readAt: null } : {}),
    };
    return prisma.$transaction([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: params.userId, organizationId: params.organizationId, readAt: null } }),
    ]);
  },

  markRead(userId: string, ids: string[]) {
    return prisma.notification.updateMany({
      where: { userId, id: { in: ids }, readAt: null },
      data: { readAt: new Date() },
    });
  },

  markAllRead(userId: string, organizationId: string) {
    return prisma.notification.updateMany({
      where: { userId, organizationId, readAt: null },
      data: { readAt: new Date() },
    });
  },
};
