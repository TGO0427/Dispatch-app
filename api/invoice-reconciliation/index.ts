import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma, requireAuth, setCors, validateOrigin, MAX_BATCH_SIZE } from "../_lib.js";

const MAX_TEXT = 5000;
const MAX_STRING = 1000;

const normalize = (value: unknown) => String(value ?? "").trim();

const getLineRowKey = (line: Record<string, unknown>) => {
  const invoiceNumber = normalize(line.invoiceNumber).toLowerCase();
  return [
    invoiceNumber || "no-invoice",
    normalize(line.aso).toLowerCase(),
    normalize(line.invoiceDate).toLowerCase(),
    normalize(line.deliveryDueDate).toLowerCase(),
    normalize(line.customer).toLowerCase(),
    normalize(line.invoiceQty).toLowerCase(),
    normalize(line.product).toLowerCase(),
    normalize(line.createdBy).toLowerCase(),
  ].join("|");
};

const formatLine = (line: Record<string, unknown>) => ({
  aso: line.aso || "",
  invoiceNumber: line.invoiceNumber || "",
  invoiceDate: line.invoiceDate || "",
  deliveryDueDate: line.deliveryDueDate || "",
  customer: line.customer || "",
  invoiceQty: line.invoiceQty || 0,
  hasInvoiceQty: Boolean(line.hasInvoiceQty),
  invoiceValue: line.invoiceValue || 0,
  product: line.product || "",
  createdBy: line.createdBy || "",
  deliveryStatus: line.deliveryStatus || "",
  status: line.status || "",
  postedDate: line.postedDate || "",
});

const toLineData = (line: Record<string, unknown>, createdById?: string) => {
  const aso = normalize(line.aso);
  if (!aso) throw new Error("ASO is required");
  const customer = normalize(line.customer);
  const product = normalize(line.product);
  if (customer.length > MAX_STRING) throw new Error("Customer name too long");
  if (product.length > MAX_TEXT) throw new Error("Product detail too long");

  return {
    rowKey: getLineRowKey(line),
    aso,
    invoiceNumber: normalize(line.invoiceNumber) || null,
    invoiceDate: normalize(line.invoiceDate) || null,
    deliveryDueDate: normalize(line.deliveryDueDate) || null,
    customer: customer || null,
    invoiceQty: Number.isFinite(Number(line.invoiceQty)) ? Number(line.invoiceQty) : 0,
    hasInvoiceQty: Boolean(line.hasInvoiceQty),
    invoiceValue: Number.isFinite(Number(line.invoiceValue)) ? Number(line.invoiceValue) : null,
    product: product || null,
    createdBy: normalize(line.createdBy) || null,
    deliveryStatus: normalize(line.deliveryStatus) || null,
    status: normalize(line.status) || null,
    postedDate: normalize(line.postedDate) || null,
    ...(createdById ? { createdById } : {}),
  };
};

const formatReviewMap = (reviews: { aso: string; status: string }[]) => (
  reviews.reduce<Record<string, string>>((acc, review) => {
    acc[review.aso] = review.status;
    return acc;
  }, {})
);

