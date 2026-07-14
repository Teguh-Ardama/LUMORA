import type { Prisma } from "@prisma/client";
import { prisma } from "../client";

export const bridgeDeviceRepo = {
  findById: (id: string) => prisma.bridgeDevice.findUnique({ where: { id } }),

  findByTokenHash(tokenHash: string) {
    return prisma.bridgeDevice.findUnique({ where: { tokenHash } });
  },

  create(data: Prisma.BridgeDeviceUncheckedCreateInput) {
    return prisma.bridgeDevice.create({ data });
  },

  heartbeat(id: string, data: { queueDepth: number; watchedFolder?: string | null }) {
    return prisma.bridgeDevice.update({
      where: { id },
      data: {
        status: "ONLINE",
        lastSeenAt: new Date(),
        queueDepth: data.queueDepth,
        watchedFolder: data.watchedFolder ?? undefined,
      },
    });
  },

  revoke(id: string) {
    return prisma.bridgeDevice.update({
      where: { id },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
  },

  listForEvent(eventId: string) {
    return prisma.bridgeDevice.findMany({
      where: { eventId, status: { not: "REVOKED" } },
      orderBy: { createdAt: "desc" },
    });
  },

  /** Devices silent past the threshold get flipped OFFLINE (cleanup worker). */
  markStale(thresholdMs: number) {
    return prisma.bridgeDevice.updateMany({
      where: { status: "ONLINE", lastSeenAt: { lt: new Date(Date.now() - thresholdMs) } },
      data: { status: "OFFLINE" },
    });
  },
};
