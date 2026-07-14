import type { Prisma, TopupStatus } from "@prisma/client";
import { prisma } from "../client";

/**
 * Prepaid wallet ledger. All money is integer IDR.
 * Balance is ALWAYS computed as SUM(amount) — no mutable balance column.
 */
export const billingRepo = {
  async balance(organizationId: string): Promise<number> {
    const agg = await prisma.creditTransaction.aggregate({
      where: { organizationId },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? 0;
  },

  /**
   * Charge a composed session exactly once. Returns the new balance, or
   * null when this session was already charged (idempotent replay).
   */
  async chargeSession(params: {
    organizationId: string;
    sessionId: string;
    amount: number;
    note: string;
  }): Promise<number | null> {
    try {
      await prisma.creditTransaction.create({
        data: {
          organizationId: params.organizationId,
          type: "SESSION_CHARGE",
          amount: -Math.abs(params.amount),
          sessionId: params.sessionId,
          note: params.note,
        },
      });
    } catch (err) {
      // P2002 = unique (sessionId, type) violation -> already charged.
      if ((err as { code?: string }).code === "P2002") return null;
      throw err;
    }
    return this.balance(params.organizationId);
  },

  /** Credit a paid topup exactly once (idempotent by (topupId, type)). */
  async creditTopup(params: {
    organizationId: string;
    topupId: string;
    amount: number;
    note: string;
  }): Promise<boolean> {
    try {
      await prisma.creditTransaction.create({
        data: {
          organizationId: params.organizationId,
          type: "TOPUP",
          amount: Math.abs(params.amount),
          topupId: params.topupId,
          note: params.note,
        },
      });
      return true;
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") return false;
      throw err;
    }
  },

  adjust(params: {
    organizationId: string;
    amount: number;
    note: string;
    createdById?: string;
  }) {
    return prisma.creditTransaction.create({
      data: {
        organizationId: params.organizationId,
        type: "ADJUSTMENT",
        amount: params.amount,
        note: params.note,
        createdById: params.createdById,
      },
    });
  },

  listTransactions(params: { organizationId: string; page: number; pageSize: number }) {
    const where: Prisma.CreditTransactionWhereInput = { organizationId: params.organizationId };
    return prisma.$transaction([
      prisma.creditTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.creditTransaction.count({ where }),
    ]);
  },
};

export const topupRepo = {
  create(data: Prisma.TopupUncheckedCreateInput) {
    return prisma.topup.create({ data });
  },

  findById(id: string) {
    return prisma.topup.findUnique({ where: { id } });
  },

  findByProviderRef(providerRef: string) {
    return prisma.topup.findFirst({ where: { providerRef } });
  },

  findPending(organizationId: string) {
    return prisma.topup.findFirst({
      where: {
        organizationId,
        status: "PENDING",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
    });
  },

  update(id: string, data: Prisma.TopupUncheckedUpdateInput) {
    return prisma.topup.update({ where: { id }, data });
  },

  /** Guarded transition — only PENDING topups can become PAID. */
  async markPaid(id: string): Promise<boolean> {
    const res = await prisma.topup.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "PAID", paidAt: new Date() },
    });
    return res.count === 1;
  },

  markStatus(id: string, status: TopupStatus) {
    return prisma.topup.updateMany({
      where: { id, status: "PENDING" },
      data: { status },
    });
  },

  list(params: { organizationId: string; page: number; pageSize: number }) {
    const where: Prisma.TopupWhereInput = { organizationId: params.organizationId };
    return prisma.$transaction([
      prisma.topup.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
      }),
      prisma.topup.count({ where }),
    ]);
  },

  expireStale() {
    return prisma.topup.updateMany({
      where: { status: "PENDING", expiresAt: { lt: new Date() } },
      data: { status: "EXPIRED" },
    });
  },
};

/** Effective session price: org override, else platform default. */
export async function getSessionPrice(organizationId: string, platformDefault: number): Promise<number> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { sessionPriceIdr: true },
  });
  return org?.sessionPriceIdr ?? platformDefault;
}
