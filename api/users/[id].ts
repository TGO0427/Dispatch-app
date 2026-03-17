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

  const { id } = req.query;
  if (!id || typeof id !== "string") return res.status(400).json({ success: false, message: "User ID required" });

  if (req.method === "GET") {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, username: true, email: true, role: true },
      });
      if (!user) return res.status(404).json({ success: false, message: "User not found" });
      return res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch user" });
    }
  }

  if (req.method === "PUT") {
    try {
      const { username, email, password, role } = req.body;
      if (!username || !email || !role) return res.status(400).json({ success: false, message: "Username, email, and role are required" });
      const validRoles = ["user", "dispatcher", "manager", "admin"];
      if (!validRoles.includes(role)) return res.status(400).json({ success: false, message: "Invalid role" });
      const updateData: any = { username, email, role };
      if (password) updateData.password = password;
      const updatedUser = await prisma.user.update({
        where: { id }, data: updateData,
        select: { id: true, username: true, email: true, role: true },
      });
      return res.json({ success: true, user: updatedUser, message: "User updated successfully" });
    } catch (error: any) {
      if (error.code === "P2025") return res.status(404).json({ success: false, message: "User not found" });
      if (error.code === "P2002") return res.status(400).json({ success: false, message: "Username or email already exists" });
      console.error("Error updating user:", error);
      return res.status(500).json({ success: false, message: "Failed to update user" });
    }
  }

  if (req.method === "DELETE") {
    try {
      if (id === caller.id) return res.status(400).json({ success: false, message: "Cannot delete your own account" });
      await prisma.user.delete({ where: { id } });
      return res.json({ success: true, message: "User deleted successfully" });
    } catch (error: any) {
      if (error.code === "P2025") return res.status(404).json({ success: false, message: "User not found" });
      console.error("Error deleting user:", error);
      return res.status(500).json({ success: false, message: "Failed to delete user" });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
