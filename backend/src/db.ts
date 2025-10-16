import { PrismaClient } from '@prisma/client';

// Create a single Prisma Client instance
const prisma = new PrismaClient();

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
