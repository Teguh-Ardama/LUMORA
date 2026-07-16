import sharp, { type OverlayOptions } from "sharp";
import {
  layoutConfigSchema,
  resolvePhysicalSlots,
  type FilterParams,
  type LayoutConfig,
  type LayoutSlot,
} from "@lumora/contracts";


export interface ComposeInput {
  /** Raw captured photos and their specific filter parameters, ordered by sequence (index = photoIndex). */
  photos: Array<{
    buffer: Buffer;
    filterParams: FilterParams;
  }>;
  layoutConfig: unknown;
  /** Transparent PNG overlaid on top of the composition. */
  borderPng?: Buffer | null;
  sessionStickers?: Array<{
    png: Buffer;
    offsetX: number;
    offsetY: number;
    scale: number;
  }>;
  stickers?: Array<{
    buffer: Buffer;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
  }>;
}

export interface ComposeOutput {
  buffer: Buffer;
  width: number;
  height: number;
}

/**
 * FR-04 Composer Engine: photo + filter + layout + border + stickers in one
 * deterministic pass.
 *
 * Order of operations (identical for every session):
 *   1. validate layout JSON (FR-07 contract)
 *   2. per photo: apply filter, cover-crop into its slot, optional radius
 *   3. flatten onto the canvas background
 *   4. overlay sticker PNGs (if any)
 */

// FR-04: enable Sharp cache & concurrency for faster repeat composes
sharp.cache({ files: 20, items: 100 });
sharp.concurrency(2);

export async function composeSession(input: ComposeInput): Promise<ComposeOutput> {
  const layout: LayoutConfig = layoutConfigSchema.parse(input.layoutConfig);
  const slots = resolvePhysicalSlots(layout);

  const required = Math.max(...layout.slots.map((s) => s.photoIndex)) + 1;
  if (input.photos.length < required) {
    throw new Error(`Layout needs ${required} photos, session has ${input.photos.length}`);
  }

  async function processSlot(slot: LayoutSlot): Promise<Buffer> {
    const source = input.photos[slot.photoIndex];
    if (!source) throw new Error(`Missing photo at index ${slot.photoIndex}`);
    
    let pipeline = sharp(source.buffer, { failOn: "none" }).rotate();
    
    if (source.filterParams.grayscale) pipeline = pipeline.grayscale();
    pipeline = pipeline.modulate({
      brightness: source.filterParams.brightness,
      ...(source.filterParams.grayscale ? {} : { saturation: source.filterParams.saturation }),
      hue: source.filterParams.hue,
    });
    if (source.filterParams.gamma) pipeline = pipeline.gamma(source.filterParams.gamma);
    if (source.filterParams.tint && !source.filterParams.grayscale) pipeline = pipeline.tint(source.filterParams.tint);

    pipeline = pipeline.resize(slot.w, slot.h, { fit: "cover", position: "attention" });

    if (slot.radius > 0) {
      const mask = Buffer.from(
        `<svg width="${slot.w}" height="${slot.h}"><rect x="0" y="0" width="${slot.w}" height="${slot.h}" rx="${slot.radius}" ry="${slot.radius}" fill="#fff"/></svg>`,
      );
      pipeline = pipeline.composite([{ input: mask, blend: "dest-in" }]).png();
    } else {
      pipeline = pipeline.jpeg({ quality: 95 });
    }
    
    return pipeline.toBuffer();
  }

  const overlays: OverlayOptions[] = [];
  for (const slot of slots) {
    overlays.push({
      input: await processSlot(slot),
      left: slot.x,
      top: slot.y,
    });
  }

  // FR-10: overlay face stickers (if any)
  if (input.sessionStickers?.length) {
    for (const st of input.sessionStickers) {
      const sticker = await sharp(st.png)
        .resize(Math.round(200 * st.scale), Math.round(200 * st.scale), { fit: "inside" })
        .png()
        .toBuffer();
      overlays.push({
        input: sticker,
        left: Math.round(layout.canvas.width / 2 + st.offsetX),
        top: Math.round(layout.canvas.height / 2 + st.offsetY),
      });
    }
  }

  if (input.borderPng) {
    const border = await sharp(input.borderPng)
      .resize(layout.canvas.width, layout.canvas.height, { fit: "fill" })
      .png()
      .toBuffer();
    overlays.push({ input: border, left: 0, top: 0 });
  }

  if (input.stickers) {
    for (const sticker of input.stickers) {
      // Rotation uses background: transparent to not have black corners
      const stickerImg = await sharp(sticker.buffer)
        .resize(Math.round(sticker.width), Math.round(sticker.height), { fit: "contain" })
        .rotate(sticker.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
      overlays.push({ input: stickerImg, left: Math.round(sticker.x), top: Math.round(sticker.y) });
    }
  }

  const composed = await sharp({
    create: {
      width: layout.canvas.width,
      height: layout.canvas.height,
      channels: 4,
      background: layout.background,
    },
  })
    .composite(overlays)
    .flatten({ background: layout.background })
    .jpeg({ quality: 95, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();

  return { buffer: composed, width: layout.canvas.width, height: layout.canvas.height };
}


