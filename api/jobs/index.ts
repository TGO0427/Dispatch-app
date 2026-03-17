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

  if (req.method === "GET") {
    try {
      const jobs = await prisma.job.findMany({ orderBy: { createdAt: "desc" } });
      return res.json({ success: true, data: jobs.map(formatJob) });
    } catch (error) {
      console.error("Error fetching jobs:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch jobs" });
    }
  }

  if (req.method === "POST") {
    try {
      const newJob = await prisma.job.create({
        data: {
          ref: req.body.ref,
          customer: req.body.customer,
          pickup: req.body.pickup,
          dropoff: req.body.dropoff,
          warehouse: req.body.warehouse,
          priority: req.body.priority || "normal",
          status: req.body.status || "pending",
          jobType: req.body.jobType || "order",
          pallets: req.body.pallets,
          outstandingQty: req.body.outstandingQty,
          eta: req.body.eta,
          scheduledAt: req.body.scheduledAt,
          actualDeliveryAt: req.body.actualDeliveryAt,
          exceptionReason: req.body.exceptionReason,
          driverId: req.body.driverId,
          notes: req.body.notes,
          transporterBooked: req.body.transporterBooked,
          orderPicked: req.body.orderPicked,
          coaAvailable: req.body.coaAvailable,
        },
      });
      return res.status(201).json({ success: true, data: formatJob(newJob) });
    } catch (error) {
      console.error("Error creating job:", error);
      return res.status(500).json({ success: false, error: "Failed to create job" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
