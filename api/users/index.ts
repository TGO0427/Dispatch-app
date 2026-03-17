import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

function getUser(req: VercelRequest): any {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try { return jwt.verify(auth.substring(7), JWT_SECRET); } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const caller = getUser(req);
  if (!caller) return res.status(401).json({ success: false, message: "Unauthorized" });
  if (caller.role !== "admin") return res.status(403).json({ success: false, message: "Admin access required" });

  if (req.method === "GET") {
    try {
      const users = await prisma.user.findMany({
        select: { id: true, username: true, email: true, role: true, createdAt: true },
      });
      return res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch users" });
    }
  }

  if (req.method === "POST") {
    try {
      const { username, email, password, role } = req.body;
      if (!username || !email || !password || !role) {
        return res.status(400).json({ success: false, message: "All fields are required" });
      }
      const validRoles = ["user", "dispatcher", "manager", "admin"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: "Invalid role" });
      }
      const newUser = await prisma.user.create({
        data: { username, email, password, role },
        select: { id: true, username: true, email: true, role: true },
      });
      return res.status(201).json({ success: true, user: newUser, message: "User created successfully" });
    } catch (error: any) {
      if (error.code === "P2002") return res.status(400).json({ success: false, message: "Username or email already exists" });
      console.error("Error creating user:", error);
      return res.status(500).json({ success: false, message: "Failed to create user" });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
