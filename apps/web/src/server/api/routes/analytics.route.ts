import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { Permission, uuidSchema } from "@lumora/contracts";
import { prisma } from "@lumora/db";
import { ok, requireAuth, requirePermission } from "../middleware";
import type { ApiEnv } from "../context";

const eventQuerySchema = z.object({ eventId: uuidSchema });

export const eventAnalyticsRoute = new Hono<ApiEnv>()
  .use("*", requireAuth)
  .get("/event", requirePermission(Permission.EVENT_READ), zValidator("query", eventQuerySchema), async (c) => {
    const user = c.get("user");
    const { eventId } = c.req.valid("query");

    // Aggregate sessions for the event
    const sessions = await prisma.session.findMany({
      where: { eventId, organizationId: user.organizationId },
      select: {
        status: true,
        startedAt: true,
        closedAt: true,
        composeMs: true,
        captureHardware: true,
        filter: { select: { name: true } },
      },
    });

    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.status === "CLOSED" || s.status === "READY").length;
    const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;
    
    let totalComposeMs = 0;
    let composeCount = 0;
    const filterPopularity: Record<string, number> = {};

    sessions.forEach(s => {
      if (s.composeMs) {
        totalComposeMs += s.composeMs;
        composeCount++;
      }
      if (s.filter?.name) {
        filterPopularity[s.filter.name] = (filterPopularity[s.filter.name] || 0) + 1;
      }
    });

    const averageComposeMs = composeCount > 0 ? totalComposeMs / composeCount : 0;

    return ok(c, {
      totalSessions,
      completedSessions,
      completionRate,
      averageComposeMs,
      filterPopularity,
    });
  });
