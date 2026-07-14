import type { AnalyticsQuery, AnalyticsSummary } from "@lumora/contracts";
import { prisma } from "@lumora/db";

export const analyticsService = {
  async summary(organizationId: string, q: AnalyticsQuery): Promise<AnalyticsSummary> {
    const range = {
      ...(q.from ? { gte: q.from } : {}),
      ...(q.to ? { lte: q.to } : {}),
    };
    const hasRange = q.from || q.to;
    const sessionWhere = {
      organizationId,
      ...(q.eventId ? { eventId: q.eventId } : {}),
      ...(hasRange ? { createdAt: range } : {}),
    };

    const [
      totalEvents,
      totalSessions,
      readySessions,
      failedSessions,
      totalPhotos,
      deliveriesByChannel,
      totalPrintJobs,
      printedJobs,
      composeAgg,
      sessionsPerDayRaw,
      filterUsageRaw,
      captureSplitRaw,
    ] = await Promise.all([
      prisma.event.count({ where: { organizationId, deletedAt: null } }),
      prisma.session.count({ where: sessionWhere }),
      prisma.session.count({ where: { ...sessionWhere, OR: [{ status: "READY" }, { composedAt: { not: null } }] } }),
      prisma.session.count({ where: { ...sessionWhere, status: "FAILED" } }),
      prisma.photo.count({
        where: { organizationId, status: "UPLOADED", ...(q.eventId ? { eventId: q.eventId } : {}), ...(hasRange ? { createdAt: range } : {}) },
      }),
      prisma.delivery.groupBy({
        by: ["channel"],
        where: { organizationId, status: "SENT", ...(q.eventId ? { eventId: q.eventId } : {}), ...(hasRange ? { createdAt: range } : {}) },
        _count: { _all: true },
      }),
      prisma.printJob.count({ where: { organizationId, ...(q.eventId ? { eventId: q.eventId } : {}) } }),
      prisma.printJob.count({ where: { organizationId, status: "PRINTED", ...(q.eventId ? { eventId: q.eventId } : {}) } }),
      prisma.session.aggregate({ where: { ...sessionWhere, composeMs: { not: null } }, _avg: { composeMs: true } }),
      prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
        SELECT date_trunc('day', started_at) AS date, COUNT(*) AS count
        FROM sessions
        WHERE organization_id = ${organizationId}::uuid
          AND started_at > now() - interval '30 days'
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
        SELECT f.name AS name, COUNT(*) AS count
        FROM sessions s JOIN filters f ON f.id = s.filter_id
        WHERE s.organization_id = ${organizationId}::uuid
        GROUP BY f.name ORDER BY count DESC LIMIT 10`,
      prisma.session.groupBy({
        by: ["captureSource"],
        where: sessionWhere,
        _count: { _all: true },
      }),
    ]);

    return {
      totalEvents,
      totalSessions,
      readySessions,
      failedSessions,
      totalPhotos,
      totalDeliveries: deliveriesByChannel.reduce((acc, d) => acc + d._count._all, 0),
      deliveriesByChannel: Object.fromEntries(deliveriesByChannel.map((d) => [d.channel, d._count._all])),
      totalPrintJobs,
      printedJobs,
      avgComposeMs: composeAgg._avg.composeMs ?? null,
      sessionsPerDay: sessionsPerDayRaw.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        count: Number(r.count),
      })),
      filterUsage: filterUsageRaw.map((r) => ({ filterName: r.name, count: Number(r.count) })),
      captureSourceSplit: Object.fromEntries(captureSplitRaw.map((r) => [r.captureSource, r._count._all])),
    };
  },
};
