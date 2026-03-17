import type { VercelRequest, VercelResponse } from "@vercel/node";
import prisma from "../_lib/db";
import { setCorsHeaders } from "../_lib/auth";

const formatJob = (job: any) => ({
  ...job,
  createdAt: job.createdAt instanceof Date ? job.createdAt.toISOString() : job.createdAt,
  updatedAt: job.updatedAt instanceof Date ? job.updatedAt.toISOString() : job.updatedAt,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const jobType = req.body.jobType || "order";

    const jobsData = req.body.jobs.map((job: any) => ({
      ref: job.ref,
      customer: job.customer,
      pickup: job.pickup,
      dropoff: job.dropoff,
      warehouse: job.warehouse,
      priority: job.priority || "normal",
      status: job.status || "pending",
      jobType: jobType,
      pallets: job.pallets,
      outstandingQty: job.outstandingQty,
      eta: job.eta,
      scheduledAt: job.scheduledAt,
      actualDeliveryAt: job.actualDeliveryAt,
      exceptionReason: job.exceptionReason,
      driverId: job.driverId,
      notes: job.notes,
      transporterBooked: job.transporterBooked,
      orderPicked: job.orderPicked,
      coaAvailable: job.coaAvailable,
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
