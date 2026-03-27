// src/components/views/OrderImport.tsx
import React, { useState, useCallback, useRef } from "react";
import { Upload, Check, AlertCircle, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useDispatch } from "../../context/DispatchContext";
import { useNotification } from "../../context/NotificationContext";
import { useAuth } from "../../context/AuthContext";
import { JobPriority, JobStatus } from "../../types";

/**
 * OrderImport component (Sales Orders mapping + ETA date normalization)
 * - Robust parsing (CSV/Excel via xlsx) with cellDates + raw:false
 * - Maps your sheet columns:
 *      "Document No"           -> ref
 *      "Customer Name"         -> customer
 *      "Warehouse"             -> pickup
 *      "Delivery Date"         -> eta  (normalized to YYYY-MM-DD)
 *      "Inventory Description" -> notes
 *      "Status"                -> priority
 * - Generates required Job fields: id, createdAt, updatedAt
 */

interface ImportedOrder {
  ref: string;
  customer: string;
  pickup: string;
  dropoff: string;
  warehouse?: string;  // warehouse field for filtering
  priority?: string;
  pallets?: number;
  outstandingQty?: number;  // Outstanding quantity from Excel
  eta?: string;  // normalized string (e.g., "2025-10-10")
  notes?: string;
}

// === Tunables ===
const DEFAULT_STATUS = "pending" as JobStatus;
const DEFAULT_PICKUP = "K58 Warehouse";
const DEFAULT_DROPOFF = "TBD";

// ---------- Helpers ----------
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const toISODate = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Excel serial (1900 system) -> JS Date */
const excelSerialToDate = (serial: number): Date => {
  // Excel's epoch (with the 1900-leap-year bug accounted for) is 1899-12-30
  // Multiply days by ms/day
  const ms = Math.round(serial * 86400000);
  const base = new Date(Date.UTC(1899, 11, 30));
  return new Date(base.getTime() + ms);
};

/** Normalize any ETA-like cell into YYYY-MM-DD */
const normalizeEta = (val: any): string | undefined => {
  if (val === undefined || val === null || val === "") return undefined;

  // If Date object (when cellDates:true + raw:false cooperates)
  if (val instanceof Date && !isNaN(val.getTime())) {
    return toISODate(val);
  }

  // If Excel serial number (pure number)
  if (typeof val === "number" && isFinite(val)) {
    const d = excelSerialToDate(val);
    if (!isNaN(d.getTime())) return toISODate(d);
  }

  // If string: try parse
  if (typeof val === "string") {
    const trimmed = val.trim();

    // If already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    // Excel serial number formatted as string with appended date parts
    // e.g. "46337-01-01" or "46097-01-01" — the first part is the serial
    const serialMatch = trimmed.match(/^(\d{5})-\d{2}-\d{2}$/);
    if (serialMatch) {
      const serial = parseInt(serialMatch[1], 10);
      if (serial > 30000 && serial < 100000) {
        const d = excelSerialToDate(serial);
        if (!isNaN(d.getTime())) return toISODate(d);
      }
    }

    // Pure numeric string (Excel serial as text)
    if (/^\d{5}$/.test(trimmed)) {
      const serial = parseInt(trimmed, 10);
      const d = excelSerialToDate(serial);
      if (!isNaN(d.getTime())) return toISODate(d);
    }

    // In DD/MM/YYYY format (common in Excel exports)
    const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return toISODate(date);
      }
    }

    // In MM/DD/YYYY format
    const mmddyyyyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mmddyyyyMatch) {
      const [, month, day, year] = mmddyyyyMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return toISODate(date);
      }
    }

    // In DD-MM-YYYY or DD.MM.YYYY format
    const dottedMatch = trimmed.match(/^(\d{1,2})[.\-](\d{1,2})[.\-](\d{4})$/);
    if (dottedMatch) {
      const [, day, month, year] = dottedMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return toISODate(date);
      }
    }

    // Try parsing as standard date string
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1970 && parsed.getFullYear() < 2100) {
      return toISODate(parsed);
    }

    // If it's a time-only "14:30", return undefined
    if (/^\d{1,2}:\d{2}$/.test(trimmed)) return undefined;
  }

  return undefined;
};

