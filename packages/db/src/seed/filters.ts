import { prisma } from "../client";
import type { FilterKind, Prisma } from "@prisma/client";

interface FilterSeed {
  name: string;
  kind: FilterKind;
  params: Prisma.InputJsonValue;
}

const GLOBAL_FILTERS: FilterSeed[] = [
  { name: "Normal", kind: "NORMAL", params: { brightness: 1, saturation: 1, hue: 0, grayscale: false } },
  { name: "Black & White", kind: "GRAYSCALE", params: { brightness: 1.05, saturation: 1, hue: 0, grayscale: true } },
  {
    name: "Vintage",
    kind: "VINTAGE",
    params: { brightness: 1.02, saturation: 0.72, hue: -8, grayscale: false, tint: { r: 243, g: 226, b: 195 }, gamma: 1.08 },
  },
  {
    name: "Sepia",
    kind: "SEPIA",
    params: { brightness: 1, saturation: 0.35, hue: 0, grayscale: false, tint: { r: 112, g: 84, b: 62 } },
  },
  { name: "Cool", kind: "COOL", params: { brightness: 1, saturation: 1.05, hue: 18, grayscale: false } },
  { name: "Warm", kind: "WARM", params: { brightness: 1.03, saturation: 1.1, hue: -12, grayscale: false } },
];

export async function seedFilters() {
  for (const f of GLOBAL_FILTERS) {
    const existing = await prisma.filter.findFirst({ where: { organizationId: null, name: f.name } });
    if (existing) {
      await prisma.filter.update({ where: { id: existing.id }, data: { kind: f.kind, params: f.params } });
    } else {
      await prisma.filter.create({ data: { organizationId: null, name: f.name, kind: f.kind, params: f.params } });
    }
  }
}
