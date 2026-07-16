import { config } from 'dotenv';
config({ path: '../../.env' });
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const stickers = await prisma.sticker.findMany();
  console.log(JSON.stringify(stickers, null, 2));
  await prisma.$disconnect();
}
run();
