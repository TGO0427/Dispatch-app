import type { VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

// ---------------------------------------------------------------------------
// Shared Prisma instance (singleton)
// ---------------------------------------------------------------------------
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// ---------------------------------------------------------------------------
// JWT payload type
// ---------------------------------------------------------------------------
export interface JwtPayload {
  id: string;
  username: string;
  email: string;
  role: string;
}

// ---------------------------------------------------------------------------
// CORS helper
// ---------------------------------------------------------------------------
export function setCors(res: VercelResponse, req?: { headers: { origin?: string } }): void {
  const origin = process.env.FRONTEND_URL || req?.headers?.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Extract and verify the Bearer token from the Authorization header.
 * Returns the decoded payload or `null` when the token is missing / invalid.
 *
 * Throws if the JWT_SECRET environment variable is not configured.
 */
export function requireAuth(authHeader: string | undefined): JwtPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Same as `requireAuth` but additionally checks that the user has the
 * "admin" role.  Returns the payload when the caller is an admin, or
 * `null` otherwise.
 */
export function requireAdmin(
  authHeader: string | undefined,
): JwtPayload | null {
  const user = requireAuth(authHeader);
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}

// ---------------------------------------------------------------------------
// In-memory rate limiter
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  count: number;
  expiresAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Simple in-memory rate limiter suitable for serverless cold-start windows.
 *
 * @param key          Unique identifier (e.g. IP address or user id).
 * @param maxRequests  Maximum number of requests allowed in the window.
 * @param windowMs     Window duration in milliseconds.
 * @returns `true` if the request is allowed, `false` if rate-limited.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const MAX_BATCH_SIZE = 500;
