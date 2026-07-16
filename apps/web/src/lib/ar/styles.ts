/**
 * AR accessory styles — programmatic vector rendering, no bitmap assets.
 * Everything is drawn in a normalized "glasses space" where 1.0 equals the
 * outer-eye-corner distance, so accessories scale and rotate perfectly with
 * the face at any distance from the camera.
 *
 * Design rules (deliberate): classic eyewear silhouettes, muted palettes,
 * soft translucency — premium photobooth props, never novelty clip-art.
 */

export type ArAnchor = "eyes" | "nose" | "mouth" | "head";

export interface ArStyle {
  id: string;
  name: string;
  /** Where to anchor the accessory. Default is 'eyes'. */
  anchor?: ArAnchor;
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

/** Mustache: Classic handlebar drawn above the mouth. */
function drawMustache(ctx: CanvasRenderingContext2D, d: number): void {
  const w = d * 0.8;
  const h = d * 0.25;
  const color = "#2a1f1a"; // Dark brown

  ctx.fillStyle = color;
  ctx.beginPath();
  // Start from center top (under nose)
  ctx.moveTo(0, -h * 0.2);
  // Curve down to right tip
  ctx.bezierCurveTo(w * 0.2, -h * 0.2, w * 0.4, h * 0.5, w / 2, h * 0.8);
  // Curve back up to center bottom
  ctx.bezierCurveTo(w * 0.3, h * 0.9, w * 0.1, h * 0.3, 0, h * 0.2);
  // Curve down to left tip
  ctx.bezierCurveTo(-w * 0.1, h * 0.3, -w * 0.3, h * 0.9, -w / 2, h * 0.8);
  // Curve back up to center top
  ctx.bezierCurveTo(-w * 0.4, h * 0.5, -w * 0.2, -h * 0.2, 0, -h * 0.2);
  ctx.fill();
}

/** Bunny Ears: Two tall ears drawn on top of the head. */
function drawBunnyEars(ctx: CanvasRenderingContext2D, d: number): void {
  const earW = d * 0.35;
  const earH = d * 1.5;
  const gap = d * 0.4;
  
  for (const side of [-1, 1] as const) {
    const cx = side * gap;
    ctx.save();
    ctx.translate(cx, -earH * 0.4);
    // Slight outward tilt
    ctx.rotate(side * 0.15);
    
    // Outer white/fluffy part
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(0, 0, earW / 2, earH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = d * 0.02;
    ctx.strokeStyle = "#e2e8f0";
    ctx.stroke();
    
    // Inner pink part
    ctx.fillStyle = "#fbcfe8";
    ctx.beginPath();
    ctx.ellipse(0, earH * 0.05, earW * 0.25, earH * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }
}

/** Cat: A cute pink nose and whiskers drawn on the nose. */
function drawCatNose(ctx: CanvasRenderingContext2D, d: number): void {
  const noseW = d * 0.25;
  const noseH = d * 0.15;
  
  // Nose
  ctx.fillStyle = "#f472b6";
  ctx.beginPath();
  // Triangle pointing down with rounded corners
  ctx.moveTo(-noseW / 2, -noseH / 2);
  ctx.quadraticCurveTo(0, -noseH * 0.8, noseW / 2, -noseH / 2);
  ctx.lineTo(noseW * 0.1, noseH / 2);
  ctx.quadraticCurveTo(0, noseH * 0.8, -noseW * 0.1, noseH / 2);
  ctx.closePath();
  ctx.fill();
  
  // Whiskers
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = d * 0.015;
  ctx.lineCap = "round";
  
  const whiskerL = d * 0.4;
  for (const side of [-1, 1] as const) {
    for (const angle of [-0.1, 0, 0.1]) {
      ctx.beginPath();
      // Start slightly outside the nose
      const startX = side * noseW * 0.6;
      ctx.moveTo(startX, 0);
      ctx.lineTo(startX + side * whiskerL, angle * d * 0.5);
      ctx.stroke();
    }
  }
}

export const AR_STYLES: readonly ArStyle[] = [
  { id: "wayfarer", name: "Classic Noir", draw: drawWayfarer, anchor: "eyes" },
  { id: "aviator", name: "Aviator Gold", draw: drawAviator, anchor: "eyes" },
  { id: "round", name: "Retro Round", draw: drawRetroRound, anchor: "eyes" },
  { id: "mustache", name: "Gentleman", draw: drawMustache, anchor: "mouth" },
  { id: "bunny", name: "Bunny Ears", draw: drawBunnyEars, anchor: "head" },
  { id: "cat", name: "Meow", draw: drawCatNose, anchor: "nose" },
];

export function getArStyle(id: string | null): ArStyle | null {
  if (!id) return null;
  return AR_STYLES.find((s) => s.id === id) ?? null;
}
