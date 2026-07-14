import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { acceptInviteSchema, changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from "@lumora/contracts";
import { hashPassword, verifyPassword } from "@lumora/core";
import { prisma } from "@lumora/db";
import { authService } from "../../services/auth.service";
import { clearAuthCookies, readRefreshToken, setAuthCookies } from "../../auth/cookies";
import { clientIp, ok, rateLimitBy, requireAuth, unauthorized } from "../middleware";
import type { ApiEnv } from "../context";

export const authRoute = new Hono<ApiEnv>()
  .post(
    "/register",
    rateLimitBy("auth-register", 5, 300),
    zValidator("json", registerSchema),
    async (c) => {
      const tokens = await authService.register(c.req.valid("json"), {
        ip: clientIp(c),
        userAgent: c.req.header("user-agent"),
      });
      setAuthCookies(c, tokens.accessToken, tokens.refreshToken);
      return ok(c, { user: tokens.user }, 201);
    },
  )
  .post("/login", rateLimitBy("auth-login", 10, 60), zValidator("json", loginSchema), async (c) => {
    const tokens = await authService.login(c.req.valid("json"), {
      ip: clientIp(c),
      userAgent: c.req.header("user-agent"),
    });
    setAuthCookies(c, tokens.accessToken, tokens.refreshToken);
    return ok(c, { user: tokens.user });
  })
  .post("/refresh", rateLimitBy("auth-refresh", 30, 60), async (c) => {
    const refresh = readRefreshToken(c);
    if (!refresh) throw unauthorized("No refresh token");
    const tokens = await authService.refresh(refresh, {
      ip: clientIp(c),
      userAgent: c.req.header("user-agent"),
    });
    setAuthCookies(c, tokens.accessToken, tokens.refreshToken);
    return ok(c, { user: tokens.user });
  })
  .post("/logout", async (c) => {
    await authService.logout(readRefreshToken(c), null, clientIp(c));
    clearAuthCookies(c);
    return ok(c, { done: true });
  })
  .post("/invite/accept", rateLimitBy("auth-invite", 10, 300), zValidator("json", acceptInviteSchema), async (c) => {
    const tokens = await authService.acceptInvite(c.req.valid("json"), {
      ip: clientIp(c),
      userAgent: c.req.header("user-agent"),
    });
    setAuthCookies(c, tokens.accessToken, tokens.refreshToken);
    return ok(c, { user: tokens.user });
  })
  .get("/me", requireAuth, (c) => ok(c, { user: c.get("user") }))
  .patch("/me", requireAuth, zValidator("json", updateProfileSchema), async (c) => {
    const user = c.get("user");
    const { name } = c.req.valid("json");
    await prisma.user.update({ where: { id: user.id }, data: { name } });
    return ok(c, { user: { ...user, name } });
  })
  .post("/me/password", requireAuth, zValidator("json", changePasswordSchema), async (c) => {
    const user = c.get("user");
    const input = c.req.valid("json");
    const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await verifyPassword(input.currentPassword, dbUser.passwordHash))) {
      throw unauthorized("Current password is incorrect");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });
    // Revoke every other session on password change.
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return ok(c, { done: true });
  });
