import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { streamSSE } from "hono/streaming";
import {
  Permission,
  assignOperatorsSchema,
  createEventSchema,
  createPairingCodeSchema,
  eventChannel,
  paginationQuerySchema,
  updateEventSchema,
} from "@lumora/contracts";
import { subscribeRealtime, enqueueNotification } from "@lumora/core";
import { auditRepo, bridgeDeviceRepo, photoRepo, prisma } from "@lumora/db";
import { mediaService } from "../../services/media.service";
import { bridgeService } from "../../services/bridge.service";
import { assertEventAccess, notFound, ok, requireAuth, requirePermission } from "../middleware";
import type { ApiEnv } from "../context";

export const eventRoute = new Hono<ApiEnv>()
  .use("*", requireAuth)

  .get("/", requirePermission(Permission.EVENT_READ), zValidator("query", paginationQuerySchema), async (c) => {
    const user = c.get("user");
    const q = c.req.valid("query");
    const where = {
      organizationId: user.organizationId,
      deletedAt: null,
      ...(q.search ? { name: { contains: q.search, mode: "insensitive" as const } } : {}),
      // Operators only see events they're assigned to.
      ...(user.role === "OPERATOR" ? { operators: { some: { userId: user.id } } } : {}),
    };
    const [items, total] = await prisma.$transaction([
      prisma.event.findMany({
        where,
        include: {
          _count: { select: { sessions: true } },
          operators: { include: { user: { select: { id: true, name: true } } } },
        },
        orderBy: { startsAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.event.count({ where }),
    ]);
    return ok(c, {
      items: items.map((e) => ({
        id: e.id,
        name: e.name,
        clientName: e.clientName,
        venue: e.venue,
        status: e.status,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        sessionCount: e._count.sessions,
        operators: e.operators.map((o) => o.user),
      })),
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    });
  })

  .post("/", requirePermission(Permission.EVENT_CREATE), zValidator("json", createEventSchema), async (c) => {
    const user = c.get("user");
    const input = c.req.valid("json");
    const event = await prisma.event.create({
      data: {
        organizationId: user.organizationId,
        name: input.name,
        clientName: input.clientName,
        venue: input.venue,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        defaultBorderId: input.defaultBorderId ?? null,
        defaultLayoutId: input.defaultLayoutId ?? null,
        framesPerSession: input.framesPerSession,
        countdownSeconds: input.countdownSeconds,
        createdById: user.id,
        status: "ACTIVE",
      },
    });
    await auditRepo.write({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "CREATE",
      entityType: "event",
      entityId: event.id,
      metadata: { name: event.name },
      ip: c.get("ip"),
    });
    await enqueueNotification({
      organizationId: user.organizationId,
      kind: "EVENT_CREATED",
      title: "New event",
      body: `${user.name} created "${event.name}"`,
      meta: { eventId: event.id },
    });
    return ok(c, { event }, 201);
  })

  .get("/:id", requirePermission(Permission.EVENT_READ), async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    await assertEventAccess(c, id);
    const event = await prisma.event.findFirst({
      where: { id, organizationId: user.organizationId, deletedAt: null },
      include: {
        defaultBorder: true,
        defaultLayout: true,
        operators: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { sessions: true, photos: true, printJobs: true } },
      },
    });
    if (!event) throw notFound();
    const devices = await bridgeDeviceRepo.listForEvent(id);
    console.log("EVENT RESPONSE IN BACKEND:", { id: event.id, eventKey: event.eventKey });
    return ok(c, {
      event: {
        ...event,
        operators: event.operators.map((o) => o.user),
        bridgeDevices: devices,
      },
    });
  })

  .patch("/:id", requirePermission(Permission.EVENT_UPDATE), zValidator("json", updateEventSchema), async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    await assertEventAccess(c, id);
    const input = c.req.valid("json");
    const event = await prisma.event.update({ where: { id }, data: input });
    await auditRepo.write({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "UPDATE",
      entityType: "event",
      entityId: id,
      metadata: input as Record<string, unknown>,
      ip: c.get("ip"),
    });
    return ok(c, { event });
  })

  .delete("/:id", requirePermission(Permission.EVENT_DELETE), async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    await assertEventAccess(c, id);
    await prisma.event.update({ where: { id }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
    await auditRepo.write({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "DELETE",
      entityType: "event",
      entityId: id,
      ip: c.get("ip"),
    });
    return ok(c, { done: true });
  })

  .put("/:id/operators", requirePermission(Permission.EVENT_UPDATE), zValidator("json", assignOperatorsSchema), async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    await assertEventAccess(c, id);
    const { userIds } = c.req.valid("json");

    // Only org members can be assigned.
    const members = await prisma.membership.findMany({
      where: { organizationId: user.organizationId, userId: { in: userIds }, isActive: true },
      select: { userId: true },
    });
    const validIds = members.map((m) => m.userId);

    await prisma.$transaction([
      prisma.eventOperator.deleteMany({ where: { eventId: id, userId: { notIn: validIds } } }),
      ...validIds.map((userId) =>
        prisma.eventOperator.upsert({
          where: { eventId_userId: { eventId: id, userId } },
          update: {},
          create: { eventId: id, userId },
        }),
      ),
    ]);
    await auditRepo.write({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "UPDATE",
      entityType: "event_operators",
      entityId: id,
      metadata: { userIds: validIds },
      ip: c.get("ip"),
    });
    return ok(c, { operatorIds: validIds });
  })

  .post("/:id/bridge/pairing-code", requirePermission(Permission.BRIDGE_PAIR), zValidator("json", createPairingCodeSchema.pick({})), async (c) => {
    const user = c.get("user");
    const id = c.req.param("id");
    await assertEventAccess(c, id);
    const result = await bridgeService.createPairingCode(user, id);
    return ok(c, result, 201);
  })

  .get("/:id/quarantine", requirePermission(Permission.SESSION_OPERATE), async (c) => {
    const id = c.req.param("id");
    await assertEventAccess(c, id);
    const photos = await photoRepo.listQuarantined(id);
    const urls = await Promise.all(photos.map((p) => mediaService.photoUrl(p)));
    return ok(c, {
      photos: photos.map((p, i) => ({
        id: p.id,
        originalFilename: p.originalFilename,
        capturedAt: p.capturedAt,
        createdAt: p.createdAt,
        url: urls[i],
      })),
    });
  })

  /** Per-event realtime stream for the operator workspace (SSE). */
  .get("/:id/stream", requirePermission(Permission.SESSION_READ), async (c) => {
    const id = c.req.param("id");
    await assertEventAccess(c, id);
    return streamSSE(c, async (stream) => {
      let alive = true;
      const unsubscribe = subscribeRealtime(eventChannel(id), (event) => {
        if (!alive) return;
        void stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
      });
      stream.onAbort(() => {
        alive = false;
        unsubscribe();
      });
      // Heartbeat keeps proxies from closing the stream.
      while (alive) {
        await stream.writeSSE({ event: "ping", data: String(Date.now()) });
        await stream.sleep(25_000);
      }
    });
  });
