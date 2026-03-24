import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function setCors(res: VercelResponse, req: VercelRequest) {
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || req.headers?.origin || "");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

interface JwtPayload { id: string; username: string; email: string; role: string }

function requireAuth(authHeader: string | undefined, res: VercelResponse): JwtPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) { res.status(500).json({ success: false, error: "Server configuration error" }); return null; }
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try { return jwt.verify(authHeader.slice(7), secret) as JwtPayload; } catch { return null; }
}

function requireAdmin(authHeader: string | undefined, res: VercelResponse): JwtPayload | null {
  const user = requireAuth(authHeader, res);
  if (!user || user.role !== "admin") return null;
  return user;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();

  const caller = requireAdmin(req.headers.authorization, res);
  if (!caller) return res.headersSent ? undefined : res.status(403).json({ success: false, message: "Admin access required" });

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
      const validRoles = ["viewer", "user", "dispatcher", "manager", "admin"];
      if (!validRoles.includes(role)) return res.status(400).json({ success: false, message: "Invalid role" });

      const updateData: Record<string, unknown> = { username, email, role };
      if (password) {
        if (password.length < 12) return res.status(400).json({ success: false, message: "Password must be at least 12 characters" });
        updateData.password = await bcrypt.hash(password, 12);
      }

      const updatedUser = await prisma.user.update({
        where: { id }, data: updateData,
        select: { id: true, username: true, email: true, role: true },
      });
      return res.json({ success: true, user: updatedUser, message: "User updated successfully" });
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError.code === "P2025") return res.status(404).json({ success: false, message: "User not found" });
      if (prismaError.code === "P2002") return res.status(400).json({ success: false, message: "Username or email already exists" });
      console.error("Error updating user:", error);
      return res.status(500).json({ success: false, message: "Failed to update user" });
    }
  }

  if (req.method === "DELETE") {
    try {
      if (id === caller.id) return res.status(400).json({ success: false, message: "Cannot delete your own account" });
      await prisma.user.delete({ where: { id } });
      return res.json({ success: true, message: "User deleted successfully" });
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError.code === "P2025") return res.status(404).json({ success: false, message: "User not found" });
      console.error("Error deleting user:", error);
      return res.status(500).json({ success: false, message: "Failed to delete user" });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
