/**
 * LUMORA seed — idempotent. Creates:
 *  - global filters (FR-05)
 *  - global 4R layouts (FR-07: GRID + STRIP)
 *  - global borders rendered programmatically (FR-08 global library)
 *  - a demo organization with owner + operator accounts and one ACTIVE event
 *
 * Run: pnpm db:seed  (requires .env at repo root)
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, "../../../../.env") });
loadEnv(); // fallback: cwd

import { prisma } from "../client";
import { seedFilters } from "./filters";
import { seedLayouts } from "./layouts";
import { seedBorders } from "./borders";
import { seedStickers } from "./stickers";
import { seedDemoOrg } from "./demo-org";

async function main() {
  console.log("── LUMORA seed ──");
  await seedFilters();
  console.log("✓ global filters");
  const layouts = await seedLayouts();
  console.log(`✓ global layouts (${layouts.length})`);
  const borders = await seedBorders();
  console.log(`✓ global borders (${borders.length})`);
  const stickers = await seedStickers();
  console.log(`✓ global stickers (${stickers.length})`);
  await seedDemoOrg({ layouts, borders });
  console.log("✓ demo organization (admin@lumora.dev / operator@lumora.dev — password: Lumora123!)");
  console.log("── done ──");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