const normalizePriority = (p?: string): JobPriority => {
  const v = (p || "normal").toString().trim().toLowerCase();
  if (["urgent", "rush", "critical", "hot"].includes(v)) return "high";
  if (v === "high") return "high";
  if (v === "low") return "low";
  return "normal";
};

const parsePallets = (v?: string | number): number | undefined => {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "number") return Math.round(v);
  const cleaned = v.replace(/\s/g, "").replace(/,/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n) : undefined;
};

type HeaderIndex = Record<string, number>;
const indexHeaders = (headers: string[]): HeaderIndex => {
  const map: HeaderIndex = {};
  headers.forEach((h, i) => (map[h.trim().toLowerCase()] = i));
  return map;
};
const findFirst = (idx: HeaderIndex, cands: string[]) => {
  for (const c of cands) {
    if (idx[c]) return idx[c];
    if (idx[c] === 0) return 0;
  }
  return undefined;
};
const coalesce = (row: any[], idx?: number) => {
  if (idx === undefined) return undefined;
  const v = row[idx];
  if (v === undefined || v === null) return undefined;
  // xlsx with cellDates:true can return Date objects — convert to ISO string
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : toISODate(v);
  // If it's any other object (rich text, error, etc.), stringify it
  if (typeof v === "object") return String(v);
  return v;
};
const safeStr = (v: any) => {
  if (v === undefined || v === null) return undefined;
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : toISODate(v);
  return String(v).trim();
};

const ALIASES: Record<keyof Omit<ImportedOrder, never>, string[]> = {
  ref: ["ref", "reference", "document no", "document", "order no", "so", "so number", "order number", "document number"],
  customer: ["customer", "customer name", "client", "account", "account name", "customername"],
  pickup: ["pickup", "collect from", "source", "from", "origin"],
  dropoff: ["dropoff", "deliver to", "to", "destination", "ship-to", "ship to", "delivery address"],
  warehouse: ["warehouse", "wh", "warehouse name"],
  priority: ["priority", "urgency", "rush", "status", "order status"],
  pallets: ["pallets", "pallet qty", "pallet quantity"],
  outstandingQty: ["outstanding qty", "outstanding", "outstanding quantity", "qty outstanding", "balance qty", "balance"],
  eta: ["eta", "delivery date", "required date", "promise date", "due date"],
  notes: ["notes", "remarks", "comment", "inventory description", "description"],
};

