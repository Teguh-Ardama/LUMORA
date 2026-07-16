import { z } from "zod";
import { uuidSchema } from "./common";
import { FilterKind } from "./enums";
import { layoutConfigSchema } from "./layout";

/**
 * FR-08: scope is derived from (organizationId, eventId):
 *   both NULL          -> GLOBAL (platform library)
 *   org set, event NULL -> ORGANIZATION library
 *   both set            -> EVENT-specific
 */
export const createBorderSchema = z.object({
  name: z.string().trim().min(2).max(255),
  eventId: uuidSchema.nullish(),
});
export type CreateBorderInput = z.infer<typeof createBorderSchema>;

export const updateBorderSchema = z.object({
  name: z.string().trim().min(2).max(255).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateBorderInput = z.infer<typeof updateBorderSchema>;

export const createLayoutSchema = z.object({
  name: z.string().trim().min(2).max(100),
  eventId: uuidSchema.nullish(),
  config: layoutConfigSchema,
});
export type CreateLayoutInput = z.infer<typeof createLayoutSchema>;

export const updateLayoutSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  config: layoutConfigSchema.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateLayoutInput = z.infer<typeof updateLayoutSchema>;

/**
 * Filter definitions are data, not code: the composer interprets `kind`
 * plus numeric params so new looks can ship without a deploy.
 */
export const filterParamsSchema = z.object({
  brightness: z.number().min(0.2).max(3).default(1),
  saturation: z.number().min(0).max(3).default(1),
  hue: z.number().int().min(-180).max(180).default(0),
  gamma: z.number().min(1).max(3).optional(),
  /** RGB tint overlay, e.g. vintage warm cast. */
  tint: z
    .object({
      r: z.number().int().min(0).max(255),
      g: z.number().int().min(0).max(255),
      b: z.number().int().min(0).max(255),
    })
    .optional(),
  grayscale: z.boolean().default(false),
});
export type FilterParams = z.infer<typeof filterParamsSchema>;

export const createFilterSchema = z.object({
  name: z.string().trim().min(2).max(100),
  kind: z.nativeEnum(FilterKind),
  params: filterParamsSchema,
});
export type CreateFilterInput = z.infer<typeof createFilterSchema>;

export const createStickerSchema = z.object({
  name: z.string().trim().min(1).max(255),
  anchorPoint: z.enum(["FOREHEAD", "LEFT_EYE", "RIGHT_EYE", "NOSE", "MOUTH", "CHIN", "LEFT_EAR", "RIGHT_EAR", "FULL_FACE"]),
  defaultScale: z.coerce.number().min(0.1).max(5).default(1.0),
  defaultOffsetX: z.coerce.number().default(0),
  defaultOffsetY: z.coerce.number().default(0),
});
export type CreateStickerInput = z.infer<typeof createStickerSchema>;
