import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function setCors(res: VercelResponse, req: VercelRequest) {
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || req.headers.origin || "");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();

  // Retention sweep (Vercel Cron): GET /api/health?action=retention
  if (req.query.action === "retention") {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const now = new Date();
    const results: Record<string, number> = {};

    const tokenCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const expiredTokens = await prisma.user.updateMany({
      where: { passwordResetExpires: { lt: tokenCutoff }, passwordResetToken: { not: null } },
      data: { passwordResetToken: null, passwordResetExpires: null },
    });
    results.expiredResetTokens = expiredTokens.count;

    const messageCutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const oldMessages = await prisma.message.deleteMany({
      where: { createdAt: { lt: messageCutoff } },
    });
    results.oldMessages = oldMessages.count;

    return res.json({ success: true, timestamp: now.toISOString(), purged: results });
  }

  // Health check
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  return res.json({ status: "ok", timestamp: new Date().toISOString(), runtime: "serverless" });
}