// ----- Row mapping with ETA normalization -----
const rowToOrder = (headers: string[], row: any[], i: number): ImportedOrder | null => {
  const idx = indexHeaders(headers);

  const refIdx = findFirst(idx, ALIASES.ref);
  const customerIdx = findFirst(idx, ALIASES.customer);
  const pickupIdx = findFirst(idx, ALIASES.pickup);
  const dropoffIdx = findFirst(idx, ALIASES.dropoff);
  const warehouseIdx = findFirst(idx, ALIASES.warehouse);
  const priorityIdx = findFirst(idx, ALIASES.priority);
  const palletsIdx = findFirst(idx, ALIASES.pallets);
  const outstandingQtyIdx = findFirst(idx, ALIASES.outstandingQty);
  const etaIdx = findFirst(idx, ALIASES.eta);
  const notesIdx = findFirst(idx, ALIASES.notes);

  const ref =
    safeStr(coalesce(row, idx["document no"])) ??
    safeStr(coalesce(row, refIdx)) ??
    `ORD-${Date.now()}-${i}`;

  const customer =
    safeStr(coalesce(row, idx["customer name"])) ??
    safeStr(coalesce(row, customerIdx));

  // Warehouse field for filtering
  let warehouse =
    safeStr(coalesce(row, idx["warehouse"])) ??
    safeStr(coalesce(row, warehouseIdx));

  // Don't use "K58 Warehouse" as a warehouse value — it's the default pickup, not a warehouse
  if (warehouse === "K58 Warehouse") warehouse = undefined;

  // Pickup can be same as warehouse or a different field
  const pickup = warehouse ?? safeStr(coalesce(row, pickupIdx)) ?? DEFAULT_PICKUP;

  const dropoff = safeStr(coalesce(row, dropoffIdx)) ?? DEFAULT_DROPOFF;

  const priorityRaw =
    coalesce(row, idx["status"]) ?? coalesce(row, priorityIdx);
  const priority = normalizePriority(safeStr(priorityRaw));

  // ETA: prefer "Delivery Date", then alias; then normalize
  const etaRaw =
    coalesce(row, idx["delivery date"]) ??
    coalesce(row, etaIdx);
  const eta = normalizeEta(etaRaw);

  const notes =
    safeStr(coalesce(row, idx["inventory description"])) ??
    safeStr(coalesce(row, notesIdx));

  const pallets = parsePallets(safeStr(coalesce(row, palletsIdx)));
  const outstandingQty = parsePallets(safeStr(coalesce(row, outstandingQtyIdx)));

  if (!ref || !customer) return null;

  // Ensure all string fields are primitives (xlsx can return Date objects with cellDates:true)
  const safe = (v: any): string | undefined => {
    if (v === undefined || v === null) return undefined;
    if (v instanceof Date) return toISODate(v);
    return String(v);
  };

  return {
    ref: safe(ref)!,
    customer: safe(customer)!,
    pickup: safe(pickup)!,
    dropoff: safe(dropoff)!,
    warehouse: safe(warehouse),
    priority: safe(priority) as any,
    pallets,
    outstandingQty,
    eta: safe(eta),
    notes: safe(notes),
  };
};

// ---------- Parsing (enable cellDates + raw:false) ----------
const SHEET_TO_JSON_OPTS = { header: 1, raw: false, rawNumbers: false } as const;

const parseCSV = (text: string): ImportedOrder[] => {
  // NOTE: cellDates is set in XLSX.read (below)
  const wb = XLSX.read(text, { type: "string", cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, SHEET_TO_JSON_OPTS);
  if (!rows.length) return [];
  const headers = rows[0].map((h: any) => String(h).trim());
  const orders: ImportedOrder[] = [];
  for (let i = 1; i < rows.length; i++) {
    const order = rowToOrder(headers, rows[i], i);
    if (order) orders.push(order);
  }
  return orders;
};

const parseExcel = (arrayBuffer: ArrayBuffer): ImportedOrder[] => {
  try {
    const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, SHEET_TO_JSON_OPTS);
    if (!rows.length) return [];
    const headers = rows[0].map((h: any) => String(h).trim());
    const orders: ImportedOrder[] = [];
    for (let i = 1; i < rows.length; i++) {
      const order = rowToOrder(headers, rows[i], i);
      if (order) orders.push(order);
    }
    return orders;
  } catch (err) {
    console.error("Error parsing Excel file:", err);
    return [];
  }
};

