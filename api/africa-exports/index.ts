import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma, requireAuth, setCors, validateOrigin, MAX_BATCH_SIZE } from "../_lib.js";

const VALID_STATUSES = ["pending", "assigned", "in-transit", "delivered"];
const MAX_STRING = 1000;
const MAX_TEXT = 5000;

const formatShipment = (shipment: Record<string, unknown>) => ({
  ...shipment,
  createdAt: shipment.createdAt instanceof Date ? shipment.createdAt.toISOString() : shipment.createdAt,
  updatedAt: shipment.updatedAt instanceof Date ? shipment.updatedAt.toISOString() : shipment.updatedAt,
});

const toShipmentData = (body: Record<string, unknown>, createdById?: string) => {
  const status = String(body.status || "pending");
  if (!VALID_STATUSES.includes(status)) {
    throw new Error("Invalid status");
  }
  if (!body.ref || !body.customer) {
    throw new Error("Reference and customer are required");
  }
  if (String(body.ref).length > MAX_STRING || String(body.customer).length > MAX_STRING) {
    throw new Error("Reference or customer is too long");
  }
  if (body.notes && String(body.notes).length > MAX_TEXT) {
    throw new Error("Notes too long");
  }

  return {
    ref: String(body.ref).trim(),
    customer: String(body.customer).trim(),
    destinationCountry: body.destinationCountry ? String(body.destinationCountry) : null,
    hsCode: body.hsCode ? String(body.hsCode) : null,
    productType: body.productType ? String(body.productType) : null,
    incoterm: body.incoterm ? String(body.incoterm) : "FCA",
    transportMode: body.transportMode ? String(body.transportMode) : "Road",
    preferenceScheme: body.preferenceScheme ? String(body.preferenceScheme) : "To confirm",
    destinationAgent: body.destinationAgent ? String(body.destinationAgent) : null,
    eta: body.eta ? String(body.eta) : null,
    quantity: Number.isFinite(Number(body.quantity)) ? Math.max(0, Number(body.quantity)) : 0,
    pallets: Number.isFinite(Number(body.pallets)) ? Math.max(0, Math.round(Number(body.pallets))) : 0,
    status,
    assignedTransporterId: body.assignedTransporterId ? String(body.assignedTransporterId) : null,
    lastCheckedAt: body.lastCheckedAt ? String(body.lastCheckedAt) : null,
    notes: body.notes ? String(body.notes) : null,
    documents: body.documents && typeof body.documents === "object" && !Array.isArray(body.documents) ? body.documents : {},
    documentDetails: body.documentDetails && typeof body.documentDetails === "object" && !Array.isArray(body.documentDetails) ? body.documentDetails : {},
    history: Array.isArray(body.history) ? body.history : [],
    archived: Boolean(body.archived),
    dispatchApprovedAt: body.dispatchApprovedAt ? String(body.dispatchApprovedAt) : null,
    dispatchApprovedBy: body.dispatchApprovedBy ? String(body.dispatchApprovedBy) : null,
    ...(createdById ? { createdById } : {}),
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
        const shipment = await prisma.africaExportShipment.findUnique({ where: { id } });
        if (!shipment) return res.status(404).json({ success: false, error: "Africa export shipment not found" });
        return res.json({ success: true, data: formatShipment(shipment) });
      } catch (error) {
        console.error("Error fetching Africa export shipment:", error);
        return res.status(500).json({ success: false, error: "Failed to fetch Africa export shipment" });
      }
    }

    if (req.method === "PUT") {
      if (user.role === "viewer") return res.status(403).json({ success: false, error: "Viewers cannot modify data" });
      try {
        const data = toShipmentData(req.body);
        const updated = await prisma.africaExportShipment.update({ where: { id }, data });
        return res.json({ success: true, data: formatShipment(updated) });
      } catch (error: unknown) {
        const prismaError = error as { code?: string; message?: string };
        if (prismaError.code === "P2025") return res.status(404).json({ success: false, error: "Africa export shipment not found" });
        if (prismaError.code === "P2002") return res.status(409).json({ success: false, error: "Africa export reference already exists" });
        const message = prismaError.message || "Failed to update Africa export shipment";
        if (message.includes("Invalid") || message.includes("required") || message.includes("too long")) {
          return res.status(400).json({ success: false, error: message });
        }
        console.error("Error updating Africa export shipment:", error);
        return res.status(500).json({ success: false, error: "Failed to update Africa export shipment" });
      }
    }

    if (req.method === "DELETE") {
      if (!["admin", "dispatcher", "manager"].includes(user.role)) {
        return res.status(403).json({ success: false, error: "Insufficient permissions to delete Africa exports" });
      }
      try {
        const deleted = await prisma.africaExportShipment.delete({ where: { id } });
        return res.json({ success: true, data: formatShipment(deleted) });
      } catch (error: unknown) {
        const prismaError = error as { code?: string };
        if (prismaError.code === "P2025") return res.status(404).json({ success: false, error: "Africa export shipment not found" });
        console.error("Error deleting Africa export shipment:", error);
        return res.status(500).json({ success: false, error: "Failed to delete Africa export shipment" });
      }
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  if (req.method === "GET") {
    try {
      const shipments = await prisma.africaExportShipment.findMany({ orderBy: [{ eta: "asc" }, { createdAt: "desc" }] });
      return res.json({ success: true, data: shipments.map(formatShipment) });
    } catch (error) {
      console.error("Error fetching Africa export shipments:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch Africa export shipments" });
    }
  }

  if (req.method === "POST") {
    if (user.role === "viewer") return res.status(403).json({ success: false, error: "Viewers cannot modify data" });

    if (action === "bulk-upsert") {
      try {
        const shipments = req.body?.shipments;
        if (!Array.isArray(shipments)) return res.status(400).json({ success: false, error: "Request body must include a shipments array" });
        if (shipments.length > MAX_BATCH_SIZE) return res.status(400).json({ success: false, error: `Batch size cannot exceed ${MAX_BATCH_SIZE}` });

        const result = await prisma.$transaction(
          shipments.map((shipment: Record<string, unknown>) => {
            const data = toShipmentData(shipment, user.id);
            return prisma.africaExportShipment.upsert({
              where: { ref: data.ref },
              create: data,
              update: data,
            });
          }),
        );
        return res.status(201).json({ success: true, data: result.map(formatShipment) });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to import Africa export shipments";
        if (message.includes("Invalid") || message.includes("required") || message.includes("too long")) {
          return res.status(400).json({ success: false, error: message });
        }
        console.error("Error bulk upserting Africa export shipments:", error);
        return res.status(500).json({ success: false, error: "Failed to import Africa export shipments" });
      }
    }

    try {
      const data = toShipmentData(req.body, user.id);
      const created = await prisma.africaExportShipment.create({ data });
      return res.status(201).json({ success: true, data: formatShipment(created) });
    } catch (error: unknown) {
      const prismaError = error as { code?: string; message?: string };
      if (prismaError.code === "P2002") return res.status(409).json({ success: false, error: "Africa export reference already exists" });
      const message = prismaError.message || "Failed to create Africa export shipment";
      if (message.includes("Invalid") || message.includes("required") || message.includes("too long")) {
        return res.status(400).json({ success: false, error: message });
      }
      console.error("Error creating Africa export shipment:", error);
      return res.status(500).json({ success: false, error: "Failed to create Africa export shipment" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
