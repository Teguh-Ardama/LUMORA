import type { Context, MiddlewareHandler } from "hono";
import { ZodError } from "zod";
import {
  ApiError,
  ApiErrorCode,
  Permission,
  roleHasPermission,
  type OrgRole,
} from "@lumora/contracts";
import { getEnv, rateLimit, verifyAccessToken, verifyBridgeToken } from "@lumora/core";
import { bridgeDeviceRepo, prisma } from "@lumora/db";
import { readAccessToken } from "../auth/cookies";
import type { ApiEnv } from "./context";

// ── Error envelope ────────────────────────────────────────────────────────

export function errorResponse(c: Context, err: unknown) {
  if (err instanceof ApiError) {
    return c.json({ ok: false, error: { code: err.code, message: err.message, details: err.details } }, err.status as 400);
  }
  if (err instanceof ZodError) {
    return c.json(
      { ok: false, error: { code: ApiErrorCode.VALIDATION, message: "Validation failed", details: err.flatten() } },
      422,
    );
  }
  console.error("[api] unhandled", err);
  return c.json({ ok: false, error: { code: ApiErrorCode.INTERNAL, message: "Internal server error" } }, 500);
}

export function ok<T>(c: Context, data: T, status: 200 | 201 = 200) {
  return c.json({ ok: true, data }, status);
}

export const notFound = () => new ApiError(ApiErrorCode.NOT_FOUND, "Resource not found", 404);
export const forbidden = (msg = "You do not have access to this resource") =>
  new ApiError(ApiErrorCode.FORBIDDEN, msg, 403);
export const unauthorized = (msg = "Authentication required") =>
  new ApiError(ApiErrorCode.UNAUTHORIZED, msg, 401);

// ── Client IP ─────────────────────────────────────────────────────────────

export function clientIp(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip") ??
    "unknown"
  );
}

// ── CSRF / origin protection (cookie-authed routes) ──────────────────────

/** Signature-authenticated endpoints (gateway webhooks) — no cookies involved. */
const CSRF_EXEMPT_PATHS = new Set(["/api/billing/webhook"]);

export const csrfProtection: MiddlewareHandler = async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();

  // Bearer-token callers (Desktop Bridge) are exempt: no cookies, no CSRF.
  if (c.req.header("authorization")?.startsWith("Bearer ")) return next();
  if (CSRF_EXEMPT_PATHS.has(new URL(c.req.url).pathname)) return next();

  const origin = c.req.header("origin");
  if (origin) {
    const expected = new URL(getEnv().APP_URL).origin;
    if (origin !== expected) {
      throw new ApiError(ApiErrorCode.FORBIDDEN, "Cross-origin request rejected", 403);
    }
  }
  if (c.req.header("x-lumora-csrf") !== "1") {
    throw new ApiError(ApiErrorCode.FORBIDDEN, "Missing CSRF header", 403);
  }
  return next();
};

// ── Authentication ────────────────────────────────────────────────────────

/** Resolve the current user from the access cookie + verify membership. */
export const requireAuth: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const token = readAccessToken(c);
  if (!token) throw unauthorized();
  const claims = await verifyAccessToken(token);
  if (!claims) throw unauthorized("Session expired");

  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: claims.sub, organizationId: claims.org } },
    include: { user: true, organization: true },
  });
  if (!membership || !membership.isActive || !membership.user.isActive) {
    throw unauthorized("Membership no longer active");
  }

  c.set("user", {
    id: membership.userId,
    email: membership.user.email,
    name: membership.user.name,
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    role: membership.role as OrgRole,
  });
  c.set("ip", clientIp(c));
  return next();
};

export function requirePermission(permission: Permission): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) throw unauthorized();
    if (!roleHasPermission(user.role, permission)) {
      throw forbidden(`Missing permission: ${permission}`);
    }
    return next();
  };
}

/**
 * OPERATOR-role users may only touch events they are assigned to;
 * ADMIN/OWNER see every event in the org.
 */
export async function assertEventAccess(c: Context, eventId: string): Promise<void> {
  const user = (c as Context<ApiEnv>).get("user");
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: user.organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!event) throw notFound();
  if (user.role === "OPERATOR") {
    const assigned = await prisma.eventOperator.findUnique({
      where: { eventId_userId: { eventId, userId: user.id } },
    });
    if (!assigned) throw forbidden("You are not assigned to this event");
  }
}

// ── Bridge device authentication ─────────────────────────────────────────

export const requireBridge: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) throw unauthorized("Device token required");
  const claims = await verifyBridgeToken(header.slice(7));
  if (!claims) throw unauthorized("Invalid device token");
  const device = await bridgeDeviceRepo.findById(claims.sub);
  if (!device || device.status === "REVOKED") throw unauthorized("Device revoked");
  c.set("bridgeDevice", device);
  c.set("ip", clientIp(c));
  return next();
};

// ── Rate limiting ─────────────────────────────────────────────────────────

export function rateLimitBy(
  scope: string,
  limit: number,
  windowSeconds: number,
  keyFn?: (c: Context<ApiEnv>) => string,
): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const key = keyFn ? keyFn(c) : `${scope}:${clientIp(c)}`;
    const result = await rateLimit(`${scope}:${key}`, limit, windowSeconds);
    if (!result.allowed) {
      c.header("Retry-After", String(result.retryAfterSeconds));
      throw new ApiError(ApiErrorCode.RATE_LIMITED, "Too many requests, slow down", 429);
    }
    return next();
  };
}
