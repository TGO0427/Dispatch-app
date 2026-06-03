import React, { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Download, FileText, Search, Upload, XCircle } from "lucide-react";
import * as XLSX from "../../lib/spreadsheet";
import { useDispatch } from "../../context/DispatchContext";
import { useNotification } from "../../context/NotificationContext";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { formatNumber, formatPercent } from "../../utils/format";
import type { Job } from "../../types";

type InvoiceStatus = "matched" | "not-invoiced" | "not-loaded" | "loaded-not-delivered" | "qty-mismatch";
type ReviewStatus = "open" | "needs-order-load" | "needs-dispatch-review" | "needs-finance-review" | "not-dispatch-related" | "resolved" | "ignored";

interface InvoiceLine {
  aso: string;
  invoiceNumber: string;
  invoiceDate: string;
  deliveryDueDate?: string;
  customer: string;
  invoiceQty: number;
  hasInvoiceQty: boolean;
  invoiceValue?: number;
  product?: string;
  createdBy?: string;
  deliveryStatus?: string;
  status?: string;
  postedDate?: string;
}

interface InvoiceSummary {
  aso: string;
  invoiceNumbers: string[];
  invoiceDates: string[];
  deliveryDueDates: string[];
  customer: string;
  invoiceQty: number;
  hasInvoiceQty: boolean;
  invoiceValue: number;
  products: string[];
  createdBy: string[];
  deliveryStatuses: string[];
  statuses: string[];
  postedDates: string[];
}

interface DeliveredSummary {
  aso: string;
  customer: string;
  deliveredQty: number;
  pallets: number;
  deliveredAt: string;
  lineCount: number;
  lines: Job[];
}

interface LoadedSummary {
  aso: string;
  customer: string;
  loadedQty: number;
  pallets: number;
  statuses: string[];
  latestUpdatedAt: string;
  lineCount: number;
  lines: Job[];
}

interface ReconciliationRow {
  aso: string;
  customer: string;
  deliveredQty: number;
  invoicedQty: number;
  varianceQty: number;
  pallets: number;
  deliveredAt: string;
  orderStatusDetail: string;
  invoiceNumbers: string;
  invoiceDates: string;
  deliveryDueDates: string;
  hasInvoiceQty: boolean;
  status: InvoiceStatus;
  lineCount: number;
  products: string;
  createdBy: string;
}

interface CreatorWorkload {
  createdBy: string;
  invoiceRows: number;
  asos: number;
  invoices: number;
  matchedAsos: number;
}

const STORAGE_KEY = "dispatch_invoice_reconciliation_lines_v1";
const REVIEW_STORAGE_KEY = "dispatch_invoice_reconciliation_review_v1";

const normalizeAso = (value: unknown) => String(value ?? "").trim();

const parseNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value).replace(/\s/g, "").replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDate = (value: unknown) => {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString().slice(0, 10);
};

const dateOnlyTime = (value: string | undefined) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
};

const isOnTimeInvoice = (invoiceDate: string | undefined, dueDate: string | undefined) => {
  const invoiceTime = dateOnlyTime(invoiceDate);
  const dueTime = dateOnlyTime(dueDate);
  if (invoiceTime === undefined || dueTime === undefined) return undefined;
  return invoiceTime <= dueTime;
};

const getOnTimeInvoiceLabel = (invoiceDates: string, deliveryDueDates: string) => {
  const dates = invoiceDates.split(", ").filter(Boolean);
  const dueDates = deliveryDueDates.split(", ").filter(Boolean);
  const comparisons = dates
    .flatMap((date) => dueDates.map((dueDate) => isOnTimeInvoice(date, dueDate)))
    .filter((value): value is boolean => value !== undefined);
  if (comparisons.length === 0) return "";
  const onTimeCount = comparisons.filter(Boolean).length;
  if (comparisons.length === 1) return onTimeCount === 1 ? "Yes" : "No";
  return formatPercent((onTimeCount / comparisons.length) * 100, 1);
};

