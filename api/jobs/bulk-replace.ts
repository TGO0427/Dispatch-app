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

const MAX_BATCH_SIZE = 500;

const formatJob = (job: Record<string, unknown>) => ({
  ...job,
  createdAt: job.createdAt instanceof Date ? job.createdAt.toISOString() : job.createdAt,
  updatedAt: job.updatedAt instanceof Date ? job.updatedAt.toISOString() : job.updatedAt,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  const user = requireAuth(req.headers.authorization);
  if (!user) return res.status(401).json({ success: false, error: "Unauthorized" });

  try {
    if (!Array.isArray(req.body.jobs)) {
      return res.status(400).json({ success: false, error: "Request body must include a 'jobs' array" });
    }
    if (req.body.jobs.length > MAX_BATCH_SIZE) {
      return res.status(400).json({ success: false, error: `Batch size cannot exceed ${MAX_BATCH_SIZE}` });
    }

    const jobType = req.body.jobType || "order";
    const validJobTypes = ["order", "ibt"];
    if (!validJobTypes.includes(jobType)) {
      return res.status(400).json({ success: false, error: "Invalid jobType" });
    }

    const jobsData = req.body.jobs.map((job: Record<string, unknown>) => ({
      ref: job.ref as string, customer: job.customer as string,
      pickup: job.pickup as string, dropoff: job.dropoff as string,
      warehouse: job.warehouse as string | undefined,
      priority: (job.priority as string) || "normal",
      status: (job.status as string) || "pending",
      jobType,
      pallets: job.pallets as number | undefined,
      outstandingQty: job.outstandingQty as number | undefined,
      eta: job.eta as string | undefined,
      scheduledAt: job.scheduledAt as string | undefined,
      actualDeliveryAt: job.actualDeliveryAt as string | undefined,
      exceptionReason: job.exceptionReason as string | undefined,
      driverId: job.driverId as string | undefined,
      notes: job.notes as string | undefined,
      transporterBooked: job.transporterBooked as boolean | undefined,
      orderPicked: job.orderPicked as boolean | undefined,
      coaAvailable: job.coaAvailable as boolean | undefined,
      serviceType: job.serviceType as string | undefined,
      transportService: job.transportService as string | undefined,
      etd: job.etd as string | undefined,
    }));

    const result = await prisma.$transaction(async (tx) => {
      await tx.job.deleteMany({ where: { jobType } });
      await tx.job.createMany({ data: jobsData });
      return tx.job.findMany({ where: { jobType }, orderBy: { createdAt: "desc" } });
    });

    return res.status(201).json({ success: true, data: result.map(formatJob) });
  } catch (error) {
    console.error("Error bulk replacing jobs:", error);
    return res.status(500).json({ success: false, error: "Failed to bulk replace jobs" });
  }
}
