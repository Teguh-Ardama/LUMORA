import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  ApiError,
  ApiErrorCode,
  Permission,
  createPrintJobSchema,
  paginationQuerySchema,
  requestDeliverySchema,
  startSessionSchema,
  updatePrintJobSchema,
  updateSessionSchema,
  uploadPhotoFieldsSchema,
  uuidSchema,
  eventChannel,
} from "@lumora/contracts";
import { publishRealtime } from "@lumora/core";
import { photoRepo, printJobRepo, sessionRepo } from "@lumora/db";
import { serializeSession, sessionService } from "../../services/session.service";
import { mediaService } from "../../services/media.service";
import { assertEventAccess, notFound, ok, rateLimitBy, requireAuth, requirePermission } from "../middleware";
import type { ApiEnv } from "../context";

export const sessionRoute = new Hono<ApiEnv>()
  .use("*", requireAuth)

  .get(
    "/",
    requirePermission(Permission.SESSION_READ),
    zValidator("query", paginationQuerySchema.extend({ eventId: uuidSchema.optional() })),
    async (c) => {
      const user = c.get("user");
      const q = c.req.valid("query");
      if (q.eventId) await assertEventAccess(c, q.eventId);
      const [items, total] = await sessionRepo.list({
        organizationId: user.organizationId,
        eventId: q.eventId,
        page: q.page,
        pageSize: q.pageSize,
      });
      return ok(c, {
        items: await Promise.all(items.map(serializeSession)),
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
      });
    },
  )

  .post("/", requirePermission(Permission.SESSION_OPERATE), zValidator("json", startSessionSchema), async (c) => {
    const user = c.get("user");
    const input = c.req.valid("json");
    await assertEventAccess(c, input.eventId);
    const session = await sessionService.start(user, input);
    return ok(c, { session }, 201);
  })

  .get("/:id", requirePermission(Permission.SESSION_READ), async (c) => {
    const user = c.get("user");
    const session = await sessionRepo.findByIdScoped(c.req.param("id"), user.organizationId);
    if (!session) throw notFound();
    await assertEventAccess(c, session.eventId);
    return ok(c, { session: await serializeSession(session) });
  })

  .patch("/:id", requirePermission(Permission.SESSION_OPERATE), zValidator("json", updateSessionSchema), async (c) => {
    const user = c.get("user");
    const session = await sessionService.update(user, c.req.param("id"), c.req.valid("json"));
    return ok(c, { session });
  })

  .post(
    "/:id/photos",
    requirePermission(Permission.SESSION_OPERATE),
    rateLimitBy("photo-upload", 120, 60, (c) => c.get("user").id),
    async (c) => {
      const user = c.get("user");
      const body = await c.req.parseBody();
      const file = body["file"];
      if (!(file instanceof File)) throw new ApiError(ApiErrorCode.VALIDATION, "Photo file is required", 422);
      const fields = uploadPhotoFieldsSchema.parse({
        sequence: body["sequence"],
        idempotencyKey: body["idempotencyKey"],
        capturedAt: body["capturedAt"] || undefined,
      });
      const photo = await sessionService.uploadPhoto(
        user,
        c.req.param("id"),
        { buffer: Buffer.from(await file.arrayBuffer()), mime: file.type },
        fields,
      );
      return ok(c, { photoId: photo.id, sequence: photo.sequence }, 201);
    },
  )

  .post(
    "/:id/compose",
    requirePermission(Permission.SESSION_OPERATE),
    zValidator(
      "json",
      z.object({
        appliedStickers: z
          .array(
            z.object({
              id: z.string(),
              stickerId: uuidSchema,
              x: z.number(),
              y: z.number(),
              width: z.number(),
              height: z.number(),
              rotation: z.number(),
            }),
          )
          .optional(),
      }).optional(),
    ),
    async (c) => {
      const user = c.get("user");
      const input = c.req.valid("json") || {};
      const session = await sessionService.requestCompose(user, c.req.param("id"), input.appliedStickers);
      return ok(c, { session });
    },
  )

  .post("/:id/qr", requirePermission(Permission.SESSION_OPERATE), async (c) => {
    const user = c.get("user");
    const result = await sessionService.mintQrToken(user, c.req.param("id"));
    return ok(c, result, 201);
  })

  .post("/:id/deliveries", requirePermission(Permission.SESSION_OPERATE), zValidator("json", requestDeliverySchema), async (c) => {
    const user = c.get("user");
    const result = await sessionService.requestDelivery(user, c.req.param("id"), c.req.valid("json"));
    return ok(c, result, 201);
  })

  .post("/:id/print", requirePermission(Permission.PRINT_OPERATE), zValidator("json", createPrintJobSchema.pick({ copies: true })), async (c) => {
    const user = c.get("user");
    const { copies } = c.req.valid("json");
    const job = await sessionService.createPrintJob(user, c.req.param("id"), copies);
    return ok(c, { job }, 201);
  })

  /** Operator attaches a quarantined DSLR photo to the active session. */
  .post(
    "/:id/attach-photo",
    requirePermission(Permission.SESSION_OPERATE),
    zValidator("json", z.object({ photoId: uuidSchema, sequence: z.number().int().min(0).max(11) })),
    async (c) => {
      const user = c.get("user");
      const { photoId, sequence } = c.req.valid("json");
      const session = await sessionRepo.findByIdScoped(c.req.param("id"), user.organizationId);
      if (!session) throw notFound();
      if (session.status !== "CAPTURING") throw new ApiError(ApiErrorCode.VALIDATION, "Session is not capturing", 422);
      const photo = await photoRepo.findById(photoId);
      if (!photo || photo.eventId !== session.eventId || photo.status !== "QUARANTINED") throw notFound();
      const attached = await photoRepo.attachToSession(photoId, session.id, sequence);
      await publishRealtime(eventChannel(session.eventId), {
        type: "session.photo",
        sessionId: session.id,
        photoId: attached.id,
        sequence: attached.sequence,
        source: "BRIDGE",
      });
      return ok(c, { photoId: attached.id, sequence: attached.sequence });
    },
  );

