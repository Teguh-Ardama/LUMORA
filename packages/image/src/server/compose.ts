import sharp, { type OverlayOptions } from "sharp";
import {
  layoutConfigSchema,
  resolvePhysicalSlots,
  type FilterParams,
  type LayoutConfig,
  type LayoutSlot,
} from "@lumora/contracts";


export interface ComposeInput {
  /** Raw captured photos, ordered by sequence (index = photoIndex). */
  photos: Buffer[];
  layoutConfig: unknown;
  /** Transparent PNG overlaid on top of the composition. */
  borderPng?: Buffer | null;
  filterParams: FilterParams;
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

  // Filter each distinct photo once, then reuse across duplicated slots.
  const filteredCache = new Map<number, Buffer>();
  async function filteredPhoto(photoIndex: number): Promise<Buffer> {
    const cached = filteredCache.get(photoIndex);
    if (cached) return cached;
    const source = input.photos[photoIndex];
    if (!source) throw new Error(`Missing photo at index ${photoIndex}`);
    const out = await applyFilter(source, input.filterParams);
    filteredCache.set(photoIndex, out);
    return out;
  }

  const overlays: OverlayOptions[] = [];
  for (const slot of slots) {
    const photo = await filteredPhoto(slot.photoIndex);
    overlays.push({
      input: await renderSlot(photo, slot),
      left: slot.x,
      top: slot.y,
    });
  }

  // FR-10: overlay face stickers (if any)
  if (input.stickers?.length) {
    for (const st of input.stickers) {
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

/** FR-05: data-driven filter interpretation. */
async function applyFilter(photo: Buffer, params: FilterParams): Promise<Buffer> {
  let pipeline = sharp(photo, { failOn: "none" }).rotate();

  if (params.grayscale) {
    pipeline = pipeline.grayscale();
  }
  pipeline = pipeline.modulate({
    brightness: params.brightness,
    saturation: params.grayscale ? 1 : params.saturation,
    hue: params.hue,
  });
  if (params.gamma) {
    pipeline = pipeline.gamma(params.gamma);
  }
  if (params.tint && !params.grayscale) {
    pipeline = pipeline.tint(params.tint);
  }
  return pipeline.toBuffer();
}

/** Cover-crop a photo into a slot, with optional rounded corners. */
async function renderSlot(photo: Buffer, slot: LayoutSlot): Promise<Buffer> {
  let pipeline = sharp(photo).resize(slot.w, slot.h, { fit: "cover", position: "attention" });

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
