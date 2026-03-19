import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma, setCors, requireAuth } from "../_middleware";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const user = requireAuth(req.headers.authorization);
  if (!user) return res.status(401).json({ success: false, error: "Unauthorized" });

  if (req.method === "GET") {
    try {
      const drivers = await prisma.driver.findMany({ orderBy: { name: "asc" } });
      return res.json({ success: true, data: drivers });
    } catch (error) {
      console.error("Error fetching drivers:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch drivers" });
    }
  }

  if (req.method === "POST") {
    try {
      if (!req.body.name || !req.body.callsign || !req.body.location) {
        return res.status(400).json({ success: false, error: "Name, callsign, and location are required" });
      }
      if (req.body.capacity !== undefined && (req.body.capacity < 0 || req.body.capacity > 999999)) {
        return res.status(400).json({ success: false, error: "Capacity must be between 0 and 999999" });
      }
      const newDriver = await prisma.driver.create({
        data: {
          name: req.body.name, callsign: req.body.callsign, location: req.body.location,
          capacity: req.body.capacity, assignedJobs: req.body.assignedJobs || 0,
          status: req.body.status || "offline", phone: req.body.phone, email: req.body.email,
        },
      });
      return res.status(201).json({ success: true, data: newDriver });
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError.code === "P2002") return res.status(409).json({ success: false, error: "Callsign already exists" });
      console.error("Error creating driver:", error);
      return res.status(500).json({ success: false, error: "Failed to create driver" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
