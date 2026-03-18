import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

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

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// POST /api/auth?action=login
async function handleLogin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password are required" });
  }

  let user: any = null;

  try {
    const dbUser = await prisma.user.findUnique({ where: { username } });
    if (dbUser) {
      const isMatch = dbUser.password.startsWith("$2")
        ? await bcrypt.compare(password, dbUser.password)
        : dbUser.password === password;
      if (isMatch) user = dbUser;
    }
  } catch {
    // DB not ready, fall through to demo
  }

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
}

// GET/POST /api/auth?action=verify
async function handleVerify(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }
  const token = authHeader.substring(7);
  const decoded = jwt.verify(token, SECRET) as any;
  return res.json({
    success: true,
    user: { id: decoded.id, username: decoded.username, email: decoded.email, role: decoded.role },
  });
}

// POST /api/auth?action=logout
async function handleLogout(_req: VercelRequest, res: VercelResponse) {
  return res.json({ success: true, message: "Logged out successfully" });
}

// POST /api/auth?action=forgot-password
async function handleForgotPassword(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  const successResponse = {
    success: true,
    message: "If an account with that email exists, a password reset link has been sent.",
  };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.json(successResponse);
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: resetToken, passwordResetExpires: resetExpires },
  });

  const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || "http://localhost:5173";
  const resetUrl = `${frontendUrl}?reset-token=${resetToken}`;
  console.log(`[Password Reset] User: ${user.email}, Reset URL: ${resetUrl}`);

  return res.json(successResponse);
}

// POST /api/auth?action=reset-password
async function handleResetPassword(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ success: false, message: "Token and new password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
  }

  const user = await prisma.user.findFirst({
    where: { passwordResetToken: token, passwordResetExpires: { gt: new Date() } },
  });

  if (!user) {
    return res.status(400).json({ success: false, message: "Invalid or expired reset link. Please request a new one." });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword, passwordResetToken: null, passwordResetExpires: null },
  });

  return res.json({ success: true, message: "Password has been reset successfully." });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const action = req.query.action as string;

  try {
    switch (action) {
      case "login": return await handleLogin(req, res);
      case "verify": return await handleVerify(req, res);
      case "logout": return await handleLogout(req, res);
      case "forgot-password": return await handleForgotPassword(req, res);
      case "reset-password": return await handleResetPassword(req, res);
      default:
        return res.status(400).json({ success: false, message: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error(`Auth error (${action}):`, error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
