import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const formatJob = (job: any) => ({
  ...job,
  createdAt: job.createdAt instanceof Date ? job.createdAt.toISOString() : job.createdAt,
  updatedAt: job.updatedAt instanceof Date ? job.updatedAt.toISOString() : job.updatedAt,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

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
      // Only include fields that are actually present in the request body
      const allowedFields = [
        "ref", "customer", "pickup", "dropoff", "warehouse", "priority", "status",
        "pallets", "outstandingQty", "eta", "scheduledAt", "actualDeliveryAt",
        "exceptionReason", "driverId", "notes", "transporterBooked", "orderPicked",
        "coaAvailable", "serviceType", "jobType",
      ];
      const data: Record<string, any> = {};
      for (const field of allowedFields) {
        if (field in req.body) {
          data[field] = req.body[field];
        }
      }
      const updatedJob = await prisma.job.update({
        where: { id },
        data,
      });
      return res.json({ success: true, data: formatJob(updatedJob) });
    } catch (error: any) {
      if (error.code === "P2025") return res.status(404).json({ success: false, error: "Job not found" });
      console.error("Error updating job:", error);
      return res.status(500).json({ success: false, error: "Failed to update job" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const deleted = await prisma.job.delete({ where: { id } });
      return res.json({ success: true, data: formatJob(deleted) });
    } catch (error: any) {
      if (error.code === "P2025") return res.status(404).json({ success: false, error: "Job not found" });
      console.error("Error deleting job:", error);
      return res.status(500).json({ success: false, error: "Failed to delete job" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
