import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { validateOrigin } from "../_lib";

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
  if (!validateOrigin(req)) return res.status(403).json({ success: false, message: "Forbidden" });

  // GET — any authenticated user can list users (for recipient picker, etc.)
  if (req.method === "GET") {
    const user = requireAuth(req.headers.authorization, res);
    if (!user) return res.headersSent ? undefined : res.status(401).json({ success: false, message: "Unauthorized" });
    try {
      const users = await prisma.user.findMany({
        select: { id: true, username: true, email: true, role: true, createdAt: true },
      });
      return res.json({ success: true, data: users });
    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch users" });
    }
  }

  // All other methods (POST, PUT, DELETE) require admin
  const caller = requireAdmin(req.headers.authorization, res);
  if (!caller) return res.headersSent ? undefined : res.status(403).json({ success: false, message: "Admin access required" });

  if (req.method === "POST") {
    try {
      const { username, email, password, role } = req.body;
      if (!username || !email || !password || !role) {
        return res.status(400).json({ success: false, message: "All fields are required" });
      }
      const validRoles = ["viewer", "user", "dispatcher", "manager", "admin"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: "Invalid role" });
      }
      if (password.length < 12) {
        return res.status(400).json({ success: false, message: "Password must be at least 12 characters" });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const newUser = await prisma.user.create({
        data: { username, email, password: hashedPassword, role },
        select: { id: true, username: true, email: true, role: true },
      });
      return res.status(201).json({ success: true, user: newUser, message: "User created successfully" });
    } catch (error: unknown) {
      const prismaError = error as { code?: string };
      if (prismaError.code === "P2002") return res.status(400).json({ success: false, message: "Username or email already exists" });
      console.error("Error creating user:", error);
      return res.status(500).json({ success: false, message: "Failed to create user" });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