// ── Print jobs (list + status updates from the print station) ────────────
export const printRoute = new Hono<ApiEnv>()
  .use("*", requireAuth)

  .get(
    "/",
    requirePermission(Permission.SESSION_READ),
    zValidator("query", paginationQuerySchema.extend({ eventId: uuidSchema.optional() })),
    async (c) => {
      const user = c.get("user");
      const q = c.req.valid("query");
      const [items, total] = await printJobRepo.list({
        organizationId: user.organizationId,
        eventId: q.eventId,
        page: q.page,
        pageSize: q.pageSize,
      });
      // Signed print asset URLs so the queue manager can reprint any job.
      const composedUrls = await Promise.all(
        items.map((j) =>
          j.session.composedKey
            ? mediaService.composedUrl({ composedKey: j.session.composedKey })
            : Promise.resolve(null),
        ),
      );
      return ok(c, {
        items: items.map((j, i) => ({
          id: j.id,
          eventName: j.event.name,
          sessionId: j.sessionId,
          guestName: j.session.guestName,
          copies: j.copies,
          status: j.status,
          failureReason: j.failureReason,
          composedUrl: composedUrls[i],
          createdAt: j.createdAt,
          printedAt: j.printedAt,
        })),
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
      });
    },
  )

  .patch("/:id", requirePermission(Permission.PRINT_OPERATE), zValidator("json", updatePrintJobSchema), async (c) => {
    const user = c.get("user");
    const input = c.req.valid("json");
    const job = await printJobRepo.findById(c.req.param("id"));
    if (!job || job.organizationId !== user.organizationId) throw notFound();
    const updated = await printJobRepo.update(job.id, {
      status: input.status,
      failureReason: input.failureReason,
      ...(input.status === "PRINTED" ? { printedAt: new Date() } : {}),
    });
    await publishRealtime(eventChannel(job.eventId), {
      type: "print.status",
      printJobId: job.id,
      sessionId: job.sessionId,
      status: input.status,
    });
    return ok(c, { job: { id: updated.id, status: updated.status } });
  });
