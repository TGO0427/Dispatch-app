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
  if (!id || typeof id !== "string") return res.status(400).json({ success: false, error: "Batch ID required" });

  // PUT — update batch (mark returned, edit qty/batch number)
  if (req.method === "PUT") {
    if (user.role === "viewer") return res.status(403).json({ success: false, error: "Viewers cannot modify data" });
    try {
      const data: Record<string, unknown> = {};
      if (req.body.batchNumber !== undefined) data.batchNumber = req.body.batchNumber;
      if (req.body.quantity !== undefined) data.quantity = Number(req.body.quantity);
      if (req.body.returnedAt !== undefined) data.returnedAt = req.body.returnedAt ? new Date(req.body.returnedAt) : null;
      if (req.body.quantityReturned !== undefined) data.quantityReturned = req.body.quantityReturned !== null ? Number(req.body.quantityReturned) : null;
      if (req.body.returnNotes !== undefined) data.returnNotes = req.body.returnNotes || null;

      const batch = await prisma.flowbinBatch.update({ where: { id }, data });
      return res.json({ success: true, data: batch });
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError.code === "P2025") return res.status(404).json({ success: false, error: "Batch not found" });
      console.error("Error updating batch:", error);
      return res.status(500).json({ success: false, error: "Failed to update batch" });
    }
  }

  // DELETE — remove batch
  if (req.method === "DELETE") {
    if (user.role === "viewer") return res.status(403).json({ success: false, error: "Viewers cannot modify data" });
    try {
      await prisma.flowbinBatch.delete({ where: { id } });
      return res.json({ success: true });
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError.code === "P2025") return res.status(404).json({ success: false, error: "Batch not found" });
      console.error("Error deleting batch:", error);
      return res.status(500).json({ success: false, error: "Failed to delete batch" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
