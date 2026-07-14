/**
 * FR-03 Smart Auto-Compress — browser variant (webcam capture path).
 * Pure DOM APIs; no dependencies. Mirrors the server strategy: quality
 * ladder first, resolution step-down second, never below minLongEdge.
 */

export interface BrowserCompressOptions {
  targetBytes: number;
  minLongEdge: number;
  maxLongEdge?: number;
}

export interface BrowserCompressResult {
  blob: Blob;
  width: number;
  height: number;
}

export async function captureVideoFrame(video: HTMLVideoElement): Promise<ImageBitmap> {
  return createImageBitmap(video);
}

export async function compressBitmapToTarget(
  bitmap: ImageBitmap,
  opts: BrowserCompressOptions,
): Promise<BrowserCompressResult> {
  const maxLongEdge = opts.maxLongEdge ?? 2400;
  const qualities = [0.9, 0.84, 0.78, 0.7, 0.62];
  let longEdge = Math.min(maxLongEdge, Math.max(bitmap.width, bitmap.height));

  while (true) {
    const scale = longEdge / Math.max(bitmap.width, bitmap.height);
    const w = Math.round(bitmap.width * Math.min(1, scale));
    const h = Math.round(bitmap.height * Math.min(1, scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D unavailable");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);

    for (const quality of qualities) {
      const blob = await canvasToBlob(canvas, "image/jpeg", quality);
      const atFloor = longEdge <= opts.minLongEdge && quality === qualities[qualities.length - 1];
      if (blob.size <= opts.targetBytes || atFloor) {
        return { blob, width: w, height: h };
      }
    }

    if (longEdge <= opts.minLongEdge) throw new Error("Compression could not reach target");
    longEdge = Math.max(opts.minLongEdge, Math.round(longEdge * 0.85));
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
      type,
      quality,
    );
  });
}
