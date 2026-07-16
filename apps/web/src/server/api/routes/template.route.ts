import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  ApiError,
  ApiErrorCode,
  Permission,
  createFilterSchema,
  createLayoutSchema,
  createStickerSchema,
  updateBorderSchema,
  updateLayoutSchema,
  uuidSchema,
} from "@lumora/contracts";
import { getStorage, storageKeys } from "@lumora/core";
import { inspectImage } from "@lumora/image/server";
import { auditRepo, borderRepo, filterRepo, layoutRepo, stickerRepo } from "@lumora/db";
import { mediaService } from "../../services/media.service";
import { notFound, ok, rateLimitBy, requireAuth, requirePermission, forbidden } from "../middleware";
import type { ApiEnv } from "../context";

const BORDER_MAX_BYTES = 8 * 1024 * 1024;

const listQuerySchema = z.object({ eventId: uuidSchema.optional() });

async function serializeBorder(border: NonNullable<Awaited<ReturnType<typeof borderRepo.findById>>>) {
  return {
    id: border.id,
    name: border.name,
    scope: border.organizationId === null ? "GLOBAL" : border.eventId ? "EVENT" : "ORGANIZATION",
    eventId: border.eventId,
    width: border.width,
    height: border.height,
    isActive: border.isActive,
    imageUrl: await mediaService.borderUrl(border),
    createdAt: border.createdAt,
  };
}

