import { config } from 'dotenv';
config({ path: '../../.env' });
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const session = await prisma.session.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, composeError: true }
  });
  console.log("Latest Session:", session);
  await prisma.$disconnect();
}
run();
