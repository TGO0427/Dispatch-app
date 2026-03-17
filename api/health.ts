import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCorsHeaders } from "./_lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  return res.json({ status: "ok", timestamp: new Date().toISOString(), runtime: "serverless" });
}
