import React, { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileText, Search, Upload, XCircle } from "lucide-react";
import * as XLSX from "../../lib/spreadsheet";
import { useDispatch } from "../../context/DispatchContext";
import { useNotification } from "../../context/NotificationContext";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { formatNumber } from "../../utils/format";
import type { Job } from "../../types";

type InvoiceStatus = "matched" | "not-invoiced" | "not-delivered" | "qty-mismatch";

interface InvoiceLine {
  aso: string;
  invoiceNumber: string;
  invoiceDate: string;
  customer: string;
  invoiceQty: number;
  invoiceValue?: number;
  product?: string;
}

interface InvoiceSummary {
  aso: string;
  invoiceNumbers: string[];
  invoiceDates: string[];
  customer: string;
  invoiceQty: number;
  invoiceValue: number;
  products: string[];
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

interface ReconciliationRow {
  aso: string;
  customer: string;
  deliveredQty: number;
  invoicedQty: number;
  varianceQty: number;
  pallets: number;
  deliveredAt: string;
  invoiceNumbers: string;
  invoiceDates: string;
  status: InvoiceStatus;
  lineCount: number;
  products: string;
}

const STORAGE_KEY = "dispatch_invoice_reconciliation_lines_v1";

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
  "not-delivered": "Invoiced Not Delivered",
  "qty-mismatch": "Qty Mismatch",
};

const statusTone: Record<InvoiceStatus, string> = {
  matched: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "not-invoiced": "border-red-200 bg-red-50 text-red-700",
  "not-delivered": "border-amber-200 bg-amber-50 text-amber-700",
  "qty-mismatch": "border-orange-200 bg-orange-50 text-orange-700",
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
      customer: line.customer || "",
      invoiceQty: 0,
      invoiceValue: 0,
      products: [],
    };
    if (line.invoiceNumber && !existing.invoiceNumbers.includes(line.invoiceNumber)) existing.invoiceNumbers.push(line.invoiceNumber);
    if (line.invoiceDate && !existing.invoiceDates.includes(line.invoiceDate)) existing.invoiceDates.push(line.invoiceDate);
    if (line.product && !existing.products.includes(line.product)) existing.products.push(line.product);
    existing.customer = existing.customer || line.customer || "";
    existing.invoiceQty += line.invoiceQty || 0;
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
    const aso = normalizeAso(findValue(row, ["aso", "ref", "reference", "order no", "order number", "document no", "sales order"]));
    if (!aso) return null;
    parsedLines.push({
      aso,
      invoiceNumber: String(findValue(row, ["invoice number", "invoice no", "invoice", "tax invoice"]) ?? "").trim(),
      invoiceDate: normalizeDate(findValue(row, ["invoice date", "date", "tax invoice date"])),
      customer: String(findValue(row, ["customer", "customer name", "client", "account name"]) ?? "").trim(),
      invoiceQty: parseNumber(findValue(row, ["invoice qty", "invoiced qty", "qty", "quantity", "invoice quantity"])),
      invoiceValue: parseNumber(findValue(row, ["invoice value", "value", "amount", "total", "net amount"])),
      product: String(findValue(row, ["product", "description", "inventory description", "item", "product description"]) ?? "").trim(),
    });
  });

  return parsedLines;
};