const findValue = (row: Record<string, unknown>, aliases: string[]) => {
  const entries = Object.entries(row);
  const match = entries.find(([key]) => aliases.includes(key.trim().toLowerCase()));
  return match ? match[1] : undefined;
};

const loadInvoiceLines = (): InvoiceLine[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as InvoiceLine[] : [];
  } catch {
    return [];
  }
};

const saveInvoiceLines = (lines: InvoiceLine[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
};

const statusLabel: Record<InvoiceStatus, string> = {
  matched: "Delivered & Invoiced",
  "not-invoiced": "Delivered Not Invoiced",
  "not-loaded": "Invoiced Not Loaded",
  "loaded-not-delivered": "Loaded Not Delivered",
  "qty-mismatch": "Qty Mismatch",
};

const statusTone: Record<InvoiceStatus, string> = {
  matched: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "not-invoiced": "border-red-200 bg-red-50 text-red-700",
  "not-loaded": "border-amber-200 bg-amber-50 text-amber-700",
  "loaded-not-delivered": "border-yellow-200 bg-yellow-50 text-yellow-800",
  "qty-mismatch": "border-orange-200 bg-orange-50 text-orange-700",
};

const reviewLabel: Record<ReviewStatus, string> = {
  open: "Open",
  "needs-order-load": "Needs Order Load",
  "needs-dispatch-review": "Needs Dispatch Review",
  "needs-finance-review": "Needs Finance Review",
  "not-dispatch-related": "Not Dispatch Related",
  resolved: "Resolved",
  ignored: "Ignored",
};

const reviewTone: Record<ReviewStatus, string> = {
  open: "border-gray-200 bg-gray-50 text-gray-700",
  "needs-order-load": "border-amber-200 bg-amber-50 text-amber-800",
  "needs-dispatch-review": "border-yellow-200 bg-yellow-50 text-yellow-800",
  "needs-finance-review": "border-red-200 bg-red-50 text-red-700",
  "not-dispatch-related": "border-slate-200 bg-slate-50 text-slate-700",
  resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ignored: "border-gray-200 bg-gray-100 text-gray-600",
};

const reviewOptions: ReviewStatus[] = [
  "open",
  "needs-order-load",
  "needs-dispatch-review",
  "needs-finance-review",
  "not-dispatch-related",
  "resolved",
  "ignored",
];

const getExceptionOwner = (status: InvoiceStatus) => {
  if (status === "not-loaded") return "Dispatch/Admin";
  if (status === "loaded-not-delivered") return "Dispatch";
  if (status === "not-invoiced") return "Finance";
  if (status === "qty-mismatch") return "Dispatch/Finance";
  return "-";
};

const getDefaultReviewStatus = (status: InvoiceStatus): ReviewStatus => {
  if (status === "not-loaded") return "needs-order-load";
  if (status === "loaded-not-delivered") return "needs-dispatch-review";
  if (status === "not-invoiced") return "needs-finance-review";
  if (status === "matched") return "resolved";
  return "open";
};

const loadReviewState = (): Record<string, ReviewStatus> => {
  try {
    const raw = localStorage.getItem(REVIEW_STORAGE_KEY);
    return raw ? JSON.parse(raw) as Record<string, ReviewStatus> : {};
  } catch {
    return {};
  }
};

const saveReviewState = (state: Record<string, ReviewStatus>) => {
  localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(state));
};

const buildLoadedSummaries = (jobs: Job[]) => {
  const byRef = new Map<string, LoadedSummary>();
  jobs
    .filter((job) => job.jobType === "order" || job.jobType === undefined)
    .forEach((job) => {
      const aso = normalizeAso(job.ref);
      if (!aso) return;
      const existing = byRef.get(aso) || {
        aso,
        customer: job.customer || "",
        loadedQty: 0,
        pallets: 0,
        statuses: [],
        latestUpdatedAt: "",
        lineCount: 0,
        lines: [],
      };
      existing.customer = existing.customer || job.customer || "";
      existing.loadedQty += job.outstandingQty || 0;
      existing.pallets += job.pallets || 0;
      existing.lineCount += 1;
      existing.lines.push(job);
      if (job.status && !existing.statuses.includes(job.status)) existing.statuses.push(job.status);
      if (job.updatedAt && (!existing.latestUpdatedAt || new Date(job.updatedAt) > new Date(existing.latestUpdatedAt))) {
        existing.latestUpdatedAt = job.updatedAt;
      }
      byRef.set(aso, existing);
    });
  return byRef;
};

