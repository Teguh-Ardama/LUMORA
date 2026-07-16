import sharp from "sharp";
import { getStorage, storageKeys } from "@lumora/core";
import { prisma } from "../client";
import type { Sticker } from "@prisma/client";

/**
 * Global sticker library — rendered as transparent PNGs so a fresh install
 * has usable presets without uploads. Each sticker has an anchor point that
 * determines where on the face it attaches (FR-10).
 */
interface StickerSeed {
  name: string;
  anchorPoint: "FOREHEAD" | "LEFT_EYE" | "RIGHT_EYE" | "NOSE" | "MOUTH" | "CHIN" | "LEFT_EAR" | "RIGHT_EAR" | "FULL_FACE";
  defaultScale: number;
  defaultOffsetX: number;
  defaultOffsetY: number;
  svg: string;
}

const GLOBAL_STICKERS: StickerSeed[] = [
  {
    name: "Topi Hitam",
    anchorPoint: "FOREHEAD",
    defaultScale: 1.0,
    defaultOffsetX: 0,
    defaultOffsetY: -60,
    svg: `<svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="100" cy="80" rx="90" ry="25" fill="#1a1a1a"/>
      <rect x="55" y="10" width="90" height="75" rx="8" fill="#1a1a1a"/>
      <rect x="55" y="10" width="90" height="10" rx="4" fill="#2d2d2d"/>
    </svg>`,
  },
  {
    name: "Kacamata Bulat",
    anchorPoint: "NOSE",
    defaultScale: 1.0,
    defaultOffsetX: 0,
    defaultOffsetY: 0,
    svg: `<svg width="240" height="100" xmlns="http://www.w3.org/2000/svg">
      <circle cx="60" cy="50" r="38" fill="none" stroke="#1a1a1a" stroke-width="4"/>
      <circle cx="180" cy="50" r="38" fill="none" stroke="#1a1a1a" stroke-width="4"/>
      <line x1="98" y1="50" x2="142" y2="50" stroke="#1a1a1a" stroke-width="3"/>
      <line x1="22" y1="50" x2="0" y2="35" stroke="#1a1a1a" stroke-width="3"/>
      <line x1="218" y1="50" x2="240" y2="35" stroke="#1a1a1a" stroke-width="3"/>
    </svg>`,
  },
  {
    name: "Kumis",
    anchorPoint: "MOUTH",
    defaultScale: 0.8,
    defaultOffsetX: 0,
    defaultOffsetY: -5,
    svg: `<svg width="200" height="80" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="40" rx="45" ry="25" fill="#2a1a0a"/>
      <ellipse cx="150" cy="40" rx="45" ry="25" fill="#2a1a0a"/>
      <ellipse cx="100" cy="25" rx="20" ry="10" fill="#2a1a0a"/>
    </svg>`,
  },
  {
    name: "Mahkota Bunga",
    anchorPoint: "FOREHEAD",
    defaultScale: 1.0,
    defaultOffsetX: 0,
    defaultOffsetY: -70,
    svg: `<svg width="300" height="150" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="80" r="22" fill="#ff6b9d" opacity="0.9"/>
      <circle cx="80" cy="50" r="22" fill="#ffb347" opacity="0.9"/>
      <circle cx="150" cy="30" r="22" fill="#ff6b9d" opacity="0.9"/>
      <circle cx="220" cy="50" r="22" fill="#ffb347" opacity="0.9"/>
      <circle cx="270" cy="80" r="22" fill="#ff6b9d" opacity="0.9"/>
      <circle cx="55" cy="55" r="10" fill="#fff" opacity="0.4"/>
      <circle cx="125" cy="35" r="10" fill="#fff" opacity="0.4"/>
      <circle cx="195" cy="55" r="10" fill="#fff" opacity="0.4"/>
    </svg>`,
  },
  {
    name: "Telinga Kucing",
    anchorPoint: "FOREHEAD",
    defaultScale: 0.9,
    defaultOffsetX: 0,
    defaultOffsetY: -100,
    svg: `<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
      <polygon points="30,160 75,15 120,100" fill="#ff8c42" stroke="#cc6020" stroke-width="3"/>
      <polygon points="180,100 225,15 270,160" fill="#ff8c42" stroke="#cc6020" stroke-width="3"/>
      <polygon points="50,140 75,35 100,110" fill="#ffb07a"/>
      <polygon points="200,110 225,35 250,140" fill="#ffb07a"/>
    </svg>`,
  },
  {
    name: "Monocle",
    anchorPoint: "RIGHT_EYE",
    defaultScale: 0.8,
    defaultOffsetX: 10,
    defaultOffsetY: 0,
    svg: `<svg width="120" height="120" xmlns="http://www.w3.org/2000/svg">
      <circle cx="55" cy="55" r="40" fill="none" stroke="#b8860b" stroke-width="4"/>
      <line x1="95" y1="55" x2="110" y2="85" stroke="#b8860b" stroke-width="3"/>
      <circle cx="55" cy="55" r="38" fill="none" stroke="#b8860b" stroke-width="1.5"/>
    </svg>`,
  },
  {
    name: "Congrats",
    anchorPoint: "FOREHEAD",
    defaultScale: 1.2,
    defaultOffsetX: 0,
    defaultOffsetY: -120,
    svg: `<svg width="300" height="100" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 50 Q 150 10 290 50 L 290 90 Q 150 50 10 90 Z" fill="#111827"/>
      <text x="150" y="65" font-family="sans-serif" font-size="32" font-weight="bold" fill="#F8FAFC" text-anchor="middle" transform="rotate(-5 150 65)">Congrats!</text>
    </svg>`,
  },
  {
    name: "Lets Celebrate",
    anchorPoint: "FOREHEAD",
    defaultScale: 1.2,
    defaultOffsetX: 0,
    defaultOffsetY: -120,
    svg: `<svg width="300" height="100" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 50 Q 150 10 290 50 L 290 90 Q 150 50 10 90 Z" fill="#111827"/>
      <text x="150" y="65" font-family="sans-serif" font-size="28" font-weight="bold" fill="#F8FAFC" text-anchor="middle" transform="rotate(5 150 65)">Let's Celebrate!</text>
    </svg>`,
  },
];

export async function seedStickers(): Promise<Sticker[]> {
  const storage = getStorage();
  const out: Sticker[] = [];
  for (const s of GLOBAL_STICKERS) {
    const existing = await prisma.sticker.findFirst({
      where: { organizationId: null, eventId: null, name: s.name },
    });
    if (existing) {
      out.push(existing);
      continue;
    }
    const png = await sharp(Buffer.from(s.svg)).png().toBuffer();
    const created = await prisma.sticker.create({
      data: {
        name: s.name,
        storageKey: "pending",
        anchorPoint: s.anchorPoint,
        defaultScale: s.defaultScale,
        defaultOffsetX: s.defaultOffsetX,
        defaultOffsetY: s.defaultOffsetY,
        sizeBytes: png.length,
      },
    });
    const key = storageKeys.sticker("global", created.id);
    await storage.putObject({ key, body: png, contentType: "image/png" });
    out.push(await prisma.sticker.update({ where: { id: created.id }, data: { storageKey: key } }));
  }
  return out;
}
