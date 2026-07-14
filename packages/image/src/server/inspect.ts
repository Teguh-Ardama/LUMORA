import sharp from "sharp";

export interface ImageInfo {
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
}

/**
 * Validate that an upload really is an image (never trust the MIME header)
 * and return its dimensions. Throws on anything sharp cannot decode.
 */
export async function inspectImage(buffer: Buffer): Promise<ImageInfo> {
  const meta = await sharp(buffer, { failOn: "warning" }).metadata();
  if (!meta.width || !meta.height || !meta.format) {
    throw new Error("Not a decodable image");
  }
  const allowed = new Set(["jpeg", "png", "webp"]);
  if (!allowed.has(meta.format)) {
    throw new Error(`Unsupported image format: ${meta.format}`);
  }
  return { width: meta.width, height: meta.height, format: meta.format, sizeBytes: buffer.length };
}
