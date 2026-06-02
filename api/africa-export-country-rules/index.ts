import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma, requireAuth, setCors, validateOrigin, MAX_BATCH_SIZE } from "../_lib.js";

const MAX_STRING = 1000;

const formatRule = (rule: Record<string, unknown>) => ({
  ...rule,
  createdAt: rule.createdAt instanceof Date ? rule.createdAt.toISOString() : rule.createdAt,
  updatedAt: rule.updatedAt instanceof Date ? rule.updatedAt.toISOString() : rule.updatedAt,
});

const toRuleData = (body: Record<string, unknown>) => {
  if (!body.country) throw new Error("Country is required");
  const country = String(body.country).trim();
  const title = String(body.title || `${country} Export Requirements`).trim();
  if (country.length > MAX_STRING || title.length > MAX_STRING) throw new Error("Country rule text is too long");

  return {
    country,
    title,
    points: Array.isArray(body.points) ? body.points.map(String).filter(Boolean) : [],
    requiredDocumentIds: Array.isArray(body.requiredDocumentIds) ? body.requiredDocumentIds.map(String).filter(Boolean) : [],
    history: Array.isArray(body.history) ? body.history : [],
    updatedBy: body.updatedBy ? String(body.updatedBy) : null,
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!validateOrigin(req)) return res.status(403).json({ success: false, error: "Forbidden" });

  const user = requireAuth(req.headers.authorization);
  if (!user) return res.status(401).json({ success: false, error: "Unauthorized" });

  const country = req.query.country as string | undefined;
  const action = req.query.action as string | undefined;

  if (req.method === "GET") {
    try {
      const rules = country
        ? await prisma.africaExportCountryRule.findMany({ where: { country }, orderBy: { country: "asc" } })
        : await prisma.africaExportCountryRule.findMany({ orderBy: { country: "asc" } });
      return res.json({ success: true, data: rules.map(formatRule) });
    } catch (error) {
      console.error("Error fetching Africa export country rules:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch Africa export country rules" });
    }
  }

  if (req.method === "POST") {
    if (user.role === "viewer") return res.status(403).json({ success: false, error: "Viewers cannot modify data" });

    if (action === "bulk-upsert") {
      try {
        const rules = req.body?.rules;
        if (!Array.isArray(rules)) return res.status(400).json({ success: false, error: "Request body must include a rules array" });
        if (rules.length > MAX_BATCH_SIZE) return res.status(400).json({ success: false, error: `Batch size cannot exceed ${MAX_BATCH_SIZE}` });

        const result = await prisma.$transaction(
          rules.map((rule: Record<string, unknown>) => {
            const data = toRuleData(rule);
            return prisma.africaExportCountryRule.upsert({
              where: { country: data.country },
              create: data,
              update: data,
            });
          }),
        );
        return res.status(201).json({ success: true, data: result.map(formatRule) });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to save Africa export country rules";
        if (message.includes("required") || message.includes("too long")) return res.status(400).json({ success: false, error: message });
        console.error("Error bulk upserting Africa export country rules:", error);
        return res.status(500).json({ success: false, error: "Failed to save Africa export country rules" });
      }
    }

    try {
      const data = toRuleData(req.body);
      const saved = await prisma.africaExportCountryRule.upsert({
        where: { country: data.country },
        create: data,
        update: data,
      });
      return res.status(201).json({ success: true, data: formatRule(saved) });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save Africa export country rule";
      if (message.includes("required") || message.includes("too long")) return res.status(400).json({ success: false, error: message });
      console.error("Error saving Africa export country rule:", error);
      return res.status(500).json({ success: false, error: "Failed to save Africa export country rule" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
