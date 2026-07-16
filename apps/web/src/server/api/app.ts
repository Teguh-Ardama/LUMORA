import { Hono } from "hono";
import { authRoute } from "./routes/auth.route";
import { orgRoute } from "./routes/org.route";
import { eventRoute } from "./routes/event.route";
import { templateRoute } from "./routes/template.route";
import { stickerRoute } from "./routes/sticker.route";
import { eventAnalyticsRoute } from "./routes/analytics.route";
import { printRoute, sessionRoute } from "./routes/session.route";
import { bridgeAdminRoute, bridgeRoute } from "./routes/bridge.route";
import { galleryRoute } from "./routes/gallery.route";
import { analyticsRoute, auditRoute, deliveriesRoute, notificationRoute } from "./routes/misc.route";
import { billingRoute, billingWebhookRoute } from "./routes/billing.route";
import { guestRoute } from "./routes/guest.route";
import { operatorRoute } from "./routes/operator.route";
import { csrfProtection, errorResponse } from "./middleware";
import type { ApiEnv } from "./context";

/** LUMORA API — mounted at /api via the Next.js catch-all route. */
export const api = new Hono<ApiEnv>()
  .basePath("/api")
  .use("*", csrfProtection)
  .onError((err, c) => errorResponse(c, err))
  .route("/auth", authRoute)
  .route("/org", orgRoute)
  .route("/analytics", analyticsRoute)
  .route("/events", eventRoute)
  .route("/templates", templateRoute)
  .route("/stickers", stickerRoute)
  .route("/sessions", sessionRoute)
  .route("/print-jobs", printRoute)
  .route("/bridge", bridgeRoute)
  .route("/bridge-devices", bridgeAdminRoute)
  .route("/gallery", galleryRoute)
  .route("/analytics", eventAnalyticsRoute)
  .route("/audit-logs", auditRoute)
  .route("/deliveries", deliveriesRoute)
  // Webhook first: it must match before billingRoute's requireAuth middleware.
  .route("/billing", billingWebhookRoute)
  .route("/billing", billingRoute)
  .route("/notifications", notificationRoute)
  .route("/guest", guestRoute)
  .route("/operator", operatorRoute)
  .get("/health", (c) => c.json({ ok: true, data: { status: "healthy", ts: new Date().toISOString() } }));
