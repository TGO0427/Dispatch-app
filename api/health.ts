import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.json({ status: "ok", timestamp: new Date().toISOString(), runtime: "serverless" });
}
