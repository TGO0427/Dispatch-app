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
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const jobsData = req.body.jobs.map((job: any) => ({
      ref: job.ref, customer: job.customer, pickup: job.pickup, dropoff: job.dropoff,
      warehouse: job.warehouse, priority: job.priority || "normal", status: job.status || "pending",
      jobType: job.jobType || "order", pallets: job.pallets, outstandingQty: job.outstandingQty,
      eta: job.eta, scheduledAt: job.scheduledAt, actualDeliveryAt: job.actualDeliveryAt,
      exceptionReason: job.exceptionReason, driverId: job.driverId, notes: job.notes,
      transporterBooked: job.transporterBooked, orderPicked: job.orderPicked, coaAvailable: job.coaAvailable, serviceType: job.serviceType,
    }));

    const result = await prisma.job.createMany({ data: jobsData });
    const createdJobs = await prisma.job.findMany({ orderBy: { createdAt: "desc" }, take: result.count });
    return res.status(201).json({ success: true, data: createdJobs.map(formatJob) });
  } catch (error) {
    console.error("Error bulk creating jobs:", error);
    return res.status(500).json({ success: false, error: "Failed to bulk create jobs" });
  }
}
