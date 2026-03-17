import type { VercelRequest, VercelResponse } from "@vercel/node";
import { signToken, setCorsHeaders } from "../_lib/auth";
import prisma from "../_lib/db";

// Fallback demo users (used if no users exist in DB yet)
const DEMO_USERS = [
  { id: "1", username: "admin", password: "admin123", email: "admin@dispatch.com", role: "admin" },
  { id: "2", username: "dispatcher", password: "dispatcher123", email: "dispatcher@dispatch.com", role: "dispatcher" },
  { id: "3", username: "manager", password: "manager123", email: "manager@dispatch.com", role: "manager" },
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: "Username and password are required" });
    }

    // Try database first
    let user: any = null;
    try {
      const dbUser = await prisma.user.findUnique({ where: { username } });
      if (dbUser && dbUser.password === password) {
        user = dbUser;
      }
    } catch {
      // DB not available or User table doesn't exist yet, fall through to demo users
    }

    // Fallback to demo users
    if (!user) {
      const demoUser = DEMO_USERS.find((u) => u.username === username && u.password === password);
      if (demoUser) user = demoUser;
    }

    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid username or password" });
    }

    const token = signToken({ id: user.id, username: user.username, email: user.email, role: user.role });
    const { password: _, ...userWithoutPassword } = user;

    return res.json({ success: true, token, user: userWithoutPassword });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Login failed" });
  }
}
