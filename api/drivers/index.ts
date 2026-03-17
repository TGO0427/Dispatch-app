import type { VercelRequest, VercelResponse } from "@vercel/node";
import prisma from "../_lib/db";
import { setCorsHeaders } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();

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
      const newDriver = await prisma.driver.create({
        data: {
          name: req.body.name,
          callsign: req.body.callsign,
          location: req.body.location,
          capacity: req.body.capacity,
          assignedJobs: req.body.assignedJobs || 0,
          status: req.body.status || "offline",
          phone: req.body.phone,
          email: req.body.email,
        },
      });
      return res.status(201).json({ success: true, data: newDriver });
    } catch (error: any) {
      if (error.code === "P2002") {
        return res.status(409).json({ success: false, error: "Driver with this callsign already exists" });
      }
      console.error("Error creating driver:", error);
      return res.status(500).json({ success: false, error: "Failed to create driver" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