const buildDeliveredSummaries = (jobs: Job[]) => {
  const byRef = new Map<string, DeliveredSummary>();
  jobs
    .filter((job) => (job.jobType === "order" || job.jobType === undefined) && job.status === "delivered")
    .forEach((job) => {
      const aso = normalizeAso(job.ref);
      if (!aso) return;
      const existing = byRef.get(aso) || {
        aso,
        customer: job.customer || "",
        deliveredQty: 0,
        pallets: 0,
        deliveredAt: "",
        lineCount: 0,
        lines: [],
      };
      existing.customer = existing.customer || job.customer || "";
      existing.deliveredQty += job.outstandingQty || 0;
      existing.pallets += job.pallets || 0;
      existing.lineCount += 1;
      existing.lines.push(job);
      if (job.actualDeliveryAt && (!existing.deliveredAt || new Date(job.actualDeliveryAt) > new Date(existing.deliveredAt))) {
        existing.deliveredAt = job.actualDeliveryAt;
      }
      byRef.set(aso, existing);
    });
  return byRef;
};

const buildInvoiceSummaries = (lines: InvoiceLine[]) => {
  const byAso = new Map<string, InvoiceSummary>();
  lines.forEach((line) => {
    const aso = normalizeAso(line.aso);
    if (!aso) return;
    const existing = byAso.get(aso) || {
      aso,
      invoiceNumbers: [],
      invoiceDates: [],
      deliveryDueDates: [],
      customer: line.customer || "",
      invoiceQty: 0,
      hasInvoiceQty: false,
      invoiceValue: 0,
      products: [],
      createdBy: [],
      deliveryStatuses: [],
      statuses: [],
      postedDates: [],
    };
    if (line.invoiceNumber && !existing.invoiceNumbers.includes(line.invoiceNumber)) existing.invoiceNumbers.push(line.invoiceNumber);
    if (line.invoiceDate && !existing.invoiceDates.includes(line.invoiceDate)) existing.invoiceDates.push(line.invoiceDate);
    if (line.deliveryDueDate && !existing.deliveryDueDates.includes(line.deliveryDueDate)) existing.deliveryDueDates.push(line.deliveryDueDate);
    if (line.product && !existing.products.includes(line.product)) existing.products.push(line.product);
    if (line.createdBy && !existing.createdBy.includes(line.createdBy)) existing.createdBy.push(line.createdBy);
    if (line.deliveryStatus && !existing.deliveryStatuses.includes(line.deliveryStatus)) existing.deliveryStatuses.push(line.deliveryStatus);
    if (line.status && !existing.statuses.includes(line.status)) existing.statuses.push(line.status);
    if (line.postedDate && !existing.postedDates.includes(line.postedDate)) existing.postedDates.push(line.postedDate);
    existing.customer = existing.customer || line.customer || "";
    if (line.hasInvoiceQty) {
      existing.invoiceQty += line.invoiceQty || 0;
      existing.hasInvoiceQty = true;
    }
    existing.invoiceValue += line.invoiceValue || 0;
    byAso.set(aso, existing);
  });
  return byAso;
};

