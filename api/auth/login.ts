import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

const DEMO_USERS = [
  { id: "1", username: "admin", password: "admin123", email: "admin@dispatch.com", role: "admin" },
  { id: "2", username: "dispatcher", password: "dispatcher123", email: "dispatcher@dispatch.com", role: "dispatcher" },
  { id: "3", username: "manager", password: "manager123", email: "manager@dispatch.com", role: "manager" },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
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
    try {
      const dbUser = await prisma.user.findUnique({ where: { username } });
      if (dbUser && dbUser.password === password) user = dbUser;
    } catch { /* DB not ready, fall through */ }

    if (!user) {
      const demoUser = DEMO_USERS.find((u) => u.username === username && u.password === password);
      if (demoUser) user = demoUser;
    }

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid username or password" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );
    const { password: _, ...userWithoutPassword } = user;
    return res.json({ success: true, token, user: userWithoutPassword });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Login failed" });
  }
}
