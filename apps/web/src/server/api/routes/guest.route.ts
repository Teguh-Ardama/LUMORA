import { Hono } from "hono";
import { ApiError, ApiErrorCode, type GuestGalleryPayload } from "@lumora/contracts";
import { hashToken } from "@lumora/core";
import { deliveryTokenRepo } from "@lumora/db";
import { mediaService } from "../../services/media.service";
import { ok, rateLimitBy } from "../middleware";
import type { ApiEnv } from "../context";

/**
 * Public guest endpoint behind the QR/delivery token (FR-06).
 * No auth cookie — the opaque token IS the credential. Revoked or expired
 * tokens answer 410 GONE so a stale QR clearly reads as "expired".
 */
export const guestRoute = new Hono<ApiEnv>().get(
  "/:token",
  rateLimitBy("guest-view", 60, 60),
  async (c) => {
    const token = c.req.param("token");
    if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) {
      throw new ApiError(ApiErrorCode.NOT_FOUND, "Invalid link", 404);
    }
    const record = await deliveryTokenRepo.findByHash(hashToken(token));
    if (!record) throw new ApiError(ApiErrorCode.NOT_FOUND, "This link does not exist", 404);
    if (record.revokedAt) throw new ApiError(ApiErrorCode.GONE, "This link has been reset by the operator", 410);
    if (record.expiresAt < new Date()) throw new ApiError(ApiErrorCode.GONE, "This link has expired", 410);
    if (!record.session.composedKey) {
      throw new ApiError(ApiErrorCode.NOT_FOUND, "Photos are not ready yet", 404);
    }

    const ttl = Math.max(60, Math.floor((record.expiresAt.getTime() - Date.now()) / 1000));
    const composedUrl = await mediaService.guestUrl(record.session.composedKey, Math.min(ttl, 24 * 3600));
    await deliveryTokenRepo.recordView(record.id);

    const payload: GuestGalleryPayload = {
      eventName: record.session.event.name,
      organizationName: record.session.event.organization.name,
      composedUrl,
      downloadUrl: composedUrl,
      createdAt: record.createdAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
    };
    return ok(c, payload);
  },
);
