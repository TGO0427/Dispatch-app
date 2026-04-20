import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { validateOrigin } from "../_lib.js";

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
  if (!validateOrigin(req)) return res.status(403).json({ success: false, error: "Forbidden" });

  const user = requireAuth(req.headers.authorization, res);
  if (!user) return res.headersSent ? undefined : res.status(401).json({ success: false, error: "Unauthorized" });

  // GET — all jobs with flowbins + their batches
  if (req.method === "GET") {
    try {
      const jobs = await prisma.job.findMany({
        where: { hasFlowbin: true },
        include: { flowbinBatches: true },
        orderBy: { eta: "asc" },
      });
      return res.json({ success: true, data: jobs.map((j) => ({
        ...j,
        createdAt: j.createdAt instanceof Date ? j.createdAt.toISOString() : j.createdAt,
        updatedAt: j.updatedAt instanceof Date ? j.updatedAt.toISOString() : j.updatedAt,
      })) });
    } catch (error) {
      console.error("Error fetching flowbins:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch flowbins" });
    }
  }

  // POST — create a new batch
  if (req.method === "POST") {
    if (user.role === "viewer") return res.status(403).json({ success: false, error: "Viewers cannot modify data" });
    try {
      const { jobId, batchNumber, quantity } = req.body;
      if (!jobId || !batchNumber || !quantity) {
        return res.status(400).json({ success: false, error: "jobId, batchNumber, and quantity are required" });
      }
      const batch = await prisma.flowbinBatch.create({
        data: { jobId, batchNumber, quantity: Number(quantity) },
      });
      return res.status(201).json({ success: true, data: batch });
    } catch (error) {
      console.error("Error creating flowbin batch:", error);
      return res.status(500).json({ success: false, error: "Failed to create batch" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
