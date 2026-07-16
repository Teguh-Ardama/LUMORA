import { z } from "zod";
import { emailSchema, idempotencyKeySchema, uuidSchema } from "./common";
import { CaptureSource } from "./enums";

export const startSessionSchema = z.object({
  eventId: uuidSchema,
  captureSource: z.nativeEnum(CaptureSource),
  borderId: uuidSchema.nullish(),
  layoutId: uuidSchema,
  filterId: uuidSchema,
  idempotencyKey: idempotencyKeySchema,
});
export type StartSessionInput = z.infer<typeof startSessionSchema>;

export const updateSessionSchema = z.object({
  borderId: uuidSchema.nullish(),
  layoutId: uuidSchema.optional(),
  filterId: uuidSchema.optional(),
  guestName: z.string().trim().max(120).nullish(),
  guestEmail: emailSchema.nullish(),
});
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

/** Multipart fields accompanying a photo upload. */
export const uploadPhotoFieldsSchema = z.object({
  sequence: z.coerce.number().int().min(0).max(11),
  idempotencyKey: idempotencyKeySchema,
  capturedAt: z.coerce.date().optional(),
});
export type UploadPhotoFields = z.infer<typeof uploadPhotoFieldsSchema>;

export const composeRequestSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
});

/** Hard limits enforced server-side regardless of client compression (FR-03). */
export const PHOTO_UPLOAD_MAX_BYTES = 8 * 1024 * 1024; // absolute reject
export const PHOTO_TARGET_MAX_BYTES = Math.round(3.5 * 1024 * 1024); // Naikin dari 1.5MB → 3.5MB biar lebih jernih
export const PHOTO_MIN_LONG_EDGE = 1800; // Naikin dari 1200px → 1800px (min cetak 4R)
export const ALLOWED_PHOTO_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
