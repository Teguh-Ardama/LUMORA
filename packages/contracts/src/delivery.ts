import { z } from "zod";
import { emailSchema, uuidSchema, waNumberSchema } from "./common";
import { DeliveryChannel } from "./enums";

export const requestDeliverySchema = z
  .object({
    channel: z.nativeEnum(DeliveryChannel),
    email: emailSchema.optional(),
    waNumber: waNumberSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.channel === DeliveryChannel.EMAIL && !v.email) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Email required" });
    }
    if (v.channel === DeliveryChannel.WHATSAPP && !v.waNumber) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["waNumber"], message: "WhatsApp number required" });
    }
  });
export type RequestDeliveryInput = z.infer<typeof requestDeliverySchema>;

/** Guest-facing payload behind a delivery token (public page). */
export interface GuestGalleryPayload {
  eventName: string;
  organizationName: string;
  composedUrl: string;
  downloadUrl: string;
  createdAt: string;
  expiresAt: string;
}

export const DELIVERY_TOKEN_TTL_HOURS = 72;

export const createPrintJobSchema = z.object({
  sessionId: uuidSchema,
  copies: z.number().int().min(1).max(10).default(1),
});
export type CreatePrintJobInput = z.infer<typeof createPrintJobSchema>;

export const updatePrintJobSchema = z.object({
  status: z.enum(["PRINTING", "PRINTED", "FAILED", "CANCELLED"]),
  failureReason: z.string().max(500).optional(),
});
export type UpdatePrintJobInput = z.infer<typeof updatePrintJobSchema>;
