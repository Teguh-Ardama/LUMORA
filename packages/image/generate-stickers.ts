import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const stickersDir = path.join('D:\\LUMORA\\storage', 'stickers');
if (!fs.existsSync(stickersDir)) {
  fs.mkdirSync(stickersDir, { recursive: true });
}

async function createSticker(filename: string, color: string, text: string) {
  const svg = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="90" fill="${color}" opacity="0.8" />
    <text x="100" y="110" font-family="Arial" font-size="30" text-anchor="middle" fill="white">${text}</text>
  </svg>`;
  
  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(stickersDir, filename));
}

async function main() {
  await createSticker('cat-ears.png', '#ff6b6b', 'Cat');
  await createSticker('bunny-ears.png', '#ff9ff3', 'Bunny');
  await createSticker('clown-nose.png', '#ee5253', 'Clown');
  await createSticker('mustache.png', '#222f3e', 'Mustache');
  await createSticker('cool-glasses.png', '#0abde3', 'Cool');
  console.log('Stickers created!');
}

main().catch(console.error);