const formatNoteMap = (notes: { invoiceKey: string; note: string }[]) => (
  notes.reduce<Record<string, string>>((acc, note) => {
    acc[note.invoiceKey] = note.note;
    return acc;
  }, {})
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res, req);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (!validateOrigin(req)) return res.status(403).json({ success: false, error: "Forbidden" });

  const user = requireAuth(req.headers.authorization);
  if (!user) return res.status(401).json({ success: false, error: "Unauthorized" });

  const action = req.query.action as string | undefined;

  if (req.method === "GET") {
    try {
      const [lines, reviews, notes] = await Promise.all([
        prisma.invoiceReconciliationLine.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.invoiceReconciliationReview.findMany(),
        prisma.invoiceReconciliationTimingNote.findMany(),
      ]);
      return res.json({
        success: true,
        data: {
          lines: lines.map(formatLine),
          reviews: formatReviewMap(reviews),
          timingNotes: formatNoteMap(notes),
        },
      });
    } catch (error) {
      console.error("Error fetching invoice reconciliation data:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch invoice reconciliation data" });
    }
  }

  if (req.method === "POST") {
    if (user.role === "viewer") return res.status(403).json({ success: false, error: "Viewers cannot modify data" });

    if (action === "bulk-upsert-lines") {
      try {
        const lines = req.body?.lines;
        if (!Array.isArray(lines)) return res.status(400).json({ success: false, error: "Request body must include a lines array" });
        if (lines.length > MAX_BATCH_SIZE) return res.status(400).json({ success: false, error: `Batch size cannot exceed ${MAX_BATCH_SIZE}` });

        const result = await prisma.$transaction(
          lines.map((line: Record<string, unknown>) => {
            const data = toLineData(line, user.id);
            return prisma.invoiceReconciliationLine.upsert({
              where: { rowKey: data.rowKey },
              create: data,
              update: data,
            });
          }),
        );
        return res.status(201).json({ success: true, data: result.map(formatLine) });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to save invoice reconciliation rows";
        if (message.includes("required") || message.includes("too long")) {
          return res.status(400).json({ success: false, error: message });
        }
        console.error("Error bulk upserting invoice reconciliation rows:", error);
        return res.status(500).json({ success: false, error: "Failed to save invoice reconciliation rows" });
      }
    }

    if (action === "bulk-upsert-reviews") {
      try {
        const reviews = req.body?.reviews;
        if (!reviews || typeof reviews !== "object" || Array.isArray(reviews)) {
          return res.status(400).json({ success: false, error: "Request body must include a reviews object" });
        }
        const entries = Object.entries(reviews as Record<string, unknown>).filter(([aso]) => normalize(aso));
        if (entries.length > MAX_BATCH_SIZE) return res.status(400).json({ success: false, error: `Batch size cannot exceed ${MAX_BATCH_SIZE}` });

        const result = await prisma.$transaction(
          entries.map(([aso, status]) => prisma.invoiceReconciliationReview.upsert({
            where: { aso: normalize(aso) },
            create: { aso: normalize(aso), status: normalize(status), updatedById: user.id },
            update: { status: normalize(status), updatedById: user.id },
          })),
        );
        return res.status(201).json({ success: true, data: formatReviewMap(result) });
      } catch (error) {
        console.error("Error saving invoice reconciliation reviews:", error);
        return res.status(500).json({ success: false, error: "Failed to save invoice reconciliation reviews" });
      }
    }

    if (action === "bulk-upsert-timing-notes") {
      try {
        const notes = req.body?.notes;
        if (!notes || typeof notes !== "object" || Array.isArray(notes)) {
          return res.status(400).json({ success: false, error: "Request body must include a notes object" });
        }
        const entries = Object.entries(notes as Record<string, unknown>).filter(([invoiceKey]) => normalize(invoiceKey));
        if (entries.length > MAX_BATCH_SIZE) return res.status(400).json({ success: false, error: `Batch size cannot exceed ${MAX_BATCH_SIZE}` });

        const result = await prisma.$transaction(
          entries.map(([invoiceKey, note]) => prisma.invoiceReconciliationTimingNote.upsert({
            where: { invoiceKey: normalize(invoiceKey) },
            create: {
              invoiceKey: normalize(invoiceKey),
              invoiceNumber: normalize(invoiceKey).startsWith("invoice:") ? normalize(invoiceKey).slice(8) : null,
              note: normalize(note),
              updatedById: user.id,
            },
            update: {
              note: normalize(note),
              updatedById: user.id,
            },
          })),
        );
        return res.status(201).json({ success: true, data: formatNoteMap(result) });
      } catch (error) {
        console.error("Error saving invoice timing notes:", error);
        return res.status(500).json({ success: false, error: "Failed to save invoice timing notes" });
      }
    }

    return res.status(400).json({ success: false, error: "Unsupported action" });
  }

  if (req.method === "DELETE") {
    if (user.role !== "admin") return res.status(403).json({ success: false, error: "Admin role required to reset invoice ledger" });
    if (action !== "lines") return res.status(400).json({ success: false, error: "Unsupported action" });

    try {
      const deleted = await prisma.invoiceReconciliationLine.deleteMany();
      return res.json({ success: true, data: { deleted: deleted.count } });
    } catch (error) {
      console.error("Error resetting invoice ledger:", error);
      return res.status(500).json({ success: false, error: "Failed to reset invoice ledger" });
    }
  }

  return res.status(405).json({ success: false, error: "Method not allowed" });
}
