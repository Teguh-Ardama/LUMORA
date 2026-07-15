/**
 * AR accessory styles — programmatic vector rendering, no bitmap assets.
 * Everything is drawn in a normalized "glasses space" where 1.0 equals the
 * outer-eye-corner distance, so accessories scale and rotate perfectly with
 * the face at any distance from the camera.
 *
 * Design rules (deliberate): classic eyewear silhouettes, muted palettes,
 * soft translucency — premium photobooth props, never novelty clip-art.
 */

export interface ArStyle {
  id: string;
  name: string;
  /** Draw centered at origin; +x = toward subject's left eye, y down. */
  draw: (ctx: CanvasRenderingContext2D, eyeDistance: number) => void;
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Classic wayfarer: matte charcoal frame, smoked translucent lens. */
function drawWayfarer(ctx: CanvasRenderingContext2D, d: number): void {
  const lensW = d * 0.52;
  const lensH = d * 0.42;
  const gap = d * 0.14;
  const radius = lensH * 0.32;
  const frame = "#1d1f24";
  const lens = "rgba(38, 40, 48, 0.42)";

  for (const side of [-1, 1] as const) {
    const x = side === -1 ? -gap / 2 - lensW : gap / 2;
    const y = -lensH / 2;
    roundedRectPath(ctx, x, y, lensW, lensH, radius);
    ctx.fillStyle = lens;
    ctx.fill();
    ctx.lineWidth = d * 0.055;
    ctx.strokeStyle = frame;
    ctx.stroke();
    // Subtle top-edge highlight for depth.
    ctx.beginPath();
    ctx.moveTo(x + radius, y + lensH * 0.18);
    ctx.quadraticCurveTo(x + lensW / 2, y + lensH * 0.06, x + lensW - radius, y + lensH * 0.18);
    ctx.lineWidth = d * 0.02;
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.stroke();
  }
  // Bridge
  ctx.beginPath();
  ctx.moveTo(-gap / 2, -lensH * 0.16);
  ctx.quadraticCurveTo(0, -lensH * 0.34, gap / 2, -lensH * 0.16);
  ctx.lineWidth = d * 0.05;
  ctx.strokeStyle = frame;
  ctx.stroke();
}

/** Aviator: fine gold metal frame, warm gradient smoke lens. */
function drawAviator(ctx: CanvasRenderingContext2D, d: number): void {
  const lensW = d * 0.55;
  const lensH = d * 0.5;
  const gap = d * 0.1;
  const gold = "#b8934f";

  for (const side of [-1, 1] as const) {
    const cx = side * (gap / 2 + lensW / 2);
    ctx.beginPath();
    ctx.ellipse(cx, lensH * 0.04, lensW / 2, lensH / 2, 0, 0, Math.PI * 2);
    const grad = ctx.createLinearGradient(cx, -lensH / 2, cx, lensH / 2);
    grad.addColorStop(0, "rgba(58, 46, 38, 0.55)");
    grad.addColorStop(1, "rgba(84, 66, 48, 0.22)");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = d * 0.028;
    ctx.strokeStyle = gold;
    ctx.stroke();
  }
  // Double bridge
  ctx.strokeStyle = gold;
  ctx.lineWidth = d * 0.026;
  ctx.beginPath();
  ctx.moveTo(-gap / 2, -lensH * 0.1);
  ctx.quadraticCurveTo(0, -lensH * 0.26, gap / 2, -lensH * 0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-gap / 2 - d * 0.02, lensH * 0.02);
  ctx.quadraticCurveTo(0, -lensH * 0.12, gap / 2 + d * 0.02, lensH * 0.02);
  ctx.stroke();
}

/** Retro round: thin antique-gold circles, near-clear lens. */
function drawRetroRound(ctx: CanvasRenderingContext2D, d: number): void {
  const r = d * 0.26;
  const gap = d * 0.16;
  const gold = "#a08758";

  for (const side of [-1, 1] as const) {
    const cx = side * (gap / 2 + r);
    ctx.beginPath();
    ctx.arc(cx, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(210, 216, 228, 0.14)";
    ctx.fill();
    ctx.lineWidth = d * 0.024;
    ctx.strokeStyle = gold;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-gap / 2, -r * 0.18);
  ctx.quadraticCurveTo(0, -r * 0.55, gap / 2, -r * 0.18);
  ctx.lineWidth = d * 0.024;
  ctx.strokeStyle = gold;
  ctx.stroke();
}

export const AR_STYLES: readonly ArStyle[] = [
  { id: "wayfarer", name: "Classic Noir", draw: drawWayfarer },
  { id: "aviator", name: "Aviator Gold", draw: drawAviator },
  { id: "round", name: "Retro Round", draw: drawRetroRound },
];

export function getArStyle(id: string | null): ArStyle | null {
  if (!id) return null;
  return AR_STYLES.find((s) => s.id === id) ?? null;
}
