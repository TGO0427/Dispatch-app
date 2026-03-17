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
      const updatedJob = await prisma.job.update({
        where: { id },
        data: {
          ref: req.body.ref,
          customer: req.body.customer,
          pickup: req.body.pickup,
          dropoff: req.body.dropoff,
          warehouse: req.body.warehouse,
          priority: req.body.priority,
          status: req.body.status,
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
