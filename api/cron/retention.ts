import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Nightly retention sweep (Vercel Cron)
 *
 * - Expired password reset tokens: purged 30 days after expiry
 * - Old messages: purged after 365 days
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify this is a cron invocation (Vercel sets this header)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const now = new Date();
  const results: Record<string, number> = {};

  // 1. Purge expired password reset tokens (30 days past expiry)
  const tokenCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const expiredTokens = await prisma.user.updateMany({
    where: {
      passwordResetExpires: { lt: tokenCutoff },
      passwordResetToken: { not: null },
    },
    data: { passwordResetToken: null, passwordResetExpires: null },
  });
  results.expiredResetTokens = expiredTokens.count;

  // 2. Purge old messages (365 days)
  const messageCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const oldMessages = await prisma.message.deleteMany({
    where: { createdAt: { lt: messageCutoff } },
  });
  results.oldMessages = oldMessages.count;

  return res.json({
    success: true,
    timestamp: now.toISOString(),
    purged: results,
  });
}
