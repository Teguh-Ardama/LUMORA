import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import archiver from "archiver";
import { PassThrough, Readable } from "node:stream";
import {
  Permission,
  paginationQuerySchema,
  uuidSchema,
} from "@lumora/contracts";
import { getStorage, getEnv } from "@lumora/core";
import { prisma } from "@lumora/db";
import { mediaService } from "../../services/media.service";
import { assertEventAccess, notFound, ok, rateLimitBy, requireAuth, requirePermission } from "../middleware";
import type { ApiEnv } from "../context";

/**
 * Gallery & Downloads: composed results per event, lightbox data, and a
 * streamed ZIP export of every composed photo of an event.
 */
export const galleryRoute = new Hono<ApiEnv>()
  /** Serve local storage files (dev mode). */
  .get("/files", async (c) => {
    const key = c.req.query("key");
    if (!key) return c.notFound();
    const safeKey = key.replace(/\.\./g, "");
    const filePath = path.resolve(getEnv().LOCAL_STORAGE_DIR, safeKey);
    try {
      const buffer = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "application/octet-stream";
      return new Response(buffer, { headers: { "Content-Type": mime, "Cache-Control": "public, max-age=86400" } });
    } catch {
      return c.notFound();
    }
  })
  .use("*", requireAuth)

  .get(
    "/",
    requirePermission(Permission.GALLERY_READ),
    zValidator("query", paginationQuerySchema.extend({ eventId: uuidSchema.optional() })),
    async (c) => {
      const user = c.get("user");
      const q = c.req.valid("query");
      if (q.eventId) await assertEventAccess(c, q.eventId);
      const where = {
        organizationId: user.organizationId,
        composedKey: { not: null },
        ...(q.eventId ? { eventId: q.eventId } : {}),
      };
      const [items, total] = await prisma.$transaction([
        prisma.session.findMany({
          where,
          select: {
            id: true,
            eventId: true,
            composedKey: true,
            composedAt: true,
            guestName: true,
            status: true,
            event: { select: { name: true } },
            filter: { select: { name: true } },
            layout: { select: { name: true, mode: true } },
          },
          orderBy: { composedAt: "desc" },
          skip: (q.page - 1) * q.pageSize,
          take: q.pageSize,
        }),
        prisma.session.count({ where }),
      ]);
      const urls = await Promise.all(items.map((s) => mediaService.composedUrl(s)));
      return ok(c, {
        items: items.map((s, i) => ({
          sessionId: s.id,
          eventId: s.eventId,
          eventName: s.event.name,
          guestName: s.guestName,
          filterName: s.filter.name,
          layoutName: s.layout.name,
          composedAt: s.composedAt,
          url: urls[i],
        })),
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
      });
    },
  )

  /** Streamed ZIP of all composed photos for an event (Downloads module). */
  .get(
    "/download/:eventId",
    requirePermission(Permission.GALLERY_DOWNLOAD),
    rateLimitBy("gallery-zip", 5, 60),
    async (c) => {
      const user = c.get("user");
      const eventId = c.req.param("eventId");
      await assertEventAccess(c, eventId);

      const event = await prisma.event.findFirst({
        where: { id: eventId, organizationId: user.organizationId },
        select: { name: true },
      });
      if (!event) throw notFound();

      const sessions = await prisma.session.findMany({
        where: { eventId, composedKey: { not: null } },
        select: { id: true, composedKey: true, composedAt: true },
        orderBy: { composedAt: "asc" },
      });

      const storage = getStorage();
      const archive = archiver("zip", { zlib: { level: 6 } });
      const passthrough = new PassThrough();
      archive.pipe(passthrough);

      // Append sequentially in the background while streaming out.
      void (async () => {
        try {
          for (const [i, s] of sessions.entries()) {
            const buf = await storage.getObject(s.composedKey!);
            archive.append(buf, { name: `${String(i + 1).padStart(4, "0")}-${s.id}.jpg` });
          }
          await archive.finalize();
        } catch (err) {
          archive.destroy(err as Error);
        }
      })();

      const filename = `${event.name.replace(/[^a-z0-9-_ ]/gi, "").trim() || "event"}-composed.zip`;
      return new Response(Readable.toWeb(passthrough) as ReadableStream, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    },
  );