export const templateRoute = new Hono<ApiEnv>()
  .use("*", requireAuth)

  // ── Borders ────────────────────────────────────────────────────────────
  .get("/borders", requirePermission(Permission.TEMPLATE_READ), zValidator("query", listQuerySchema), async (c) => {
    const user = c.get("user");
    const { eventId } = c.req.valid("query");
    const borders = await borderRepo.listVisible(user.organizationId, eventId);
    return ok(c, { borders: await Promise.all(borders.map(serializeBorder)) });
  })

  .post(
    "/borders",
    requirePermission(Permission.TEMPLATE_MANAGE),
    rateLimitBy("border-upload", 30, 60),
    async (c) => {
      const user = c.get("user");
      const body = await c.req.parseBody();
      const file = body["file"];
      const name = typeof body["name"] === "string" ? body["name"].trim() : "";
      const eventId = typeof body["eventId"] === "string" && body["eventId"] ? body["eventId"] : null;

      if (!(file instanceof File)) throw new ApiError(ApiErrorCode.VALIDATION, "Border PNG file is required", 422);
      if (name.length < 2) throw new ApiError(ApiErrorCode.VALIDATION, "Name must be at least 2 characters", 422);
      if (file.size > BORDER_MAX_BYTES) throw new ApiError(ApiErrorCode.PAYLOAD_TOO_LARGE, "Border file too large (max 8MB)", 413);

      const buffer = Buffer.from(await file.arrayBuffer());
      const info = await inspectImage(buffer).catch(() => {
        throw new ApiError(ApiErrorCode.VALIDATION, "File is not a valid image", 422);
      });
      if (info.format !== "png") {
        throw new ApiError(ApiErrorCode.VALIDATION, "Borders must be PNG with transparency", 422);
      }

      const border = await borderRepo.create({
        organizationId: user.organizationId,
        eventId,
        name,
        storageKey: "pending",
        width: info.width,
        height: info.height,
        sizeBytes: buffer.length,
        createdById: user.id,
      });
      const key = storageKeys.border(user.organizationId, border.id);
      await getStorage().putObject({ key, body: buffer, contentType: "image/png" });
      const saved = await borderRepo.update(border.id, { storageKey: key });

      await auditRepo.write({
        organizationId: user.organizationId,
        actorType: "USER",
        actorId: user.id,
        actorName: user.name,
        action: "UPLOAD",
        entityType: "border",
        entityId: border.id,
        metadata: { name, eventId },
        ip: c.get("ip"),
      });
      return ok(c, { border: await serializeBorder(saved) }, 201);
    },
  )

  .patch("/borders/:id", requirePermission(Permission.TEMPLATE_MANAGE), zValidator("json", updateBorderSchema), async (c) => {
    const user = c.get("user");
    const border = await borderRepo.findById(c.req.param("id"));
    if (!border) throw notFound();
    if (border.organizationId !== user.organizationId) throw forbidden("Global templates are read-only");
    const updated = await borderRepo.update(border.id, c.req.valid("json"));
    return ok(c, { border: await serializeBorder(updated) });
  })

  .delete("/borders/:id", requirePermission(Permission.TEMPLATE_MANAGE), async (c) => {
    const user = c.get("user");
    const border = await borderRepo.findById(c.req.param("id"));
    if (!border) throw notFound();
    if (border.organizationId !== user.organizationId) throw forbidden("Global templates are read-only");
    await getStorage().deleteObject(border.storageKey);
    await borderRepo.delete(border.id);
    await auditRepo.write({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "DELETE",
      entityType: "border",
      entityId: border.id,
      ip: c.get("ip"),
    });
    return ok(c, { done: true });
  })

  // ── Layouts ────────────────────────────────────────────────────────────
  .get("/layouts", requirePermission(Permission.TEMPLATE_READ), zValidator("query", listQuerySchema), async (c) => {
    const user = c.get("user");
    const { eventId } = c.req.valid("query");
    const layouts = await layoutRepo.listVisible(user.organizationId, eventId);
    return ok(c, {
      layouts: layouts.map((l) => ({
        id: l.id,
        name: l.name,
        mode: l.mode,
        photoCount: l.photoCount,
        config: l.config,
        scope: l.organizationId === null ? "GLOBAL" : l.eventId ? "EVENT" : "ORGANIZATION",
        eventId: l.eventId,
        isActive: l.isActive,
      })),
    });
  })

  .post("/layouts", requirePermission(Permission.TEMPLATE_MANAGE), zValidator("json", createLayoutSchema), async (c) => {
    const user = c.get("user");
    const input = c.req.valid("json");
    const photoCount = Math.max(...input.config.slots.map((s) => s.photoIndex)) + 1;
    const layout = await layoutRepo.create({
      organizationId: user.organizationId,
      eventId: input.eventId ?? null,
      name: input.name,
      mode: input.config.mode,
      photoCount,
      config: input.config,
      createdById: user.id,
    });
    await auditRepo.write({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "CREATE",
      entityType: "layout",
      entityId: layout.id,
      metadata: { name: input.name },
      ip: c.get("ip"),
    });
    return ok(c, { layout }, 201);
  })

  .patch("/layouts/:id", requirePermission(Permission.TEMPLATE_MANAGE), zValidator("json", updateLayoutSchema), async (c) => {
    const user = c.get("user");
    const layout = await layoutRepo.findById(c.req.param("id"));
    if (!layout) throw notFound();
    if (layout.organizationId !== user.organizationId) throw forbidden("Global templates are read-only");
    const input = c.req.valid("json");
    const updated = await layoutRepo.update(layout.id, {
      ...(input.name ? { name: input.name } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.config
        ? {
            config: input.config,
            mode: input.config.mode,
            photoCount: Math.max(...input.config.slots.map((s) => s.photoIndex)) + 1,
          }
        : {}),
    });
    return ok(c, { layout: updated });
  })

  .delete("/layouts/:id", requirePermission(Permission.TEMPLATE_MANAGE), async (c) => {
    const user = c.get("user");
    const layout = await layoutRepo.findById(c.req.param("id"));
    if (!layout) throw notFound();
    if (layout.organizationId !== user.organizationId) throw forbidden("Global templates are read-only");
    await layoutRepo.delete(layout.id);
    return ok(c, { done: true });
  })

  // ── Filters ────────────────────────────────────────────────────────────
  .get("/filters", requirePermission(Permission.TEMPLATE_READ), async (c) => {
    const user = c.get("user");
    const filters = await filterRepo.listVisible(user.organizationId);
    return ok(c, {
      filters: filters.map((f) => ({
        id: f.id,
        name: f.name,
        kind: f.kind,
        params: f.params,
        scope: f.organizationId === null ? "GLOBAL" : "ORGANIZATION",
      })),
    });
  })

  .post("/filters", requirePermission(Permission.TEMPLATE_MANAGE), zValidator("json", createFilterSchema), async (c) => {
    const user = c.get("user");
    const input = c.req.valid("json");
    const filter = await filterRepo.create({
      organizationId: user.organizationId,
      name: input.name,
      kind: input.kind,
      params: input.params,
    });
    return ok(c, { filter }, 201);
  })

  // ── Stickers ───────────────────────────────────────────────────────────
  .get("/stickers", requirePermission(Permission.TEMPLATE_READ), async (c) => {
    const user = c.get("user");
    const stickers = await stickerRepo.listVisible(user.organizationId);
    const urls = await Promise.all(stickers.map((s) => mediaService.stickerUrl(s)));
    return ok(c, {
      stickers: stickers.map((s, i) => ({
        id: s.id,
        name: s.name,
        storageKey: s.storageKey,
        imageUrl: urls[i],
        anchorPoint: s.anchorPoint,
        defaultScale: s.defaultScale,
        defaultOffsetX: s.defaultOffsetX,
        defaultOffsetY: s.defaultOffsetY,
        isActive: s.isActive,
      })),
    });
  })

  .post("/stickers", requirePermission(Permission.TEMPLATE_MANAGE), rateLimitBy("sticker-upload", 30, 60), async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    const file = body["file"];
    const name = typeof body["name"] === "string" ? body["name"].trim() : "";
    const anchorPoint = typeof body["anchorPoint"] === "string" ? body["anchorPoint"] : "FOREHEAD";
    const defaultScale = Number(body["defaultScale"] ?? 1);
    const defaultOffsetX = Number(body["defaultOffsetX"] ?? 0);
    const defaultOffsetY = Number(body["defaultOffsetY"] ?? 0);

    if (!(file instanceof File)) throw new ApiError(ApiErrorCode.VALIDATION, "Sticker PNG file is required", 422);
    if (name.length < 1) throw new ApiError(ApiErrorCode.VALIDATION, "Name is required", 422);

    const buffer = Buffer.from(await file.arrayBuffer());
    const info = await inspectImage(buffer).catch(() => {
      throw new ApiError(ApiErrorCode.VALIDATION, "File is not a valid image", 422);
    });
    if (info.format !== "png") {
      throw new ApiError(ApiErrorCode.VALIDATION, "Stickers must be PNG with transparency", 422);
    }

    const sticker = await stickerRepo.create({
      organizationId: user.organizationId,
      name,
      storageKey: "pending",
      anchorPoint,
      defaultScale,
      defaultOffsetX,
      defaultOffsetY,
      sizeBytes: buffer.length,
      createdById: user.id,
    });
    const key = storageKeys.sticker(user.organizationId, sticker.id);
    await getStorage().putObject({ key, body: buffer, contentType: "image/png" });
    const saved = await stickerRepo.update(sticker.id, { storageKey: key });

    await auditRepo.write({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "UPLOAD",
      entityType: "sticker",
      entityId: sticker.id,
      metadata: { name },
      ip: c.get("ip"),
    });
    return ok(c, { sticker: saved }, 201);
  })

  .delete("/stickers/:id", requirePermission(Permission.TEMPLATE_MANAGE), async (c) => {
    const user = c.get("user");
    const sticker = await stickerRepo.findById(c.req.param("id"));
    if (!sticker) throw notFound();
    if (sticker.organizationId !== user.organizationId) throw forbidden("Global templates are read-only");
    await stickerRepo.delete(sticker.id);
    await auditRepo.write({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "DELETE",
      entityType: "sticker",
      entityId: sticker.id,
      ip: c.get("ip"),
    });
    return ok(c, { done: true });
  });
