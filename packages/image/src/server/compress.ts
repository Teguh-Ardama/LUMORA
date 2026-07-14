import sharp from "sharp";

export interface CompressOptions {
  /** FR-03 target: keep files under this many bytes. */
  targetBytes: number;
  /** Never downscale below this long-edge (protects 4R print quality). */
  minLongEdge: number;
  /** Starting long-edge cap; DSLR files get normalized to this first. */
  maxLongEdge?: number;
}

export interface CompressResult {
  buffer: Buffer;
  width: number;
  height: number;
  quality: number;
}

/**
 * FR-03 Smart Auto-Compress (server/bridge variant).
 * Strategy: normalize orientation & cap the long edge, then walk a JPEG
 * quality ladder; only if the floor quality still misses the target do we
 * step the resolution down — never below `minLongEdge`.
 */
export async function compressToTarget(
  input: Buffer,
  opts: CompressOptions,
): Promise<CompressResult> {
  const maxLongEdge = opts.maxLongEdge ?? 2400;
  const qualityLadder = [88, 82, 76, 70, 64];
  let longEdge = maxLongEdge;

  // Resolution steps: maxLongEdge -> ... -> minLongEdge
  while (true) {
    const base = sharp(input, { failOn: "none" })
      .rotate() // honor EXIF orientation
      .resize(longEdge, longEdge, { fit: "inside", withoutEnlargement: true });

    for (const quality of qualityLadder) {
      const out = await base
        .clone()
        .jpeg({ quality, mozjpeg: true, chromaSubsampling: quality > 80 ? "4:4:4" : "4:2:0" })
        .toBuffer({ resolveWithObject: true });
      if (out.info.size <= opts.targetBytes || (longEdge <= opts.minLongEdge && quality === qualityLadder[qualityLadder.length - 1])) {
        return {
          buffer: out.data,
          width: out.info.width,
          height: out.info.height,
          quality,
        };
      }
    }

    if (longEdge <= opts.minLongEdge) {
      // Unreachable (loop above returns at the floor), kept as a guard.
      break;
    }
    longEdge = Math.max(opts.minLongEdge, Math.round(longEdge * 0.85));
  }

  throw new Error("compressToTarget: could not reach target size");
}
