import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function setCors(res: VercelResponse, req: VercelRequest) {
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || req.headers?.origin || "");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

interface JwtPayload { id: string; username: string; email: string; role: string }

function requireAuth(authHeader: string | undefined, res: VercelResponse): JwtPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) { res.status(500).json({ success: false, error: "Server configuration error" }); return null; }
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try { return jwt.verify(authHeader.slice(7), secret) as JwtPayload; } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = requireAuth(req.headers.authorization, res);
  if (!user) return res.headersSent ? undefined : res.status(401).json({ success: false, error: "Unauthorized" });

  const { id } = req.query;
  if (!id || typeof id !== "string") return res.status(400).json({ success: false, error: "Message ID required" });

  // PUT — mark message as read
  if (req.method === "PUT") {
    try {
      const recipient = await prisma.messageRecipient.findFirst({
        where: { messageId: id, userId: user.id },
      });
      if (!recipient) return res.status(404).json({ success: false, error: "Message not found" });

      await prisma.messageRecipient.update({
        where: { id: recipient.id },
        data: { readAt: new Date() },
      });

      return res.json({ success: true });
    } catch (error) {
      console.error("Error marking message read:", error);
      return res.status(500).json({ success: false, error: "Failed to update message" });
    }
  }

  // DELETE — delete message (sender only)
  if (req.method === "DELETE") {
    try {
      const message = await prisma.message.findUnique({ where: { id } });
      if (!message) return res.status(404).json({ success: false, error: "Message not found" });
      if (message.senderId !== user.id) return res.status(403).json({ success: false, error: "Only the sender can delete a message" });

      await prisma.message.delete({ where: { id } });
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting message:", error);
      return res.status(500).json({ success: false, error: "Failed to delete message" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
