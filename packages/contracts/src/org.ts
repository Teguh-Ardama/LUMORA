import { z } from "zod";
import { emailSchema, uuidSchema } from "./common";
import { OrgRole } from "./enums";

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  supportEmail: emailSchema.nullish(),
  brandColor: z
    .string()
    .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/)
    .nullish(),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.nativeEnum(OrgRole).refine((r) => r !== OrgRole.OWNER, {
    message: "Ownership is transferred, not invited",
  }),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberSchema = z.object({
  role: z.nativeEnum(OrgRole).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const removeMemberSchema = z.object({
  userId: uuidSchema,
});
