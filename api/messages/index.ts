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

const formatDate = (d: unknown) => d instanceof Date ? d.toISOString() : d;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = requireAuth(req.headers.authorization, res);
  if (!user) return res.headersSent ? undefined : res.status(401).json({ success: false, error: "Unauthorized" });

  // GET — messages for current user (inbox)
  if (req.method === "GET") {
    try {
      const { folder, unreadOnly } = req.query;

      if (folder === "sent") {
        // Sent messages
        const messages = await prisma.message.findMany({
          where: { senderId: user.id },
          include: { recipients: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        });
        return res.json({
          success: true,
          data: messages.map((m) => ({
            ...m,
            createdAt: formatDate(m.createdAt),
            recipients: m.recipients.map((r) => ({ ...r, readAt: formatDate(r.readAt), createdAt: formatDate(r.createdAt) })),
          })),
        });
      }

      if (folder === "unread-count") {
        const count = await prisma.messageRecipient.count({
          where: { userId: user.id, readAt: null },
        });
        return res.json({ success: true, data: { count } });
      }

      // Inbox — messages where user is a recipient
      const where: Record<string, unknown> = { userId: user.id };
      if (unreadOnly === "true") where.readAt = null;

      console.log(`[Messages] Inbox query for userId: ${user.id} (${user.username})`);

      const recipientEntries = await prisma.messageRecipient.findMany({
        where,
        include: {
          message: {
            include: { recipients: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      const messages = recipientEntries.map((r) => ({
        ...r.message,
        createdAt: formatDate(r.message.createdAt),
        recipients: r.message.recipients.map((rec) => ({
          ...rec,
          readAt: formatDate(rec.readAt),
          createdAt: formatDate(rec.createdAt),
        })),
        _readAt: formatDate(r.readAt),
      }));

      console.log(`[Messages] Found ${recipientEntries.length} messages for ${user.username}`);
      return res.json({ success: true, data: messages });
    } catch (error) {
      console.error("Error fetching messages:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch messages" });
    }
  }

  // POST — send a new message
  if (req.method === "POST") {
    try {
      const { subject, body, recipientIds, jobRef, priority, broadcast } = req.body;
      if (!subject?.trim() || !body?.trim()) {
        return res.status(400).json({ success: false, error: "Subject and body are required" });
      }

      let targetUserIds: string[] = recipientIds || [];

      // If broadcast, get all user IDs except sender
      if (broadcast) {
        const allUsers = await prisma.user.findMany({ select: { id: true, username: true } });
        targetUserIds = allUsers.filter((u) => u.id !== user.id).map((u) => u.id);
      }

      if (targetUserIds.length === 0) {
        return res.status(400).json({ success: false, error: "At least one recipient is required" });
      }

      // Get usernames for recipients
      const users = await prisma.user.findMany({
        where: { id: { in: targetUserIds } },
        select: { id: true, username: true },
      });

      const message = await prisma.message.create({
        data: {
          senderId: user.id,
          senderName: user.username,
          subject: subject.trim(),
          body: body.trim(),
          jobRef: jobRef || null,
          priority: priority || "normal",
          broadcast: !!broadcast,
          recipients: {
            create: users.map((u) => ({
              userId: u.id,
              username: u.username,
            })),
          },
        },
        include: { recipients: true },
      });

      console.log(`[Messages] Created message "${message.subject}" from ${user.username} to ${users.map(u => u.username).join(", ")} (${users.length} recipients)`);
      return res.status(201).json({
        success: true,
        data: {
          ...message,
          createdAt: formatDate(message.createdAt),
          recipients: message.recipients.map((r) => ({ ...r, readAt: formatDate(r.readAt), createdAt: formatDate(r.createdAt) })),
        },
      });
    } catch (error) {
      console.error("Error creating message:", error);
      return res.status(500).json({ success: false, error: "Failed to send message" });
    }
  }

  // PUT — mark message as read (pass ?id=xxx)
  if (req.method === "PUT") {
    const { id } = req.query;
    if (!id || typeof id !== "string") return res.status(400).json({ success: false, error: "Message ID required (?id=xxx)" });
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

  // DELETE — delete message (sender only, pass ?id=xxx)
  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id || typeof id !== "string") return res.status(400).json({ success: false, error: "Message ID required (?id=xxx)" });
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
