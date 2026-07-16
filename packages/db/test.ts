import { config } from 'dotenv';
config({ path: '../../.env' });
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const filters = await prisma.filter.findMany();
  console.log(JSON.stringify(filters, null, 2));
  await prisma.$disconnect();
}
run();
