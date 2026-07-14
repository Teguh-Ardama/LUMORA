import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { streamSSE } from "hono/streaming";
import {
  Permission,
  analyticsQuerySchema,
  auditQuerySchema,
  orgChannel,
  paginationQuerySchema,
  uuidSchema,
} from "@lumora/contracts";
import { subscribeRealtime } from "@lumora/core";
import { auditRepo, deliveryRepo, notificationRepo } from "@lumora/db";
import { analyticsService } from "../../services/analytics.service";
import { ok, requireAuth, requirePermission } from "../middleware";
import type { ApiEnv } from "../context";

export const analyticsRoute = new Hono<ApiEnv>()
  .use("*", requireAuth)
  .get("/summary", requirePermission(Permission.ANALYTICS_READ), zValidator("query", analyticsQuerySchema), async (c) => {
    const user = c.get("user");
    const summary = await analyticsService.summary(user.organizationId, c.req.valid("query"));
    return ok(c, { summary });
  });

export const auditRoute = new Hono<ApiEnv>()
  .use("*", requireAuth)
  .get("/", requirePermission(Permission.AUDIT_READ), zValidator("query", auditQuerySchema), async (c) => {
    const user = c.get("user");
    const q = c.req.valid("query");
    const [items, total] = await auditRepo.list({
      organizationId: user.organizationId,
      action: q.action,
      entityType: q.entityType,
      actorId: q.actorId,
      from: q.from,
      to: q.to,
      page: q.page,
      pageSize: q.pageSize,
    });
    return ok(c, {
      items,
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    });
  });

export const deliveriesRoute = new Hono<ApiEnv>()
  .use("*", requireAuth)
  .get(
    "/",
    requirePermission(Permission.SESSION_READ),
    zValidator("query", paginationQuerySchema.extend({ eventId: uuidSchema.optional() })),
    async (c) => {
      const user = c.get("user");
      const q = c.req.valid("query");
      const [items, total] = await deliveryRepo.list({
        organizationId: user.organizationId,
        eventId: q.eventId,
        page: q.page,
        pageSize: q.pageSize,
      });
      return ok(c, {
        items: items.map((d) => ({
          id: d.id,
          eventName: d.event.name,
          sessionId: d.sessionId,
          channel: d.channel,
          recipient: d.recipient,
          status: d.status,
          error: d.error,
          sentAt: d.sentAt,
          createdAt: d.createdAt,
        })),
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
      });
    },
  );

export const notificationRoute = new Hono<ApiEnv>()
  .use("*", requireAuth)
  .get(
    "/",
    requirePermission(Permission.NOTIFICATION_READ),
    zValidator("query", paginationQuerySchema.extend({ unreadOnly: z.coerce.boolean().optional() })),
    async (c) => {
      const user = c.get("user");
      const q = c.req.valid("query");
      const [items, total, unreadCount] = await notificationRepo.listForUser({
        userId: user.id,
        organizationId: user.organizationId,
        page: q.page,
        pageSize: q.pageSize,
        unreadOnly: q.unreadOnly,
      });
      return ok(c, {
        items,
        unreadCount,
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
      });
    },
  )
  .post("/read", zValidator("json", z.object({ ids: z.array(uuidSchema).max(100) })), async (c) => {
    const user = c.get("user");
    await notificationRepo.markRead(user.id, c.req.valid("json").ids);
    return ok(c, { done: true });
  })
  .post("/read-all", async (c) => {
    const user = c.get("user");
    await notificationRepo.markAllRead(user.id, user.organizationId);
    return ok(c, { done: true });
  })
  /** Org-wide realtime stream (notification bell). */
  .get("/stream", async (c) => {
    const user = c.get("user");
    return streamSSE(c, async (stream) => {
      let alive = true;
      const unsubscribe = subscribeRealtime(orgChannel(user.organizationId), (event) => {
        if (!alive) return;
        void stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
      });
      stream.onAbort(() => {
        alive = false;
        unsubscribe();
      });
      while (alive) {
        await stream.writeSSE({ event: "ping", data: String(Date.now()) });
        await stream.sleep(25_000);
      }
    });
  });
