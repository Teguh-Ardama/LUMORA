import type { FilterParams } from "@lumora/contracts";

/**
 * Real-time LUT preview: approximates the server-side Sharp pipeline
 * (modulate/tint/grayscale) as a CSS `filter` chain on the live <video>.
 * The composed output remains the single source of truth — this exists so
 * the operator and guest see the look BEFORE the shot (FR-05 UX).
 */
export function cssFilterFromParams(params: FilterParams | null | undefined, enabled: boolean): string {
  if (!enabled || !params) return "none";

  const parts: string[] = [];
  if (params.grayscale) {
    parts.push("grayscale(1)");
  } else {
    if (params.saturation !== 1) parts.push(`saturate(${clamp(params.saturation, 0, 3)})`);
    if (params.hue !== 0) parts.push(`hue-rotate(${clamp(params.hue, -180, 180)}deg)`);
    if (params.tint) {
      // Approximate a warm/cool tint with sepia weighted by tint warmth.
      const warmth = (params.tint.r - params.tint.b) / 255;
      if (warmth > 0.05) parts.push(`sepia(${Math.min(0.5, warmth * 0.6).toFixed(2)})`);
    }
  }
  if (params.brightness !== 1) parts.push(`brightness(${clamp(params.brightness, 0.2, 3)})`);
  if (params.gamma && params.gamma > 1) parts.push(`contrast(${Math.min(1.4, 1 + (params.gamma - 1) * 0.35).toFixed(2)})`);

  return parts.length > 0 ? parts.join(" ") : "none";
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
