import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  ApiError,
  ApiErrorCode,
  Permission,
  inviteMemberSchema,
  updateMemberSchema,
  updateOrganizationSchema,
} from "@lumora/contracts";
import { generateSecretToken, getEnv, hashToken, enqueueNotification } from "@lumora/core";
import { auditRepo, prisma } from "@lumora/db";
import { ok, requireAuth, requirePermission, notFound } from "../middleware";
import type { ApiEnv } from "../context";

export const orgRoute = new Hono<ApiEnv>()
  .use("*", requireAuth)

  .get("/", requirePermission(Permission.ORG_READ), async (c) => {
    const user = c.get("user");
    const org = await prisma.organization.findUnique({ where: { id: user.organizationId } });
    if (!org) throw notFound();
    return ok(c, { organization: org });
  })

  .patch("/", requirePermission(Permission.SETTINGS_MANAGE), zValidator("json", updateOrganizationSchema), async (c) => {
    const user = c.get("user");
    const input = c.req.valid("json");
    const org = await prisma.organization.update({ where: { id: user.organizationId }, data: input });
    await auditRepo.write({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "UPDATE",
      entityType: "organization",
      entityId: org.id,
      metadata: input as Record<string, unknown>,
      ip: c.get("ip"),
    });
    return ok(c, { organization: org });
  })

  .get("/members", requirePermission(Permission.MEMBER_READ), async (c) => {
    const user = c.get("user");
    const members = await prisma.membership.findMany({
      where: { organizationId: user.organizationId },
      include: { user: { select: { id: true, name: true, email: true, lastLoginAt: true, isActive: true } } },
      orderBy: { createdAt: "asc" },
    });
    const invites = await prisma.invite.findMany({
      where: { organizationId: user.organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    });
    return ok(c, {
      members: members.map((m) => ({
        membershipId: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
        isActive: m.isActive && m.user.isActive,
        lastLoginAt: m.user.lastLoginAt,
      })),
      invites,
    });
  })

  .post("/members/invite", requirePermission(Permission.MEMBER_INVITE), zValidator("json", inviteMemberSchema), async (c) => {
    const user = c.get("user");
    const input = c.req.valid("json");

    const existingMember = await prisma.membership.findFirst({
      where: { organizationId: user.organizationId, user: { email: input.email } },
    });
    if (existingMember) throw new ApiError(ApiErrorCode.CONFLICT, "This person is already a member", 409);

    const token = generateSecretToken(32);
    const invite = await prisma.invite.create({
      data: {
        organizationId: user.organizationId,
        email: input.email,
        role: input.role,
        tokenHash: hashToken(token),
        invitedById: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    await auditRepo.write({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "INVITE",
      entityType: "invite",
      entityId: invite.id,
      metadata: { email: input.email, role: input.role },
      ip: c.get("ip"),
    });
    await enqueueNotification({
      organizationId: user.organizationId,
      kind: "MEMBER_INVITED",
      title: "Member invited",
      body: `${user.name} invited ${input.email} as ${input.role}`,
    });

    // The invite URL is returned so the admin can share it directly;
    // the delivery worker also emails it when SMTP is configured.
    return ok(c, { inviteId: invite.id, inviteUrl: `${getEnv().APP_URL}/invite/${token}` }, 201);
  })

  .patch("/members/:userId", requirePermission(Permission.MEMBER_UPDATE), zValidator("json", updateMemberSchema), async (c) => {
    const user = c.get("user");
    const targetUserId = c.req.param("userId");
    const input = c.req.valid("json");

    const target = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId: user.organizationId } },
    });
    if (!target) throw notFound();
    if (target.role === "OWNER") throw new ApiError(ApiErrorCode.FORBIDDEN, "The owner cannot be modified", 403);

    const updated = await prisma.membership.update({
      where: { id: target.id },
      data: { ...(input.role ? { role: input.role } : {}), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}) },
    });
    await auditRepo.write({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "UPDATE",
      entityType: "membership",
      entityId: target.id,
      metadata: input as Record<string, unknown>,
      ip: c.get("ip"),
    });
    return ok(c, { membership: updated });
  })

  .delete("/members/:userId", requirePermission(Permission.MEMBER_REMOVE), async (c) => {
    const user = c.get("user");
    const targetUserId = c.req.param("userId");
    const target = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: targetUserId, organizationId: user.organizationId } },
    });
    if (!target) throw notFound();
    if (target.role === "OWNER") throw new ApiError(ApiErrorCode.FORBIDDEN, "The owner cannot be removed", 403);

    await prisma.membership.delete({ where: { id: target.id } });
    await auditRepo.write({
      organizationId: user.organizationId,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "DELETE",
      entityType: "membership",
      entityId: target.id,
      metadata: { removedUserId: targetUserId },
      ip: c.get("ip"),
    });
    return ok(c, { done: true });
  })

  .delete("/members/invites/:inviteId", requirePermission(Permission.MEMBER_INVITE), async (c) => {
    const user = c.get("user");
    const invite = await prisma.invite.findFirst({
      where: { id: c.req.param("inviteId"), organizationId: user.organizationId },
    });
    if (!invite) throw notFound();
    await prisma.invite.delete({ where: { id: invite.id } });
    return ok(c, { done: true });
  });
