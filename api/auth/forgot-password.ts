import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    // Always return success to prevent email enumeration
    const successResponse = {
      success: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json(successResponse);
    }

    // Generate a secure reset token and set 1-hour expiry
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: resetExpires,
      },
    });

    // Build the reset URL
    const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || "http://localhost:5173";
    const resetUrl = `${frontendUrl}?reset-token=${resetToken}`;

    // Log the reset link (replace with real email service in production)
    console.log(`[Password Reset] User: ${user.email}, Reset URL: ${resetUrl}`);

    // TODO: Send email via SendGrid/Resend/etc.
    // await sendEmail({
    //   to: user.email,
    //   subject: "Password Reset - Synercore Dispatch",
    //   html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`,
    // });

    return res.json(successResponse);
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
  }
}
