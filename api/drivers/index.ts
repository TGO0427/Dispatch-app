import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
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
    } catch (error: any) {
      if (error.code === "P2002") return res.status(409).json({ success: false, error: "Callsign already exists" });
      console.error("Error creating driver:", error);
      return res.status(500).json({ success: false, error: "Failed to create driver" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
