import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma, requireAuth, setCors, validateOrigin, MAX_BATCH_SIZE } from "../_lib.js";

const VALID_STATUSES = ["available", "busy", "offline"];

const formatTransporter = (transporter: Record<string, unknown>) => ({
  ...transporter,
  createdAt: transporter.createdAt instanceof Date ? transporter.createdAt.toISOString() : transporter.createdAt,
  updatedAt: transporter.updatedAt instanceof Date ? transporter.updatedAt.toISOString() : transporter.updatedAt,
});

const toTransporterData = (body: Record<string, unknown>) => {
  const status = String(body.status || "available");
  if (!VALID_STATUSES.includes(status)) throw new Error("Invalid status");
  if (!body.name) throw new Error("Transporter name is required");

  return {
    ...(body.id ? { id: String(body.id) } : {}),
    name: String(body.name).trim(),
    route: body.route ? String(body.route) : null,
    contact: body.contact ? String(body.contact) : null,
    capacity: Number.isFinite(Number(body.capacity)) ? Math.max(0, Math.round(Number(body.capacity))) : 0,
    status,
  };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!validateOrigin(req)) return res.status(403).json({ success: false, error: "Forbidden" });

  const user = requireAuth(req.headers.authorization);
  if (!user) return res.status(401).json({ success: false, error: "Unauthorized" });

  const id = req.query.id as string | undefined;
  const action = req.query.action as string | undefined;

  if (id) {
    if (req.method === "GET") {
      try {
        const transporter = await prisma.africaExportTransporter.findUnique({ where: { id } });
        if (!transporter) return res.status(404).json({ success: false, error: "Africa export transporter not found" });
        return res.json({ success: true, data: formatTransporter(transporter) });
      } catch (error) {
        console.error("Error fetching Africa export transporter:", error);
        return res.status(500).json({ success: false, error: "Failed to fetch Africa export transporter" });
      }
    }

    if (req.method === "PUT") {
      if (user.role === "viewer") return res.status(403).json({ success: false, error: "Viewers cannot modify data" });
      try {
        const data = toTransporterData(req.body);
        delete (data as { id?: string }).id;
        const updated = await prisma.africaExportTransporter.update({ where: { id }, data });
        return res.json({ success: true, data: formatTransporter(updated) });
      } catch (error: unknown) {
        const prismaError = error as { code?: string; message?: string };
        if (prismaError.code === "P2025") return res.status(404).json({ success: false, error: "Africa export transporter not found" });
        const message = prismaError.message || "Failed to update Africa export transporter";
        if (message.includes("Invalid") || message.includes("required")) return res.status(400).json({ success: false, error: message });
        console.error("Error updating Africa export transporter:", error);
        return res.status(500).json({ success: false, error: "Failed to update Africa export transporter" });
      }
    }

    if (req.method === "DELETE") {
      if (!["admin", "dispatcher", "manager"].includes(user.role)) {
        return res.status(403).json({ success: false, error: "Insufficient permissions to delete Africa export transporters" });
      }
      try {
        const deleted = await prisma.africaExportTransporter.delete({ where: { id } });
        return res.json({ success: true, data: formatTransporter(deleted) });
      } catch (error: unknown) {
        const prismaError = error as { code?: string };
        if (prismaError.code === "P2025") return res.status(404).json({ success: false, error: "Africa export transporter not found" });
        console.error("Error deleting Africa export transporter:", error);
        return res.status(500).json({ success: false, error: "Failed to delete Africa export transporter" });
      }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  if (req.method === "GET") {
    try {
      const transporters = await prisma.africaExportTransporter.findMany({ orderBy: { name: "asc" } });
      return res.json({ success: true, data: transporters.map(formatTransporter) });
    } catch (error) {
      console.error("Error fetching Africa export transporters:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch Africa export transporters" });
    }
  }

  if (req.method === "POST") {
    if (user.role === "viewer") return res.status(403).json({ success: false, error: "Viewers cannot modify data" });

    if (action === "bulk-upsert") {
      try {
        const transporters = req.body?.transporters;
        if (!Array.isArray(transporters)) return res.status(400).json({ success: false, error: "Request body must include a transporters array" });
        if (transporters.length > MAX_BATCH_SIZE) return res.status(400).json({ success: false, error: `Batch size cannot exceed ${MAX_BATCH_SIZE}` });

        const result = await prisma.$transaction(
          transporters.map((transporter: Record<string, unknown>) => {
            const data = toTransporterData(transporter);
            const id = data.id || `export-transporter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            return prisma.africaExportTransporter.upsert({
              where: { id },
              create: { ...data, id },
              update: data,
            });
          }),
        );
        return res.status(201).json({ success: true, data: result.map(formatTransporter) });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to import Africa export transporters";
        if (message.includes("Invalid") || message.includes("required")) return res.status(400).json({ success: false, error: message });
        console.error("Error bulk upserting Africa export transporters:", error);
        return res.status(500).json({ success: false, error: "Failed to import Africa export transporters" });
      }
    }

    try {
      const data = toTransporterData(req.body);
      const created = await prisma.africaExportTransporter.create({ data });
      return res.status(201).json({ success: true, data: formatTransporter(created) });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create Africa export transporter";
      if (message.includes("Invalid") || message.includes("required")) return res.status(400).json({ success: false, error: message });
      console.error("Error creating Africa export transporter:", error);
      return res.status(500).json({ success: false, error: "Failed to create Africa export transporter" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
