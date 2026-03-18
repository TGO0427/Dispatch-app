import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) console.warn("WARNING: JWT_SECRET not set - using insecure fallback");
const SECRET = JWT_SECRET || "dev-only-fallback-key";

// Demo admin only - for initial setup (remove after creating real admin user)
const DEMO_ADMIN = {
  id: "1", username: "admin", password: "admin123",
  email: "admin@dispatch.com", role: "admin",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password are required" });
    }

    let user: any = null;

    // Try database first (passwords should be hashed with bcrypt)
    try {
      const dbUser = await prisma.user.findUnique({ where: { username } });
      if (dbUser) {
        // Support both hashed and plain passwords (migration period)
        const isMatch = dbUser.password.startsWith("$2")
          ? await bcrypt.compare(password, dbUser.password)
          : dbUser.password === password;
        if (isMatch) user = dbUser;
      }
    } catch {
      // DB not ready, fall through to demo
    }

    // Fallback to demo admin only
    if (!user && username === DEMO_ADMIN.username && password === DEMO_ADMIN.password) {
      user = DEMO_ADMIN;
    }

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid username or password" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      SECRET,
      { expiresIn: "24h" }
    );
    const { password: _, ...userWithoutPassword } = user;
    return res.json({ success: true, token, user: userWithoutPassword });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Login failed" });
  }
}
