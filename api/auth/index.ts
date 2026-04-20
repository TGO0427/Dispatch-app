import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

function setCors(res: VercelResponse, req: VercelRequest) {
  const allowedOrigin = process.env.FRONTEND_URL || "";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

interface RateLimitEntry {
  count: number;
  expiresAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();

  // Clean up expired entries
  for (const [k, entry] of rateLimitStore) {
    if (entry.expiresAt <= now) {
      rateLimitStore.delete(k);
    }
  }

  const existing = rateLimitStore.get(key);

  if (!existing || existing.expiresAt <= now) {
    rateLimitStore.set(key, { count: 1, expiresAt: now + windowMs });
    return true;
  }

  if (existing.count < maxRequests) {
    existing.count += 1;
    return true;
  }

  return false;
}

if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set. Server cannot start without it.");
}
const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/auth?action=login
async function handleLogin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  // Rate limit: 10 login attempts per minute per IP
  const ip = (req.headers["x-forwarded-for"] as string) || "unknown";
  if (!checkRateLimit(`login:${ip}`, 10, 60_000)) {
    return res.status(429).json({ success: false, message: "Too many login attempts. Please try again later." });
  }

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password are required" });
  }

  interface AuthUser { id: string; username: string; email: string; role: string; password: string; [key: string]: unknown }
  let user: AuthUser | null = null;

  try {
    const dbUser = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
    });

    if (dbUser) {
      const isMatch = dbUser.password.startsWith("$2")
        ? await bcrypt.compare(password, dbUser.password)
        : false;
      if (isMatch) user = dbUser;
    }
  } catch (dbError) {
    console.error("Database connection error during login:", dbError);
    return res.status(503).json({ success: false, message: "Service temporarily unavailable" });
  }

  if (!user) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "8h" }
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
  try {
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string; email: string; role: string };
    return res.json({
      success: true,
      user: { id: decoded.id, username: decoded.username, email: decoded.email, role: decoded.role },
    });
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
}

// POST /api/auth?action=logout
async function handleLogout(_req: VercelRequest, res: VercelResponse) {
  return res.json({ success: true, message: "Logged out successfully" });
}

// POST /api/auth?action=forgot-password
async function handleForgotPassword(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  // Rate limit: 5 forgot-password requests per 15 minutes per IP
  const ip = (req.headers["x-forwarded-for"] as string) || "unknown";
  if (!checkRateLimit(`forgot:${ip}`, 5, 15 * 60_000)) {
    return res.status(429).json({ success: false, message: "Too many requests. Please try again later." });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: "Invalid email format" });
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
  // Store hashed token in DB so a DB leak doesn't expose reset links
  const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: hashedToken, passwordResetExpires: resetExpires },
  });

  // TODO: Send email with reset link via email service
  // Reset token generated and stored — awaiting email integration

  return res.json(successResponse);
}

// POST /api/auth?action=reset-password
async function handleResetPassword(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ success: false, message: "Token and new password are required" });
  }
  if (password.length < 12) {
    return res.status(400).json({ success: false, message: "Password must be at least 12 characters" });
  }

  // Hash the incoming token to match what's stored in DB
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findFirst({
    where: { passwordResetToken: hashedToken, passwordResetExpires: { gt: new Date() } },
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

// POST /api/auth?action=change-password (authenticated)
async function handleChangePassword(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  // Verify JWT
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  let decoded: { id: string };
  try {
    decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as { id: string };
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: "Current and new password are required" });
  }
  if (newPassword.length < 12) {
    return res.status(400).json({ success: false, message: "New password must be at least 12 characters" });
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // Verify current password
  if (!user.password.startsWith("$2")) {
    return res.status(400).json({ success: false, message: "Please contact your administrator to reset your password" });
  }
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: "Current password is incorrect" });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  return res.json({ success: true, message: "Password changed successfully" });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();

  const action = req.query.action as string;

  try {
    switch (action) {
      case "login": return await handleLogin(req, res);
      case "verify": return await handleVerify(req, res);
      case "logout": return await handleLogout(req, res);
      case "forgot-password": return await handleForgotPassword(req, res);
      case "reset-password": return await handleResetPassword(req, res);
      case "change-password": return await handleChangePassword(req, res);
      default:
        return res.status(400).json({ success: false, message: "Unknown or invalid action" });
    }
  } catch (error) {
    console.error(`Auth error (${action}):`, error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
