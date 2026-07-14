import type { Prisma } from "@prisma/client";
import { prisma } from "../client";

export interface AuditWriteInput {
  organizationId: string;
  actorType: "USER" | "BRIDGE" | "SYSTEM";
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

export const auditRepo = {
  /** Fire-and-forget friendly: audit failures must never break the request. */
  async write(input: AuditWriteInput): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          organizationId: input.organizationId,
          actorType: input.actorType,
          actorId: input.actorId ?? null,
          actorName: input.actorName ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
          ip: input.ip ?? null,
        },
      });
    } catch (err) {
      console.error("[audit] write failed", err);
    }
  },

  list(params: {
    organizationId: string;
    action?: string;
    entityType?: string;
    actorId?: string;
    from?: Date;
    to?: Date;
    page: number;
    pageSize: number;
  }) {
    const where: Prisma.AuditLogWhereInput = {
      organizationId: params.organizationId,
      ...(params.action ? { action: params.action } : {}),
      ...(params.entityType ? { entityType: params.entityType } : {}),
      ...(params.actorId ? { actorId: params.actorId } : {}),
      ...(params.from || params.to
        ? { createdAt: { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lte: params.to } : {}) } }
        : {}),
    };
    return prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);
  },
};
