import {
  ApiError,
  ApiErrorCode,
  type AcceptInviteInput,
  type LoginInput,
  type RegisterInput,
  type SessionUser,
} from "@lumora/contracts";
import {
  REFRESH_TOKEN_TTL_SECONDS,
  generateSecretToken,
  hashPassword,
  hashToken,
  signAccessToken,
  verifyPassword,
} from "@lumora/core";
import { auditRepo, prisma } from "@lumora/db";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "org"
  );
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  for (let i = 0; i < 20; i++) {
    const exists = await prisma.organization.findUnique({ where: { slug: candidate } });
    if (!exists) return candidate;
    candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  throw new Error("Could not allocate organization slug");
}

async function issueTokens(userId: string, organizationId: string, meta: { ip?: string; userAgent?: string }): Promise<AuthTokens> {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: { user: true, organization: true },
  });
  if (!membership || !membership.isActive || !membership.user.isActive) {
    throw new ApiError(ApiErrorCode.UNAUTHORIZED, "Membership inactive", 401);
  }

  const accessToken = await signAccessToken({
    sub: userId,
    email: membership.user.email,
    name: membership.user.name,
    org: organizationId,
    role: membership.role,
  });

  const refreshToken = generateSecretToken(48);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 300),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: userId,
      email: membership.user.email,
      name: membership.user.name,
      organizationId,
      organizationName: membership.organization.name,
      role: membership.role,
    },
  };
}

export const authService = {
  async register(input: RegisterInput, meta: { ip?: string; userAgent?: string }): Promise<AuthTokens> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ApiError(ApiErrorCode.CONFLICT, "An account with this email already exists", 409);

    const passwordHash = await hashPassword(input.password);
    const slug = await uniqueSlug(input.organizationName);

    const { user, org } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email, name: input.name, passwordHash },
      });
      const org = await tx.organization.create({
        data: { name: input.organizationName, slug },
      });
      await tx.membership.create({
        data: { userId: user.id, organizationId: org.id, role: "OWNER" },
      });
      return { user, org };
    });

    await auditRepo.write({
      organizationId: org.id,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "CREATE",
      entityType: "organization",
      entityId: org.id,
      ip: meta.ip,
    });

    return issueTokens(user.id, org.id, meta);
  },

  async login(input: LoginInput, meta: { ip?: string; userAgent?: string }): Promise<AuthTokens> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { memberships: { where: { isActive: true }, orderBy: { createdAt: "asc" } } },
    });
    // Constant-shape failure: never reveal which factor was wrong.
    const invalid = new ApiError(ApiErrorCode.UNAUTHORIZED, "Invalid email or password", 401);
    if (!user || !user.isActive) throw invalid;
    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) throw invalid;
    const membership = user.memberships[0];
    if (!membership) throw new ApiError(ApiErrorCode.FORBIDDEN, "No active organization membership", 403);

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await issueTokens(user.id, membership.organizationId, meta);

    await auditRepo.write({
      organizationId: membership.organizationId,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "LOGIN",
      entityType: "user",
      entityId: user.id,
      ip: meta.ip,
    });
    return tokens;
  },

  /** Rotate: consume the presented refresh token, issue a fresh pair. */
  async refresh(presented: string, meta: { ip?: string; userAgent?: string }): Promise<AuthTokens> {
    const tokenHash = hashToken(presented);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || !stored.user.isActive) {
      throw new ApiError(ApiErrorCode.UNAUTHORIZED, "Refresh token invalid", 401);
    }
    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

    const membership = await prisma.membership.findFirst({
      where: { userId: stored.userId, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) throw new ApiError(ApiErrorCode.FORBIDDEN, "No active organization membership", 403);
    return issueTokens(stored.userId, membership.organizationId, meta);
  },

  async logout(presentedRefresh: string | undefined, user: SessionUser | null, ip?: string): Promise<void> {
    if (presentedRefresh) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(presentedRefresh), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    if (user) {
      await auditRepo.write({
        organizationId: user.organizationId,
        actorType: "USER",
        actorId: user.id,
        actorName: user.name,
        action: "LOGOUT",
        entityType: "user",
        entityId: user.id,
        ip,
      });
    }
  },

  async acceptInvite(input: AcceptInviteInput, meta: { ip?: string; userAgent?: string }): Promise<AuthTokens> {
    const invite = await prisma.invite.findUnique({
      where: { tokenHash: hashToken(input.token) },
      include: { organization: true },
    });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new ApiError(ApiErrorCode.GONE, "Invite is invalid or has expired", 410);
    }

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email: invite.email } });
      if (!user) {
        user = await tx.user.create({ data: { email: invite.email, name: input.name, passwordHash } });
      }
      await tx.membership.upsert({
        where: { userId_organizationId: { userId: user.id, organizationId: invite.organizationId } },
        update: { role: invite.role, isActive: true },
        create: { userId: user.id, organizationId: invite.organizationId, role: invite.role },
      });
      await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      return user;
    });

    await auditRepo.write({
      organizationId: invite.organizationId,
      actorType: "USER",
      actorId: user.id,
      actorName: user.name,
      action: "CREATE",
      entityType: "membership",
      entityId: user.id,
      metadata: { via: "invite", role: invite.role },
      ip: meta.ip,
    });
    return issueTokens(user.id, invite.organizationId, meta);
  },
};
