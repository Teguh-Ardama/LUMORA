import { config } from 'dotenv';
config({ path: '../../.env' });
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function createSticker(storageKey: string, text: string) {
  const fullPath = path.join('D:\\LUMORA\\storage', storageKey.replace(/\//g, path.sep));
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const svg = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="90" fill="#ff6b6b" opacity="0.8" />
    <text x="100" y="110" font-family="Arial" font-size="20" text-anchor="middle" fill="white">${text}</text>
  </svg>`;
  
  await sharp(Buffer.from(svg))
    .png()
    .toFile(fullPath);
  console.log('Created', fullPath);
}

async function main() {
  const stickers = await prisma.sticker.findMany();
  for (const st of stickers) {
    await createSticker(st.storageKey, st.name);
  }
  console.log('Stickers created from DB!');
  await prisma.$disconnect();
}

main().catch(console.error);