const parseInvoiceWorkbook = async (file: File): Promise<InvoiceLine[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = await XLSX.read(buffer, { type: "array", cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" }) as Record<string, unknown>[];
  const parsedLines: InvoiceLine[] = [];

  rows.forEach((row) => {
    const aso = normalizeAso(findValue(row, ["aso", "ref", "reference", "order no", "order number", "document no", "sales order", "source sales order"]));
    if (!aso) return null;
    const invoiceQtyValue = findValue(row, ["invoice qty", "invoiced qty", "qty", "quantity", "invoice quantity"]);
    parsedLines.push({
      aso,
      invoiceNumber: String(findValue(row, ["invoice number", "invoice no", "invoice", "tax invoice"]) ?? "").trim(),
      invoiceDate: normalizeDate(findValue(row, ["invoice date", "document date", "date", "tax invoice date"])),
      deliveryDueDate: normalizeDate(findValue(row, ["delivery / due date", "delivery due date", "due date", "delivery date"])),
      customer: String(findValue(row, ["customer", "customer name", "client", "account name"]) ?? "").trim(),
      invoiceQty: parseNumber(invoiceQtyValue),
      hasInvoiceQty: invoiceQtyValue !== undefined && invoiceQtyValue !== null && String(invoiceQtyValue).trim() !== "",
      invoiceValue: parseNumber(findValue(row, ["invoice value", "value", "amount", "total", "net amount"])),
      product: String(findValue(row, ["product", "description", "inventory description", "item", "product description"]) ?? "").trim(),
      createdBy: String(findValue(row, ["created by", "creator", "createdby", "created user", "user"]) ?? "").trim(),
      deliveryStatus: String(findValue(row, ["delivery status"]) ?? "").trim(),
      status: String(findValue(row, ["status", "invoice status"]) ?? "").trim(),
      postedDate: normalizeDate(findValue(row, ["posted date", "posting date"])),
    });
  });

  return parsedLines;
};

export const InvoicingReconciliation: React.FC = () => {
  const { jobs } = useDispatch();
  const { showSuccess, showError, showWarning } = useNotification();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>(() => loadInvoiceLines());
  const [reviewState, setReviewState] = useState<Record<string, ReviewStatus>>(() => loadReviewState());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState<InvoiceStatus | "all">("all");
  const [isImporting, setIsImporting] = useState(false);

  const loadedByAso = useMemo(() => buildLoadedSummaries(jobs), [jobs]);
  const deliveredByAso = useMemo(() => buildDeliveredSummaries(jobs), [jobs]);
  const invoicedByAso = useMemo(() => buildInvoiceSummaries(invoiceLines), [invoiceLines]);

  const reconciliationRows = useMemo<ReconciliationRow[]>(() => {
    const allAsos = new Set([...deliveredByAso.keys(), ...invoicedByAso.keys()]);
    return Array.from(allAsos).map((aso) => {
      const loaded = loadedByAso.get(aso);
      const delivered = deliveredByAso.get(aso);
      const invoiced = invoicedByAso.get(aso);
      const deliveredQty = delivered?.deliveredQty || 0;
      const invoicedQty = invoiced?.invoiceQty || 0;
      const hasInvoiceQty = Boolean(invoiced?.hasInvoiceQty);
      let status: InvoiceStatus = "matched";
      if (delivered && !invoiced) status = "not-invoiced";
      else if (!loaded && invoiced) status = "not-loaded";
      else if (loaded && !delivered && invoiced) status = "loaded-not-delivered";
      else if (hasInvoiceQty && deliveredQty !== invoicedQty) status = "qty-mismatch";

      return {
        aso,
        customer: delivered?.customer || loaded?.customer || invoiced?.customer || "",
        deliveredQty,
        invoicedQty,
        varianceQty: deliveredQty - invoicedQty,
        pallets: delivered?.pallets || loaded?.pallets || 0,
        deliveredAt: delivered?.deliveredAt ? delivered.deliveredAt.slice(0, 10) : "",
        orderStatusDetail: loaded?.statuses.join(", ") || "",
        invoiceNumbers: invoiced?.invoiceNumbers.join(", ") || "",
        invoiceDates: invoiced?.invoiceDates.join(", ") || "",
        deliveryDueDates: invoiced?.deliveryDueDates.join(", ") || "",
        hasInvoiceQty,
        status,
        lineCount: delivered?.lineCount || loaded?.lineCount || 0,
        products: invoiced?.products.slice(0, 4).join("; ") || delivered?.lines.map((line) => line.notes).filter(Boolean).slice(0, 4).join("; ") || loaded?.lines.map((line) => line.notes).filter(Boolean).slice(0, 4).join("; ") || "",
        createdBy: invoiced?.createdBy.join(", ") || "",
      };
    }).sort((a, b) => {
      const severityOrder: Record<InvoiceStatus, number> = { "not-invoiced": 0, "not-loaded": 1, "loaded-not-delivered": 2, "qty-mismatch": 3, matched: 4 };
      return severityOrder[a.status] - severityOrder[b.status] || a.aso.localeCompare(b.aso);
    });
  }, [deliveredByAso, invoicedByAso, loadedByAso]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return reconciliationRows.filter((row) => {
      if (activeStatus !== "all" && row.status !== activeStatus) return false;
      if (!query) return true;
      const reviewStatus = reviewState[row.aso] || getDefaultReviewStatus(row.status);
      return [
        row.aso,
        row.customer,
        row.invoiceNumbers,
        row.invoiceDates,
        row.deliveryDueDates,
        row.createdBy,
        row.orderStatusDetail,
        row.products,
        statusLabel[row.status],
        getExceptionOwner(row.status),
        reviewLabel[reviewStatus],
      ].join(" ").toLowerCase().includes(query);
    });
  }, [activeStatus, reconciliationRows, reviewState, searchQuery]);

  const stats = useMemo(() => {
    const bucket = (status: InvoiceStatus) => reconciliationRows.filter((row) => row.status === status);
    const notInvoiced = bucket("not-invoiced");
    const mismatch = bucket("qty-mismatch");
    const invoiceTimingRows = invoiceLines
      .map((line) => isOnTimeInvoice(line.invoiceDate, line.deliveryDueDate))
      .filter((value): value is boolean => value !== undefined);
    const onTimeInvoices = invoiceTimingRows.filter(Boolean).length;
    return {
      delivered: deliveredByAso.size,
      invoiceLines: invoiceLines.length,
      onTimeInvoices,
      invoiceTimingRows: invoiceTimingRows.length,
      onTimeInvoicePercent: invoiceTimingRows.length ? (onTimeInvoices / invoiceTimingRows.length) * 100 : 0,
      matched: bucket("matched").length,
      notInvoiced: notInvoiced.length,
      notLoaded: bucket("not-loaded").length,
      loadedNotDelivered: bucket("loaded-not-delivered").length,
      mismatch: mismatch.length,
      notInvoicedQty: notInvoiced.reduce((sum, row) => sum + row.deliveredQty, 0),
      varianceQty: mismatch.reduce((sum, row) => sum + Math.abs(row.varianceQty), 0),
      openExceptions: reconciliationRows.filter((row) => {
        if (row.status === "matched") return false;
        const reviewStatus = reviewState[row.aso] || getDefaultReviewStatus(row.status);
        return reviewStatus !== "resolved" && reviewStatus !== "ignored" && reviewStatus !== "not-dispatch-related";
      }).length,
    };
  }, [deliveredByAso.size, invoiceLines, reconciliationRows, reviewState]);

  const creatorWorkload = useMemo<CreatorWorkload[]>(() => {
    const statusByAso = new Map(reconciliationRows.map((row) => [row.aso, row.status]));
    const byCreator = new Map<string, { invoiceRows: number; asos: Set<string>; invoices: Set<string>; matchedAsos: Set<string> }>();
    invoiceLines.forEach((line) => {
      const createdBy = line.createdBy || "Unassigned";
      const aso = normalizeAso(line.aso);
      const existing = byCreator.get(createdBy) || {
        invoiceRows: 0,
        asos: new Set<string>(),
        invoices: new Set<string>(),
        matchedAsos: new Set<string>(),
      };
      existing.invoiceRows += 1;
      if (aso) {
        existing.asos.add(aso);
        const status = statusByAso.get(aso);
        if (status === "matched" || status === "qty-mismatch") existing.matchedAsos.add(aso);
      }
      if (line.invoiceNumber) existing.invoices.add(line.invoiceNumber);
      byCreator.set(createdBy, existing);
    });

    return Array.from(byCreator.entries())
      .map(([createdBy, workload]) => ({
        createdBy,
        invoiceRows: workload.invoiceRows,
        asos: workload.asos.size,
        invoices: workload.invoices.size,
        matchedAsos: workload.matchedAsos.size,
      }))
      .sort((a, b) => b.invoiceRows - a.invoiceRows || a.createdBy.localeCompare(b.createdBy));
  }, [invoiceLines, reconciliationRows]);

  const importInvoices = async (file: File | undefined) => {
    if (!file) return;
    setIsImporting(true);
    try {
      const lines = await parseInvoiceWorkbook(file);
      if (lines.length === 0) {
        showWarning("No invoice rows found. Make sure the file has an ASO column.");
        return;
      }
      setInvoiceLines(lines);
      saveInvoiceLines(lines);
      showSuccess(`Imported ${lines.length} invoice rows.`);
    } catch (error) {
      console.error("Failed to import invoice spreadsheet", error);
      showError("Could not import the invoice spreadsheet.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const clearInvoices = () => {
    setInvoiceLines([]);
    saveInvoiceLines([]);
    showSuccess("Invoice upload cleared.");
  };

  const updateReviewStatus = (aso: string, status: ReviewStatus) => {
    const next = { ...reviewState, [aso]: status };
    setReviewState(next);
    saveReviewState(next);
  };

  const copyAso = async (aso: string) => {
    try {
      await navigator.clipboard.writeText(aso);
      showSuccess(`Copied ${aso}.`);
    } catch {
      showError("Could not copy ASO.");
    }
  };

  const downloadTemplate = async () => {
    const data = [
      ["Invoice No", "Source Sales Order", "Document Date", "Delivery / Due Date", "Customer", "Created By", "Delivery Status", "Status", "Posted Date", "Invoice Qty"],
      ["INV-0001", "SO-0001", "2026-06-03", "2026-06-05", "Customer Name", "Creator Name", "Delivered", "Posted", "2026-06-03", "100"],
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(data), "InvoiceUpload");
    await XLSX.writeFile(workbook, "invoice_reconciliation_template.xlsx");
  };

  const exportReport = async () => {
    const rows = reconciliationRows.map((row) => ({
      ASO: row.aso,
      Customer: row.customer,
      Status: statusLabel[row.status],
      "Exception Owner": getExceptionOwner(row.status),
      "Review Status": reviewLabel[reviewState[row.aso] || getDefaultReviewStatus(row.status)],
      "Delivered Qty": row.deliveredQty,
      "Invoiced Qty": row.hasInvoiceQty ? row.invoicedQty : "",
      "Variance Qty": row.hasInvoiceQty ? row.varianceQty : "",
      Pallets: row.pallets,
      "Delivered Date": row.deliveredAt,
      "Order Status": row.orderStatusDetail,
      "Invoice Numbers": row.invoiceNumbers,
      "Document Date": row.invoiceDates,
      "Delivery / Due Date": row.deliveryDueDates,
      "On Time Invoice": getOnTimeInvoiceLabel(row.invoiceDates, row.deliveryDueDates),
      "Created By": row.createdBy,
      "Delivered Lines": row.lineCount,
      Products: row.products,
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Reconciliation");
    await XLSX.writeFile(workbook, "invoicing_reconciliation_report.xlsx");
  };

  const statCards = [
    { label: "Delivered ASOs", value: stats.delivered, tone: "border-l-emerald-500", status: "all" as const },
    { label: "Invoice Rows", value: stats.invoiceLines, tone: "border-l-blue-500", status: "all" as const },
    { label: "On-Time Invoice", value: formatPercent(stats.onTimeInvoicePercent, 1), sub: `${formatNumber(stats.onTimeInvoices)} of ${formatNumber(stats.invoiceTimingRows)}`, tone: "border-l-cyan-500", status: "all" as const },
    { label: "Open Exceptions", value: stats.openExceptions, tone: "border-l-slate-500", status: "all" as const },
    { label: "Delivered Not Invoiced", value: stats.notInvoiced, sub: `${formatNumber(stats.notInvoicedQty)} qty`, tone: "border-l-red-500", status: "not-invoiced" as const },
    { label: "Invoiced Not Loaded", value: stats.notLoaded, tone: "border-l-amber-500", status: "not-loaded" as const },
    { label: "Loaded Not Delivered", value: stats.loadedNotDelivered, tone: "border-l-yellow-500", status: "loaded-not-delivered" as const },
    { label: "Qty Mismatch", value: stats.mismatch, sub: `${formatNumber(stats.varianceQty)} variance`, tone: "border-l-orange-500", status: "qty-mismatch" as const },
    { label: "Matched", value: stats.matched, tone: "border-l-green-500", status: "matched" as const },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoicing Reconciliation</h1>
          <p className="text-sm text-gray-500">Compare delivered ASOs against uploaded invoice ASOs. Quantity checks run when the invoice file includes invoice quantity.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(event) => void importInvoices(event.target.files?.[0])}
          />
          <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            <Upload className="h-4 w-4" />
            {isImporting ? "Importing..." : "Upload Invoice Sheet"}
          </Button>
          <Button variant="outline" className="gap-2" onClick={downloadTemplate}>
            <Download className="h-4 w-4" />
            Template
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportReport} disabled={reconciliationRows.length === 0}>
            <FileText className="h-4 w-4" />
            Export Report
          </Button>
          <Button variant="outline" className="gap-2 border-red-200 text-red-700 hover:bg-red-50" onClick={clearInvoices} disabled={invoiceLines.length === 0}>
            <XCircle className="h-4 w-4" />
            Clear Upload
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 xl:grid-cols-9">
        {statCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => setActiveStatus(card.status)}
            className={`rounded-lg border border-gray-200 border-l-[3px] ${card.tone} bg-white p-4 text-left transition hover:shadow-sm ${activeStatus === card.status ? "ring-2 ring-emerald-200" : ""}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{typeof card.value === "number" ? formatNumber(card.value) : card.value}</p>
            {card.sub && <p className="mt-1 text-xs font-semibold text-gray-500">{card.sub}</p>}
          </button>
        ))}
      </div>

      {creatorWorkload.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Creator Workload</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="p-3 text-left">Created By</th>
                    <th className="p-3 text-right">Invoice Rows</th>
                    <th className="p-3 text-right">ASOs</th>
                    <th className="p-3 text-right">Invoices</th>
                    <th className="p-3 text-right">Matched ASOs</th>
                  </tr>
                </thead>
                <tbody>
                  {creatorWorkload.map((workload) => (
                    <tr key={workload.createdBy} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3 font-semibold text-gray-800">{workload.createdBy}</td>
                      <td className="p-3 text-right font-medium">{formatNumber(workload.invoiceRows)}</td>
                      <td className="p-3 text-right">{formatNumber(workload.asos)}</td>
                      <td className="p-3 text-right">{formatNumber(workload.invoices)}</td>
                      <td className="p-3 text-right">{formatNumber(workload.matchedAsos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>ASO Reconciliation</CardTitle>
              <p className="mt-1 text-sm text-gray-600">Delivered data comes from Order Management. Invoiced data comes from the latest uploaded spreadsheet.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-72 rounded-card border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Search ASO, customer, invoice..."
                />
              </div>
              <select
                value={activeStatus}
                onChange={(event) => setActiveStatus(event.target.value as InvoiceStatus | "all")}
                className="rounded-card border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">All statuses</option>
                {Object.entries(statusLabel).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {invoiceLines.length === 0 && (
            <div className="mb-4 flex items-start gap-3 rounded-card border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>Upload an invoice spreadsheet to compare against delivered ASOs. Your current file can use Source Sales Order as the ASO, with Invoice No, Document Date, Customer, Created By, Delivery Status, Status, and Posted Date. Invoice Qty is optional.</p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1680px] text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="p-3 text-left">ASO</th>
                  <th className="p-3 text-left">Customer</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Owner</th>
                  <th className="p-3 text-left">Review</th>
                  <th className="p-3 text-right">Delivered Qty</th>
                  <th className="p-3 text-right">Invoiced Qty</th>
                  <th className="p-3 text-right">Variance</th>
                  <th className="p-3 text-right">Pallets</th>
                  <th className="p-3 text-left">Delivered</th>
                  <th className="p-3 text-left">Order Status</th>
                  <th className="p-3 text-left">Invoices</th>
                  <th className="p-3 text-left">Created By</th>
                  <th className="p-3 text-left">Document Date</th>
                  <th className="p-3 text-left">Delivery / Due Date</th>
                  <th className="p-3 text-left">Products</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="p-8 text-center text-gray-500">No reconciliation rows found.</td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const reviewStatus = reviewState[row.aso] || getDefaultReviewStatus(row.status);
                    const owner = getExceptionOwner(row.status);
                    return (
                      <tr key={row.aso} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 font-semibold text-resilinc-primary">{row.aso}</td>
                        <td className="p-3 text-gray-700">{row.customer || "-"}</td>
                        <td className="p-3">
                          <span className={`inline-flex rounded border px-2 py-1 text-xs font-bold ${statusTone[row.status]}`}>
                            {row.status === "matched" && <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                            {statusLabel[row.status]}
                          </span>
                        </td>
                        <td className="p-3 text-xs font-bold uppercase tracking-wide text-gray-600">{owner}</td>
                        <td className="p-3">
                          <select
                            value={reviewStatus}
                            onChange={(event) => updateReviewStatus(row.aso, event.target.value as ReviewStatus)}
                            className={`w-48 rounded border px-2 py-1 text-xs font-bold focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${reviewTone[reviewStatus]}`}
                          >
                            {reviewOptions.map((option) => (
                              <option key={option} value={option}>{reviewLabel[option]}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3 text-right font-medium">{formatNumber(row.deliveredQty)}</td>
                        <td className="p-3 text-right font-medium">{row.hasInvoiceQty ? formatNumber(row.invoicedQty) : "-"}</td>
                        <td className={`p-3 text-right font-bold ${row.varianceQty === 0 ? "text-gray-500" : "text-orange-700"}`}>{row.hasInvoiceQty ? formatNumber(row.varianceQty) : "-"}</td>
                        <td className="p-3 text-right">{formatNumber(row.pallets)}</td>
                        <td className="p-3 text-gray-600">{row.deliveredAt || "-"}</td>
                        <td className="max-w-[160px] truncate p-3 text-gray-600" title={row.orderStatusDetail}>{row.orderStatusDetail || "-"}</td>
                        <td className="p-3 text-gray-600">{row.invoiceNumbers || "-"}</td>
                        <td className="max-w-[180px] truncate p-3 text-gray-600" title={row.createdBy}>{row.createdBy || "-"}</td>
                        <td className="max-w-[170px] truncate p-3 text-gray-600" title={row.invoiceDates}>{row.invoiceDates || "-"}</td>
                        <td className="max-w-[170px] truncate p-3 text-gray-600" title={row.deliveryDueDates}>{row.deliveryDueDates || "-"}</td>
                        <td className="max-w-[260px] truncate p-3 text-gray-500" title={row.products}>{row.products || "-"}</td>
                        <td className="p-3">
                          <Button variant="outline" size="sm" className="gap-1" onClick={() => void copyAso(row.aso)}>
                            <Copy className="h-3.5 w-3.5" />
                            Copy ASO
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
