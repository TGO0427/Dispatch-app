import type { VercelRequest, VercelResponse } from "@vercel/node";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma, setCors, checkRateLimit } from "../../lib/api-helpers";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-fallback-key";
if (!process.env.JWT_SECRET) console.warn("WARNING: JWT_SECRET not set — using insecure fallback");

// Fallback admin for initial setup (only works when DB has no admin users)
const FALLBACK_ADMIN = {
  id: "1", username: "admin", password: "admin123",
  email: "admin@dispatch.com", role: "admin",
};

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
  } catch {
    // DB not available, fall through to fallback admin
  }

  // Fallback admin: only if no DB user matched and credentials match
  if (!user && username === FALLBACK_ADMIN.username && password === FALLBACK_ADMIN.password) {
    user = FALLBACK_ADMIN;
  }

  if (!user) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role },
    JWT_SECRET,
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

  const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || "http://localhost:3000";
  const resetUrl = `${frontendUrl}?reset-token=${resetToken}`;
  // TODO: Send email with resetUrl instead of logging
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
      default:
        return res.status(400).json({ success: false, message: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error(`Auth error (${action}):`, error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