export const InvoicingReconciliation: React.FC = () => {
  const { jobs } = useDispatch();
  const { showSuccess, showError, showWarning } = useNotification();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>(() => loadInvoiceLines());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStatus, setActiveStatus] = useState<InvoiceStatus | "all">("all");
  const [isImporting, setIsImporting] = useState(false);

  const deliveredByAso = useMemo(() => buildDeliveredSummaries(jobs), [jobs]);
  const invoicedByAso = useMemo(() => buildInvoiceSummaries(invoiceLines), [invoiceLines]);

  const reconciliationRows = useMemo<ReconciliationRow[]>(() => {
    const allAsos = new Set([...deliveredByAso.keys(), ...invoicedByAso.keys()]);
    return Array.from(allAsos).map((aso) => {
      const delivered = deliveredByAso.get(aso);
      const invoiced = invoicedByAso.get(aso);
      const deliveredQty = delivered?.deliveredQty || 0;
      const invoicedQty = invoiced?.invoiceQty || 0;
      let status: InvoiceStatus = "matched";
      if (delivered && !invoiced) status = "not-invoiced";
      else if (!delivered && invoiced) status = "not-delivered";
      else if (deliveredQty !== invoicedQty) status = "qty-mismatch";

      return {
        aso,
        customer: delivered?.customer || invoiced?.customer || "",
        deliveredQty,
        invoicedQty,
        varianceQty: deliveredQty - invoicedQty,
        pallets: delivered?.pallets || 0,
        deliveredAt: delivered?.deliveredAt ? delivered.deliveredAt.slice(0, 10) : "",
        invoiceNumbers: invoiced?.invoiceNumbers.join(", ") || "",
        invoiceDates: invoiced?.invoiceDates.join(", ") || "",
        status,
        lineCount: delivered?.lineCount || 0,
        products: invoiced?.products.slice(0, 4).join("; ") || delivered?.lines.map((line) => line.notes).filter(Boolean).slice(0, 4).join("; ") || "",
      };
    }).sort((a, b) => {
      const severityOrder: Record<InvoiceStatus, number> = { "not-invoiced": 0, "qty-mismatch": 1, "not-delivered": 2, matched: 3 };
      return severityOrder[a.status] - severityOrder[b.status] || a.aso.localeCompare(b.aso);
    });
  }, [deliveredByAso, invoicedByAso]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return reconciliationRows.filter((row) => {
      if (activeStatus !== "all" && row.status !== activeStatus) return false;
      if (!query) return true;
      return [row.aso, row.customer, row.invoiceNumbers, row.products, statusLabel[row.status]].join(" ").toLowerCase().includes(query);
    });
  }, [activeStatus, reconciliationRows, searchQuery]);

  const stats = useMemo(() => {
    const bucket = (status: InvoiceStatus) => reconciliationRows.filter((row) => row.status === status);
    const notInvoiced = bucket("not-invoiced");
    const mismatch = bucket("qty-mismatch");
    return {
      delivered: deliveredByAso.size,
      invoiceLines: invoiceLines.length,
      matched: bucket("matched").length,
      notInvoiced: notInvoiced.length,
      notDelivered: bucket("not-delivered").length,
      mismatch: mismatch.length,
      notInvoicedQty: notInvoiced.reduce((sum, row) => sum + row.deliveredQty, 0),
      varianceQty: mismatch.reduce((sum, row) => sum + Math.abs(row.varianceQty), 0),
    };
  }, [deliveredByAso.size, invoiceLines.length, reconciliationRows]);

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

  const downloadTemplate = async () => {
    const data = [
      ["ASO", "Invoice Number", "Invoice Date", "Customer", "Invoice Qty", "Invoice Value", "Product"],
      ["SO-0001", "INV-0001", "2026-06-03", "Customer Name", "100", "1250.00", "Product description"],
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
      "Delivered Qty": row.deliveredQty,
      "Invoiced Qty": row.invoicedQty,
      "Variance Qty": row.varianceQty,
      Pallets: row.pallets,
      "Delivered Date": row.deliveredAt,
      "Invoice Numbers": row.invoiceNumbers,
      "Invoice Dates": row.invoiceDates,
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
    { label: "Delivered Not Invoiced", value: stats.notInvoiced, sub: `${formatNumber(stats.notInvoicedQty)} qty`, tone: "border-l-red-500", status: "not-invoiced" as const },
    { label: "Qty Mismatch", value: stats.mismatch, sub: `${formatNumber(stats.varianceQty)} variance`, tone: "border-l-orange-500", status: "qty-mismatch" as const },
    { label: "Invoiced Not Delivered", value: stats.notDelivered, tone: "border-l-amber-500", status: "not-delivered" as const },
    { label: "Matched", value: stats.matched, tone: "border-l-green-500", status: "matched" as const },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoicing Reconciliation</h1>
          <p className="text-sm text-gray-500">Compare delivered ASOs against uploaded invoice ASOs and quantities.</p>
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {statCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => setActiveStatus(card.status)}
            className={`rounded-lg border border-gray-200 border-l-[3px] ${card.tone} bg-white p-4 text-left transition hover:shadow-sm ${activeStatus === card.status ? "ring-2 ring-emerald-200" : ""}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{formatNumber(card.value)}</p>
            {card.sub && <p className="mt-1 text-xs font-semibold text-gray-500">{card.sub}</p>}
          </button>
        ))}
      </div>

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
              <p>Upload an invoice spreadsheet to compare against delivered ASOs. The file should include an ASO column and an invoice quantity column.</p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="p-3 text-left">ASO</th>
                  <th className="p-3 text-left">Customer</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-right">Delivered Qty</th>
                  <th className="p-3 text-right">Invoiced Qty</th>
                  <th className="p-3 text-right">Variance</th>
                  <th className="p-3 text-right">Pallets</th>
                  <th className="p-3 text-left">Delivered</th>
                  <th className="p-3 text-left">Invoices</th>
                  <th className="p-3 text-left">Products</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-gray-500">No reconciliation rows found.</td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.aso} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3 font-semibold text-resilinc-primary">{row.aso}</td>
                      <td className="p-3 text-gray-700">{row.customer || "-"}</td>
                      <td className="p-3">
                        <span className={`inline-flex rounded border px-2 py-1 text-xs font-bold ${statusTone[row.status]}`}>
                          {row.status === "matched" && <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                          {statusLabel[row.status]}
                        </span>
                      </td>
                      <td className="p-3 text-right font-medium">{formatNumber(row.deliveredQty)}</td>
                      <td className="p-3 text-right font-medium">{formatNumber(row.invoicedQty)}</td>
                      <td className={`p-3 text-right font-bold ${row.varianceQty === 0 ? "text-gray-500" : "text-orange-700"}`}>{formatNumber(row.varianceQty)}</td>
                      <td className="p-3 text-right">{formatNumber(row.pallets)}</td>
                      <td className="p-3 text-gray-600">{row.deliveredAt || "-"}</td>
                      <td className="p-3 text-gray-600">{row.invoiceNumbers || "-"}</td>
                      <td className="max-w-[260px] truncate p-3 text-gray-500" title={row.products}>{row.products || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
