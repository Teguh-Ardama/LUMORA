import sharp from "sharp";
import { getStorage, storageKeys } from "@lumora/core";
import { prisma } from "../client";
import type { Border } from "@prisma/client";

/**
 * Global border library, rendered programmatically so a fresh install has
 * a usable catalog without any uploads. Borders are transparent PNGs the
 * composer overlays ON TOP of placed photos; only the frame areas are
 * painted, photo windows stay transparent.
 */
interface BorderSeed {
  name: string;
  width: number;
  height: number;
  svg: string;
}

function landscapeFrame(fill: string, accent: string, label: string): string {
  return `
<svg width="1800" height="1200" xmlns="http://www.w3.org/2000/svg">
  <path d="M0 0 H1800 V1200 H0 Z M60 60 H1740 V1140 H60 Z" fill="${fill}" fill-rule="evenodd"/>
  <rect x="52" y="52" width="1696" height="1096" fill="none" stroke="${accent}" stroke-width="3"/>
  <text x="900" y="1182" text-anchor="middle" font-family="Georgia, serif" font-size="30"
        letter-spacing="14" fill="${accent}">${label}</text>
</svg>`;
}

function stripFrame(fill: string, accent: string, label: string, textFill: string): string {
  // Windows (transparent): left column x 40..560, right column x 640..1160,
  // rows y 40..1560. Bottom band 1560..1800 carries the caption per strip.
  return `
<svg width="1200" height="1800" xmlns="http://www.w3.org/2000/svg">
  <path d="M0 0 H1200 V1800 H0 Z M40 40 H560 V1560 H40 Z M640 40 H1160 V1560 H640 Z"
        fill="${fill}" fill-rule="evenodd"/>
  <line x1="600" y1="0" x2="600" y2="1800" stroke="${accent}" stroke-width="2" stroke-dasharray="14 10"/>
  <text x="300" y="1690" text-anchor="middle" font-family="Georgia, serif" font-size="44"
        letter-spacing="10" fill="${textFill}">${label}</text>
  <text x="900" y="1690" text-anchor="middle" font-family="Georgia, serif" font-size="44"
        letter-spacing="10" fill="${textFill}">${label}</text>
</svg>`;
}

const GLOBAL_BORDERS: BorderSeed[] = [
  { name: "Classic White — Landscape 4R", width: 1800, height: 1200, svg: landscapeFrame("#ffffff", "#c9c2b4", "LUMORA") },
  { name: "Noir — Landscape 4R", width: 1800, height: 1200, svg: landscapeFrame("#14151a", "#b99b5f", "LUMORA") },
  { name: "Strip Classic — Portrait 4R", width: 1200, height: 1800, svg: stripFrame("#ffffff", "#d8d2c6", "LUMORA", "#8f887a") },
  { name: "Strip Noir — Portrait 4R", width: 1200, height: 1800, svg: stripFrame("#14151a", "#b99b5f", "LUMORA", "#b99b5f") },
];

export async function seedBorders(): Promise<Border[]> {
  const storage = getStorage();
  const out: Border[] = [];
  for (const b of GLOBAL_BORDERS) {
    const existing = await prisma.border.findFirst({
      where: { organizationId: null, eventId: null, name: b.name },
    });
    if (existing) {
      out.push(existing);
      continue;
    }
    const png = await sharp(Buffer.from(b.svg)).png().toBuffer();
    const created = await prisma.border.create({
      data: {
        organizationId: null,
        eventId: null,
        name: b.name,
        storageKey: "pending",
        width: b.width,
        height: b.height,
        sizeBytes: png.length,
      },
    });
    const key = storageKeys.border("global", created.id);
    await storage.putObject({ key, body: png, contentType: "image/png" });
    out.push(await prisma.border.update({ where: { id: created.id }, data: { storageKey: key } }));
  }
  return out;
}
