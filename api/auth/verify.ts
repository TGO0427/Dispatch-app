import type { VercelRequest, VercelResponse } from "@vercel/node";
import { authenticateRequest, setCorsHeaders } from "../_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ success: false, message: "Method not allowed" });

  const user = authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }

  return res.json({ success: true, user });
}
