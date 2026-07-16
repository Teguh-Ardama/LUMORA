import type { Prisma, SessionStatus } from "@prisma/client";
import { prisma } from "../client";

/** Session with everything the composer / operator screen needs. */
export const sessionWithRelations = {
  border: true,
  layout: true,
  filter: true,
  photos: { where: { status: "UPLOADED" as const }, orderBy: { sequence: "asc" as const }, include: { filter: true } },
  event: { select: { id: true, name: true, organizationId: true, framesPerSession: true } },
  sessionStickers: { include: { sticker: true } },
} satisfies Prisma.SessionInclude;

export type SessionWithRelations = Prisma.SessionGetPayload<{
  include: typeof sessionWithRelations;
}>;

export const sessionRepo = {
  findById(id: string) {
    return prisma.session.findUnique({ where: { id }, include: sessionWithRelations });
  },

  findByIdScoped(id: string, organizationId: string) {
    return prisma.session.findFirst({
      where: { id, organizationId },
      include: sessionWithRelations,
    });
  },

  findByIdempotencyKey(eventId: string, idempotencyKey: string) {
    return prisma.session.findUnique({
      where: { eventId_idempotencyKey: { eventId, idempotencyKey } },
      include: sessionWithRelations,
    });
  },

  /** The single open (non-terminal) session for an event, if any. */
  findActiveForEvent(eventId: string) {
    return prisma.session.findFirst({
      where: { eventId, status: { in: ["CAPTURING", "COMPOSING", "READY"] } },
      orderBy: { startedAt: "desc" },
      include: sessionWithRelations,
    });
  },

  create(data: Prisma.SessionUncheckedCreateInput) {
    return prisma.session.create({ data, include: sessionWithRelations });
  },

  update(id: string, data: Prisma.SessionUncheckedUpdateInput) {
    return prisma.session.update({ where: { id }, data, include: sessionWithRelations });
  },

  /** Atomically transition status; returns null when the guard fails. */
  async transition(id: string, from: SessionStatus[], to: SessionStatus, extra?: Prisma.SessionUncheckedUpdateManyInput) {
    const res = await prisma.session.updateMany({
      where: { id, status: { in: from } },
      data: { status: to, ...extra },
    });
    return res.count === 1 ? prisma.session.findUnique({ where: { id }, include: sessionWithRelations }) : null;
  },

  closeAllForEvent(eventId: string, exceptId?: string) {
    return prisma.session.updateMany({
      where: {
        eventId,
        status: { in: ["CAPTURING", "READY", "FAILED"] },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      data: { status: "CLOSED", closedAt: new Date() },
    });
  },

  list(params: {
    organizationId: string;
    eventId?: string;
    status?: SessionStatus;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.SessionWhereInput = {
      organizationId: params.organizationId,
      ...(params.eventId ? { eventId: params.eventId } : {}),
      ...(params.status ? { status: params.status } : {}),
    };
    return prisma.$transaction([
      prisma.session.findMany({
        where,
        include: sessionWithRelations,
        orderBy: { startedAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.session.count({ where }),
    ]);
  },
};
