const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const sessions = await prisma.session.findMany({ where: { status: 'FAILED' }, orderBy: { updatedAt: 'desc' }, take: 1 });
  console.log(sessions[0].composeError);
  await prisma.$disconnect();
}
run();
