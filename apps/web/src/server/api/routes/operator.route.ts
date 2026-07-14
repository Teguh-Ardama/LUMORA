import { Hono } from "hono";
import { Permission } from "@lumora/contracts";
import { bridgeDeviceRepo, borderRepo, filterRepo, layoutRepo, prisma, sessionRepo } from "@lumora/db";
import { mediaService } from "../../services/media.service";
import { serializeSession } from "../../services/session.service";
import { assertEventAccess, notFound, ok, requireAuth, requirePermission } from "../middleware";
import type { ApiEnv } from "../context";

/**
 * Operator Workspace bootstrap: everything the capture screen needs in
 * one round-trip — event config, visible templates with preview URLs,
 * filters, the active session, and bridge device health.
 */
export const operatorRoute = new Hono<ApiEnv>()
  .use("*", requireAuth)

  .get("/events", requirePermission(Permission.SESSION_OPERATE), async (c) => {
    const user = c.get("user");
    const events = await prisma.event.findMany({
      where: {
        organizationId: user.organizationId,
        deletedAt: null,
        status: "ACTIVE",
        ...(user.role === "OPERATOR" ? { operators: { some: { userId: user.id } } } : {}),
      },
      orderBy: { startsAt: "asc" },
      select: { id: true, name: true, venue: true, startsAt: true, endsAt: true },
    });
    return ok(c, { events });
  })

  .get("/events/:id/context", requirePermission(Permission.SESSION_OPERATE), async (c) => {
    const user = c.get("user");
    const eventId = c.req.param("id");
    await assertEventAccess(c, eventId);

    const event = await prisma.event.findFirst({
      where: { id: eventId, organizationId: user.organizationId, deletedAt: null },
    });
    if (!event) throw notFound();

    const [borders, layouts, filters, activeSession, devices] = await Promise.all([
      borderRepo.listVisible(user.organizationId, eventId),
      layoutRepo.listVisible(user.organizationId, eventId),
      filterRepo.listVisible(user.organizationId),
      sessionRepo.findActiveForEvent(eventId),
      bridgeDeviceRepo.listForEvent(eventId),
    ]);

    const borderUrls = await Promise.all(borders.map((b) => mediaService.borderUrl(b)));

    return ok(c, {
      event: {
        id: event.id,
        name: event.name,
        venue: event.venue,
        framesPerSession: event.framesPerSession,
        countdownSeconds: event.countdownSeconds,
        defaultBorderId: event.defaultBorderId,
        defaultLayoutId: event.defaultLayoutId,
      },
      borders: borders.map((b, i) => ({
        id: b.id,
        name: b.name,
        width: b.width,
        height: b.height,
        imageUrl: borderUrls[i],
      })),
      layouts: layouts.map((l) => ({
        id: l.id,
        name: l.name,
        mode: l.mode,
        photoCount: l.photoCount,
        config: l.config,
      })),
      filters: filters.map((f) => ({ id: f.id, name: f.name, kind: f.kind, params: f.params })),
      activeSession: activeSession ? await serializeSession(activeSession) : null,
      bridgeDevices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        queueDepth: d.queueDepth,
        lastSeenAt: d.lastSeenAt,
      })),
    });
  });
