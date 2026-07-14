import { z } from "zod";
import { LayoutMode } from "./enums";

/**
 * FR-07 Layout Engine contract.
 *
 * Canvas is expressed in absolute pixels at 300dpi for 4R (4x6"):
 *  - landscape: 1800 x 1200
 *  - portrait:  1200 x 1800
 *
 * STRIP mode: slots describe the LEFT column only; the composer
 * auto-duplicates every slot mirrored onto the right half (PRD FR-07).
 */
export const layoutSlotSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
  /** Index into the session's captured photos (0-based). */
  photoIndex: z.number().int().min(0),
  /** Optional corner radius in px applied when compositing. */
  radius: z.number().int().min(0).default(0),
});
export type LayoutSlot = z.infer<typeof layoutSlotSchema>;

export const layoutConfigSchema = z
  .object({
    mode: z.nativeEnum(LayoutMode),
    canvas: z.object({
      width: z.number().int().min(300).max(7200),
      height: z.number().int().min(300).max(7200),
    }),
    background: z
      .string()
      .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, "background must be a hex color")
      .default("#ffffff"),
    slots: z.array(layoutSlotSchema).min(1).max(12),
  })
  .superRefine((cfg, ctx) => {
    for (const [i, slot] of cfg.slots.entries()) {
      const maxX = cfg.mode === LayoutMode.STRIP ? Math.floor(cfg.canvas.width / 2) : cfg.canvas.width;
      if (slot.x + slot.w > maxX) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["slots", i],
          message:
            cfg.mode === LayoutMode.STRIP
              ? "STRIP slots must fit within the left half of the canvas"
              : "Slot exceeds canvas width",
        });
      }
      if (slot.y + slot.h > cfg.canvas.height) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["slots", i],
          message: "Slot exceeds canvas height",
        });
      }
    }
  });
export type LayoutConfig = z.infer<typeof layoutConfigSchema>;

/** Number of distinct photos a layout requires (max photoIndex + 1). */
export function requiredPhotoCount(config: LayoutConfig): number {
  return Math.max(...config.slots.map((s) => s.photoIndex)) + 1;
}

/**
 * Resolve the physical slots to composite. In STRIP mode every slot is
 * duplicated onto the right half at x + canvas.width / 2 with the same
 * photoIndex — the PRD's "duplicate left column to the right".
 */
export function resolvePhysicalSlots(config: LayoutConfig): LayoutSlot[] {
  if (config.mode !== LayoutMode.STRIP) return config.slots;
  const offset = Math.floor(config.canvas.width / 2);
  return [
    ...config.slots,
    ...config.slots.map((s) => ({ ...s, x: s.x + offset })),
  ];
}
