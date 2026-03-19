import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function setCors(res: VercelResponse, req: VercelRequest) {
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

interface JwtPayload { id: string; username: string; email: string; role: string }

function requireAuth(authHeader: string | undefined): JwtPayload | null {
  const secret = process.env.JWT_SECRET || "dev-only-fallback-key";
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try { return jwt.verify(authHeader.slice(7), secret) as JwtPayload; } catch { return null; }
}

const formatJob = (job: Record<string, unknown>) => ({
  ...job,
  createdAt: job.createdAt instanceof Date ? job.createdAt.toISOString() : job.createdAt,
  updatedAt: job.updatedAt instanceof Date ? job.updatedAt.toISOString() : job.updatedAt,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = requireAuth(req.headers.authorization);
  if (!user) return res.status(401).json({ success: false, error: "Unauthorized" });

  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ success: false, error: "Job ID required" });
  }

  if (req.method === "GET") {
    try {
      const job = await prisma.job.findUnique({ where: { id } });
      if (!job) return res.status(404).json({ success: false, error: "Job not found" });
      return res.json({ success: true, data: formatJob(job) });
    } catch (error) {
      console.error("Error fetching job:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch job" });
    }
  }

  if (req.method === "PUT") {
    try {
      const allowedFields = [
        "ref", "customer", "pickup", "dropoff", "warehouse", "priority", "status",
        "pallets", "outstandingQty", "eta", "scheduledAt", "actualDeliveryAt",
        "exceptionReason", "driverId", "notes", "transporterBooked", "orderPicked",
        "coaAvailable", "serviceType", "jobType", "transportService", "etd",
      ];
      const requiredStringFields = new Set(["ref", "customer", "pickup", "dropoff", "priority", "status"]);
      const data: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (field in req.body) {
          const value = req.body[field];
          if (requiredStringFields.has(field) && (value === null || value === undefined)) continue;
          data[field] = value;
        }
      }
      const updatedJob = await prisma.job.update({ where: { id }, data });
      return res.json({ success: true, data: formatJob(updatedJob) });
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError.code === "P2025") return res.status(404).json({ success: false, error: "Job not found" });
      console.error("Error updating job:", error);
      return res.status(500).json({ success: false, error: "Failed to update job" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const deleted = await prisma.job.delete({ where: { id } });
      return res.json({ success: true, data: formatJob(deleted) });
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError.code === "P2025") return res.status(404).json({ success: false, error: "Job not found" });
      console.error("Error deleting job:", error);
      return res.status(500).json({ success: false, error: "Failed to delete job" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
