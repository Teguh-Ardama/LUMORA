import { prisma } from "../client";
import type { Layout, LayoutMode, Prisma } from "@prisma/client";

/**
 * Global 4R (4x6" @300dpi) layouts. Coordinates follow the FR-07 contract
 * in @lumora/contracts (layoutConfigSchema). STRIP slots describe the left
 * column only — the composer mirrors them to the right half.
 */
interface LayoutSeed {
  name: string;
  mode: LayoutMode;
  photoCount: number;
  config: Prisma.InputJsonValue;
}

const GLOBAL_LAYOUTS: LayoutSeed[] = [
  {
    name: "Grid 4 — Landscape 4R",
    mode: "GRID",
    photoCount: 4,
    config: {
      mode: "GRID",
      canvas: { width: 1800, height: 1200 },
      background: "#ffffff",
      slots: [
        { x: 60, y: 60, w: 825, h: 525, photoIndex: 0, radius: 12 },
        { x: 915, y: 60, w: 825, h: 525, photoIndex: 1, radius: 12 },
        { x: 60, y: 615, w: 825, h: 525, photoIndex: 2, radius: 12 },
        { x: 915, y: 615, w: 825, h: 525, photoIndex: 3, radius: 12 },
      ],
    },
  },
  {
    name: "Single — Full 4R",
    mode: "GRID",
    photoCount: 1,
    config: {
      mode: "GRID",
      canvas: { width: 1800, height: 1200 },
      background: "#ffffff",
      slots: [{ x: 60, y: 60, w: 1680, h: 1080, photoIndex: 0, radius: 0 }],
    },
  },
  {
    name: "Grid 2 — 4R",
    mode: "GRID",
    photoCount: 2,
    config: {
      mode: "GRID",
      canvas: { width: 1800, height: 1200 },
      background: "#ffffff",
      slots: [
        { x: 60, y: 60, w: 825, h: 1080, photoIndex: 0, radius: 12 },
        { x: 915, y: 60, w: 825, h: 1080, photoIndex: 1, radius: 12 },
      ],
    },
  },
  {
    name: "Strip 3 — Classic",
    mode: "STRIP",
    photoCount: 3,
    config: {
      mode: "STRIP",
      canvas: { width: 1200, height: 1800 },
      background: "#ffffff",
      slots: [
        { x: 40, y: 40, w: 520, h: 480, photoIndex: 0, radius: 8 },
        { x: 40, y: 560, w: 520, h: 480, photoIndex: 1, radius: 8 },
        { x: 40, y: 1080, w: 520, h: 480, photoIndex: 2, radius: 8 },
      ],
    },
  },
  {
    name: "Strip 4 — Classic",
    mode: "STRIP",
    photoCount: 4,
    config: {
      mode: "STRIP",
      canvas: { width: 1200, height: 1800 },
      background: "#ffffff",
      slots: [
        { x: 40, y: 40, w: 520, h: 375, photoIndex: 0, radius: 8 },
        { x: 40, y: 455, w: 520, h: 375, photoIndex: 1, radius: 8 },
        { x: 40, y: 870, w: 520, h: 375, photoIndex: 2, radius: 8 },
        { x: 40, y: 1285, w: 520, h: 375, photoIndex: 3, radius: 8 },
      ],
    },
  },
];

export async function seedLayouts(): Promise<Layout[]> {
  const out: Layout[] = [];
  for (const l of GLOBAL_LAYOUTS) {
    const existing = await prisma.layout.findFirst({ where: { organizationId: null, eventId: null, name: l.name } });
    if (existing) {
      out.push(
        await prisma.layout.update({
          where: { id: existing.id },
          data: { mode: l.mode, photoCount: l.photoCount, config: l.config },
        }),
      );
    } else {
      out.push(
        await prisma.layout.create({
          data: { organizationId: null, eventId: null, name: l.name, mode: l.mode, photoCount: l.photoCount, config: l.config },
        }),
      );
    }
  }
  return out;
}
