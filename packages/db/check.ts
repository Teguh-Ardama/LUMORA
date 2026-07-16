import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.session.findFirst({ orderBy: { createdAt: 'desc' } })
  .then(s => console.log("ERROR:", s?.composeError))
  .finally(() => prisma.$disconnect());
