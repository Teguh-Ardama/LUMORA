import { z } from "zod";
import { emailSchema } from "./common";
import { OrgRole } from "./enums";

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128)
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[0-9]/, "Must contain a digit");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  organizationName: z.string().trim().min(2).max(160),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(16),
  name: z.string().trim().min(2).max(120),
  password: passwordSchema,
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** Access-token claims (JWT). */
export interface AccessTokenClaims {
  sub: string; // user id
  email: string;
  name: string;
  org: string; // active organization id
  role: OrgRole;
  type: "access";
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: OrgRole;
}
