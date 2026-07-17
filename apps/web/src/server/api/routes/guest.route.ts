import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { setSignedCookie, getSignedCookie } from "hono/cookie";
import {
  ApiError,
  ApiErrorCode,
  paginationQuerySchema,
  verifyEventPinSchema,
  type GuestGalleryPayload,
  type GuestEventInfo,
  type GuestGalleryListPayload,
} from "@lumora/contracts";
import { hashToken, getEnv } from "@lumora/core";
import { deliveryTokenRepo, prisma } from "@lumora/db";
import { mediaService } from "../../services/media.service";
import { ok, rateLimitBy } from "../middleware";
import type { ApiEnv } from "../context";

/**
 * Public guest endpoints. 
 */
export const guestRoute = new Hono<ApiEnv>()
  .get(
    "/events/:eventKey",
    rateLimitBy("guest-event-info", 60, 60),
    async (c) => {
      const eventKey = c.req.param("eventKey");
      const event = await prisma.event.findFirst({
        where: { eventKey, deletedAt: null },
        include: { organization: true },
      });
      if (!event) throw new ApiError(ApiErrorCode.NOT_FOUND, "Event not found", 404);

      const payload: GuestEventInfo = {
        eventId: event.id,
        eventName: event.name,
        organizationName: event.organization.name,
        requiresPin: !!event.pinCode,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        isLive: event.status === "ACTIVE",
      };
      return ok(c, payload);
    }
  )
  .post(
    "/events/:eventKey/pin",
    rateLimitBy("guest-event-pin", 10, 60),
    zValidator("json", verifyEventPinSchema),
    async (c) => {
      const eventKey = c.req.param("eventKey");
      const { pin } = c.req.valid("json");
      
      const event = await prisma.event.findFirst({
        where: { eventKey, deletedAt: null },
      });
      if (!event) throw new ApiError(ApiErrorCode.NOT_FOUND, "Event not found", 404);
      if (event.pinCode && event.pinCode !== pin) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, "Invalid PIN code", 403);
      }

      const env = getEnv();
      const secret = env.APP_SECRET;
      await setSignedCookie(c, `lumora_guest_${eventKey}`, "1", secret, {
        path: `/`,
        secure: env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "Lax",
        maxAge: 7 * 24 * 3600, // 7 days
      });

      return ok(c, { success: true });
    }
  )
  .get(
    "/events/:eventKey/photos",
    rateLimitBy("guest-event-photos", 60, 60),
    zValidator("query", paginationQuerySchema),
    async (c) => {
      const eventKey = c.req.param("eventKey");
      const q = c.req.valid("query");

      const event = await prisma.event.findFirst({
        where: { eventKey, deletedAt: null },
      });
      if (!event) throw new ApiError(ApiErrorCode.NOT_FOUND, "Event not found", 404);

      if (event.pinCode) {
        const secret = getEnv().APP_SECRET;
        const cookie = await getSignedCookie(c, secret, `lumora_guest_${eventKey}`);
        if (!cookie) {
          throw new ApiError(ApiErrorCode.FORBIDDEN, "PIN required", 403);
        }
      }

      const where = {
        eventId: event.id,
        composedKey: { not: null },
      };

      const [items, total] = await prisma.$transaction([
        prisma.session.findMany({
          where,
          select: { id: true, composedKey: true, composedAt: true },
          orderBy: { composedAt: "desc" },
          skip: (q.page - 1) * q.pageSize,
          take: q.pageSize,
        }),
        prisma.session.count({ where }),
      ]);

      const urls = await Promise.all(items.map((s) => mediaService.guestUrl(s.composedKey!, 3600)));

      const payload: GuestGalleryListPayload = {
        items: items.map((s, i) => ({
          sessionId: s.id,
          composedUrl: urls[i],
          createdAt: s.composedAt!.toISOString(),
        })),
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
      };
      return ok(c, payload);
    }
  )
  .get(
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
    }
  );
