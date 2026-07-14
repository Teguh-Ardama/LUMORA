import type { Prisma } from "@prisma/client";
import { prisma } from "../client";

export const photoRepo = {
  findById(id: string) {
    return prisma.photo.findUnique({ where: { id } });
  },

  findByIdempotencyKey(eventId: string, idempotencyKey: string) {
    return prisma.photo.findUnique({
      where: { eventId_idempotencyKey: { eventId, idempotencyKey } },
    });
  },

  create(data: Prisma.PhotoUncheckedCreateInput) {
    return prisma.photo.create({ data });
  },

  countForSession(sessionId: string) {
    return prisma.photo.count({ where: { sessionId, status: "UPLOADED" } });
  },

  listForSession(sessionId: string) {
    return prisma.photo.findMany({
      where: { sessionId, status: "UPLOADED" },
      orderBy: { sequence: "asc" },
    });
  },

  listQuarantined(eventId: string) {
    return prisma.photo.findMany({
      where: { eventId, status: "QUARANTINED" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  /** Attach a quarantined bridge photo to a session (operator rescue flow). */
  attachToSession(photoId: string, sessionId: string, sequence: number) {
    return prisma.photo.update({
      where: { id: photoId },
      data: { sessionId, sequence, status: "UPLOADED" },
    });
  },

  discard(photoId: string) {
    return prisma.photo.update({ where: { id: photoId }, data: { status: "DISCARDED" } });
  },

  listForEvent(params: { eventId: string; page: number; pageSize: number }) {
    const where: Prisma.PhotoWhereInput = { eventId: params.eventId, status: "UPLOADED" };
    return prisma.$transaction([
      prisma.photo.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.photo.count({ where }),
    ]);
  },
};
