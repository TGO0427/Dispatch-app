import type { VercelRequest, VercelResponse } from "@vercel/node";
import prisma from "../_lib/db";
import { setCorsHeaders } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ success: false, error: "Driver ID required" });
  }

  if (req.method === "GET") {
    try {
      const driver = await prisma.driver.findUnique({ where: { id }, include: { jobs: true } });
      if (!driver) return res.status(404).json({ success: false, error: "Driver not found" });
      return res.json({ success: true, data: driver });
    } catch (error) {
      console.error("Error fetching driver:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch driver" });
    }
  }

  if (req.method === "PUT") {
    try {
      const updatedDriver = await prisma.driver.update({
        where: { id },
        data: {
          name: req.body.name,
          callsign: req.body.callsign,
          location: req.body.location,
          capacity: req.body.capacity,
          assignedJobs: req.body.assignedJobs,
          status: req.body.status,
          phone: req.body.phone,
          email: req.body.email,
        },
      });
      return res.json({ success: true, data: updatedDriver });
    } catch (error: any) {
      if (error.code === "P2025") return res.status(404).json({ success: false, error: "Driver not found" });
      if (error.code === "P2002") return res.status(409).json({ success: false, error: "Callsign already exists" });
      console.error("Error updating driver:", error);
      return res.status(500).json({ success: false, error: "Failed to update driver" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const deleted = await prisma.driver.delete({ where: { id } });
      return res.json({ success: true, data: deleted });
    } catch (error: any) {
      if (error.code === "P2025") return res.status(404).json({ success: false, error: "Driver not found" });
      console.error("Error deleting driver:", error);
      return res.status(500).json({ success: false, error: "Failed to delete driver" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