// ---------- Component ----------
export const OrderImport: React.FC = () => {
  const { refreshData: _refreshData } = useDispatch(); // eslint-disable-line
  const { showSuccess, showError } = useNotification();
  const { isViewer } = useAuth();
  const [importedOrders, setImportedOrders] = useState<ImportedOrder[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Import results for summary page
  interface ImportResult {
    timestamp: string;
    newOrders: ImportedOrder[];
    updatedOrders: ImportedOrder[];
    skippedOrders: ImportedOrder[];
    failedOrders: ImportedOrder[];
  }
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  /* temporarily disabled for debugging
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [sortField, setSortField] = useState<keyof ImportedOrder | "">("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  */

  // Get unique warehouses from imported orders
  /* temporarily disabled for debugging
  const warehouses = useMemo(() => {
    const uniqueWarehouses = new Set<string>();
    importedOrders.forEach((order) => {
      if (order.warehouse) uniqueWarehouses.add(order.warehouse);
    });
    return Array.from(uniqueWarehouses).sort();
  }, [importedOrders]);
  */

  // Filter and sort orders
  /* temporarily disabled for debugging
  const filteredAndSortedOrders = useMemo(() => {
    let filtered = importedOrders.filter((order) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchableText = [
          order.ref,
          order.customer,
          order.warehouse || "",
          order.dropoff,
          order.notes || "",
        ].join(" ").toLowerCase();
        if (!searchableText.includes(query)) return false;
      }

      // Warehouse filter
      if (selectedWarehouse !== "all" && order.warehouse !== selectedWarehouse) {
        return false;
      }

      // Priority filter
      if (selectedPriority !== "all" && order.priority !== selectedPriority) {
        return false;
      }

      return true;
    });

    // Sorting
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];

        if (aVal === undefined && bVal === undefined) return 0;
        if (aVal === undefined) return 1;
        if (bVal === undefined) return -1;

        let comparison = 0;
        if (typeof aVal === "string" && typeof bVal === "string") {
          comparison = aVal.localeCompare(bVal);
        } else if (typeof aVal === "number" && typeof bVal === "number") {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }

        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return filtered;
  }, [importedOrders, searchQuery, selectedWarehouse, selectedPriority, sortField, sortDirection]);
  */

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    const isExcel = /\.(xlsx|xls)$/i.test(file.name);

    reader.onload = (e) => {
      try {
        let orders: ImportedOrder[] = [];
        if (isExcel) {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          orders = parseExcel(arrayBuffer);
        } else {
          const text = e.target?.result as string;
          orders = parseCSV(text);
        }

        if (orders.length > 0) {
          // Debug: log first order to check for object values
          console.log("[OrderImport] First parsed order:", JSON.stringify(orders[0], (_, v) => v instanceof Date ? `[DATE:${v.toISOString()}]` : v));
          console.log("[OrderImport] Raw first order:", orders[0]);
          setImportedOrders(orders);
          setImportStatus("success");
        } else {
          setImportStatus("error");
        }
      } catch (error) {
        console.error("Error parsing file:", error);
        setImportStatus("error");
      }
    };

    if (isExcel) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files?.[0];
      const validTypes = [
        "text/csv",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];
      const validExtensions = [".csv", ".xlsx", ".xls"];

      if (
        file &&
        (validTypes.includes(file.type) ||
          validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext)))
      ) {
        handleFileUpload(file);
      }
    },
    [handleFileUpload]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };


  const importToDispatch = async () => {
    if (isImporting) return;
    setIsImporting(true);
    try {
      const { jobsAPI } = await import("../../services/api");

      // Get existing jobs from database to detect duplicates
      const existingJobs = await jobsAPI.getAll();
      const existingByRef = new Map<string, typeof existingJobs>();
      existingJobs.forEach((j) => {
        const list = existingByRef.get(j.ref) || [];
        list.push(j);
        existingByRef.set(j.ref, list);
      });

      // Convert imported orders
      const allOrders = importedOrders.map((order) => ({
        ref: order.ref,
        customer: order.customer,
        pickup: order.pickup || DEFAULT_PICKUP,
        dropoff: order.dropoff || DEFAULT_DROPOFF,
        warehouse: order.warehouse,
        priority: normalizePriority(order.priority),
        status: DEFAULT_STATUS,
        pallets: order.pallets,
        outstandingQty: order.outstandingQty,
        eta: order.eta,
        notes: order.notes,
      }));

      // Split into new orders and orders that need updating
      const newOrders = allOrders.filter((order) => !existingByRef.has(order.ref));
      const existingOrders = allOrders.filter((order) => existingByRef.has(order.ref));

      // Create new orders
      if (newOrders.length > 0) {
        await jobsAPI.bulkCreate(newOrders);
      }

      // Update existing orders: match by ref + notes (product name) for line-item accuracy
      let updatedCount = 0;
      let failedCount = 0;
      for (const order of existingOrders) {
        const existingLines = existingByRef.get(order.ref) || [];
        // Match by ref + product name (notes) to find the exact line item
        const match = existingLines.find((j) => j.notes === order.notes)
          || (existingLines.length === 1 ? existingLines[0] : null);

        if (match) {
          // Only send fields that have values — skip undefined to avoid overwriting with null
          const updates: Record<string, any> = {};
          if (order.customer) updates.customer = order.customer;
          if (order.pickup) updates.pickup = order.pickup;
          if (order.dropoff) updates.dropoff = order.dropoff;
          if (order.warehouse !== undefined) updates.warehouse = order.warehouse;
          if (order.pallets !== undefined) updates.pallets = order.pallets;
          if (order.outstandingQty !== undefined) updates.outstandingQty = order.outstandingQty;
          if (order.eta !== undefined) updates.eta = order.eta;
          if (order.notes !== undefined) updates.notes = order.notes;

          if (Object.keys(updates).length > 0) {
            try {
              await jobsAPI.update(match.id, updates as any);
              updatedCount++;
            } catch (err) {
              console.error(`Failed to update order ${order.ref}:`, err);
              failedCount++;
            }
          }
        }
      }

      const skippedOrders = existingOrders.slice(0, existingOrders.length - updatedCount - failedCount);
      const failedOrdersList = existingOrders.slice(existingOrders.length - failedCount);
      const updatedOrdersList = existingOrders.slice(0, updatedCount);

      // DEBUG: skip refreshData to isolate crash
      // await refreshData();

      const parts = [];
      if (newOrders.length > 0) parts.push(`${newOrders.length} new orders imported`);
      if (updatedCount > 0) parts.push(`${updatedCount} existing orders updated`);
      if (skippedOrders.length > 0) parts.push(`${skippedOrders.length} duplicate orders skipped (no changes)`);
      if (failedCount > 0) parts.push(`${failedCount} orders failed to update`);
      if (parts.length === 0) parts.push("No changes needed");
      showSuccess(parts.join(". "));

      // Save import results for summary page — ensure all values are primitives
      const sanitizeOrders = (orders: any[]): ImportedOrder[] =>
        orders.map((o) => ({
          ref: String(o.ref ?? ""),
          customer: String(o.customer ?? ""),
          pickup: String(o.pickup ?? DEFAULT_PICKUP),
          dropoff: String(o.dropoff ?? DEFAULT_DROPOFF),
          warehouse: o.warehouse != null ? String(o.warehouse) : undefined,
          priority: String(o.priority ?? "normal"),
          pallets: typeof o.pallets === "number" ? o.pallets : undefined,
          outstandingQty: typeof o.outstandingQty === "number" ? o.outstandingQty : undefined,
          eta: o.eta != null ? String(o.eta) : undefined,
          notes: o.notes != null ? String(o.notes) : undefined,
        }));

      setImportResult({
        timestamp: new Date().toISOString(),
        newOrders: sanitizeOrders(newOrders),
        updatedOrders: sanitizeOrders(updatedOrdersList),
        skippedOrders: sanitizeOrders(skippedOrders),
        failedOrders: sanitizeOrders(failedOrdersList),
      });

      setImportedOrders([]);
      setImportStatus("idle");
    } catch (error) {
      console.error("Error importing jobs to database:", error);
      setImportStatus("error");
      showError("Import failed. Please try again.");
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = (format: "csv" | "excel" = "csv") => {
    const headers = [
      "Document No",
      "Customer Name",
      "Status",
      "Delivery Date",
      "Inventory Code",
      "Inventory Description",
      "Warehouse",
      "Outstanding Qty",
    ];

    if (format === "csv") {
      const example = [
        "SO-0001",
        "Sample Customer",
        "Normal",
        "2025-10-10",
        "ITEM-001",
        "Sample Line — fragile",
        "K58 Warehouse",
        "120",
      ];
      const csv = [headers.join(","), example.join(",")].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sales_orders_based_template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const data = [
        headers,
        ["SO-0001", "Sample Customer", "Normal", "2025-10-10", "ITEM-001", "Sample Line — fragile", "K58 Warehouse", "120"],
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "SalesOrdersTemplate");
      XLSX.writeFile(workbook, "sales_orders_based_template.xlsx");
    }
  };

  /* temporarily disabled for debugging
  const getBadgeVariant = (p?: string): string => {
    const v = (p || "normal").toLowerCase();
    if (v === "urgent" || v === "high") return "warning";
    if (v === "low") return "secondary";
    return "default";
  };
  */

  // Render import summary page
  if (importResult) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Check className="h-8 w-8 text-green-600" />
                <h1 className="text-3xl font-bold text-gray-900">Import Complete</h1>
              </div>
              <p className="text-gray-600">
                {String(importResult.newOrders.length)} new, {String(importResult.updatedOrders.length)} updated, {String(importResult.skippedOrders.length)} skipped, {String(importResult.failedOrders.length)} failed
              </p>
            </div>
            <Button onClick={() => setImportResult(null)} className="gap-2">
              <Upload className="h-4 w-4" />
              New Import
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const [showFormatTips, setShowFormatTips] = useState(false);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import Customer Orders</h1>
          <p className="text-sm text-gray-500">Drop your Sales Orders export — auto-maps Document No, Customer, Warehouse, Delivery Date</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => downloadTemplate("csv")} className="text-sm">
            <Download className="mr-1.5 h-3.5 w-3.5" /> CSV
          </Button>
          <Button variant="outline" onClick={() => downloadTemplate("excel")} className="text-sm">
            <Download className="mr-1.5 h-3.5 w-3.5" /> Excel
          </Button>
        </div>
      </div>

      {/* Upload Card */}
      <Card className="p-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl transition-colors flex flex-col items-center justify-center ${
            isDragging ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
          }`}
          style={{ minHeight: "130px" }}
        >
          <Upload className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-700">
            Drag & drop your file here, or{" "}
            <button onClick={() => fileInputRef.current?.click()} className="text-blue-600 hover:text-blue-700 underline">browse</button>
          </p>
          <p className="text-xs text-gray-400 mt-1">CSV, XLSX, XLS</p>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" id="file-upload" />
        </div>

        {/* Status Messages */}
        {importStatus === "success" && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-700 text-sm">
            <Check className="h-4 w-4" />
            <span className="font-medium">Successfully parsed {importedOrders.length} orders</span>
          </div>
        )}
        {importStatus === "error" && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">No valid rows found. Check your column headers.</span>
          </div>
        )}

        {/* Format Tips — accordion inside the card */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <button onClick={() => setShowFormatTips(!showFormatTips)} className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-700 font-medium py-1">
            <span>Column mapping reference</span>
            <span className="text-[10px]">{showFormatTips ? "▲" : "▼"}</span>
          </button>
        </div>
        {showFormatTips && (
          <div className="mt-2 rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-1">
              <span><strong>Document No</strong> → Reference</span>
              <span><strong>Customer Name</strong> → Customer</span>
              <span><strong>Warehouse</strong> → Pickup</span>
              <span><strong>Delivery Date</strong> → ETA</span>
              <span><strong>Inventory Description</strong> → Line Item</span>
              <span><strong>Status</strong> → Priority</span>
            </div>
          </div>
        )}
      </Card>

      {/* Preview — extreme minimal test */}
      {importedOrders.length > 0 && (
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-green-700 font-bold">{String(importedOrders.length)} orders parsed successfully</p>
          <button onClick={() => { setImportedOrders([]); setImportStatus("idle"); }} className="mt-2 text-sm text-red-600 underline">Clear</button>
          <button onClick={importToDispatch} disabled={isImporting || isViewer} className="mt-2 ml-4 text-sm text-blue-600 underline">
            {isImporting ? "Importing..." : "Import"}
          </button>
        </div>
      )}

      {/* Preview placeholder */}
      {importedOrders.length === 0 && importStatus === "idle" && (
        <Card className="py-6 px-4">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-500">No orders imported yet</p>
            <p className="text-xs text-gray-400 mt-0.5">Upload a CSV or Excel file to preview orders before import</p>
          </div>
        </Card>
      )}

    </div>
  );
};
