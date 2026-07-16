import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  ApiError,
  ApiErrorCode,
  Permission,
  uuidSchema,
} from "@lumora/contracts";
import { getStorage, storageKeys } from "@lumora/core";
import { inspectImage } from "@lumora/image/server";
import { auditRepo, stickerRepo } from "@lumora/db";
import { ok, rateLimitBy, requireAuth, requirePermission, forbidden, notFound } from "../middleware";
import type { ApiEnv } from "../context";
import { getEnv } from "@lumora/core";

const STICKER_MAX_BYTES = 2 * 1024 * 1024;

async function serializeSticker(sticker: any) {
  const url = await getStorage().getSignedUrl(sticker.storageKey, 3600);
  return {
    id: sticker.id,
    name: sticker.name,
    anchorPoint: sticker.anchorPoint,
    defaultScale: sticker.defaultScale,
    defaultOffsetX: sticker.defaultOffsetX,
    defaultOffsetY: sticker.defaultOffsetY,
    url,
  };
}

export const stickerRoute = new Hono<ApiEnv>()
  .use("*", requireAuth)
  .get("/", requirePermission(Permission.TEMPLATE_READ), async (c) => {
    const user = c.get("user");
    const eventId = c.req.query("eventId");
    const stickers = await stickerRepo.listVisible(user.organizationId, eventId);
    return ok(c, { stickers: await Promise.all(stickers.map(serializeSticker)) });
  })
  .post(
    "/",
    requirePermission(Permission.TEMPLATE_MANAGE),
    rateLimitBy("sticker-upload", 30, 60),
    async (c) => {
      const user = c.get("user");
      const body = await c.req.parseBody();
      const file = body["file"];
      const name = typeof body["name"] === "string" ? body["name"].trim() : "";
      const eventId = typeof body["eventId"] === "string" && body["eventId"] ? body["eventId"] : null;
      const anchorPoint = typeof body["anchorPoint"] === "string" ? body["anchorPoint"] : "FULL_FACE";

      if (!(file instanceof File)) throw new ApiError(ApiErrorCode.VALIDATION, "Sticker PNG file is required", 422);
      if (name.length < 2) throw new ApiError(ApiErrorCode.VALIDATION, "Name must be at least 2 characters", 422);
      if (file.size > STICKER_MAX_BYTES) throw new ApiError(ApiErrorCode.PAYLOAD_TOO_LARGE, "Sticker file too large (max 2MB)", 413);

      const buffer = Buffer.from(await file.arrayBuffer());
      const info = await inspectImage(buffer).catch(() => {
        throw new ApiError(ApiErrorCode.VALIDATION, "File is not a valid image", 422);
      });
      if (info.format !== "png") {
        throw new ApiError(ApiErrorCode.VALIDATION, "Stickers must be PNG with transparency", 422);
      }

      const sticker = await stickerRepo.create({
        organizationId: user.organizationId,
        eventId,
        name,
        storageKey: "pending",
        sizeBytes: buffer.length,
        anchorPoint: anchorPoint as any,
        defaultScale: 1.0,
        defaultOffsetX: 0,
        defaultOffsetY: 0,
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
        metadata: { name, eventId },
        ip: c.get("ip"),
      });
      
      return ok(c, { sticker: await serializeSticker(saved) }, 201);
    },
  )
  .delete("/:id", requirePermission(Permission.TEMPLATE_MANAGE), async (c) => {
    const user = c.get("user");
    const sticker = await stickerRepo.findById(c.req.param("id"));
    if (!sticker) throw notFound();
    if (sticker.organizationId !== user.organizationId) throw forbidden("Global templates are read-only");
    
    await getStorage().deleteObject(sticker.storageKey);
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
