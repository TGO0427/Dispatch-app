// src/components/views/OrderImport.tsx
import React, { useState, useCallback, useRef, useMemo } from "react";
import { Upload, Check, AlertCircle, Download, Search, Filter, ArrowUpDown, X, Clock, Plus, RefreshCw, SkipForward, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Select } from "../ui/Select";
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
const coalesce = (row: any[], idx?: number) => (idx === undefined ? undefined : row[idx]);
const safeStr = (v: any) => (v === undefined || v === null ? undefined : String(v).trim());

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

  return { ref, customer, pickup, dropoff, warehouse, priority, pallets, outstandingQty, eta, notes };
};

// ---------- Parsing (enable cellDates + raw:false) ----------
const SHEET_TO_JSON_OPTS = { header: 1, raw: false } as const;

const parseCSV = (text: string): ImportedOrder[] => {
  // NOTE: cellDates is set in XLSX.read (below)
  const wb = XLSX.read(text, { type: "string", cellDates: true });
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
    const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
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
  const { refreshData } = useDispatch();
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

  // Advanced filtering and search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [sortField, setSortField] = useState<keyof ImportedOrder | "">("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Get unique warehouses from imported orders
  const warehouses = useMemo(() => {
    const uniqueWarehouses = new Set<string>();
    importedOrders.forEach((order) => {
      if (order.warehouse) uniqueWarehouses.add(order.warehouse);
    });
    return Array.from(uniqueWarehouses).sort();
  }, [importedOrders]);

  // Filter and sort orders
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

      await refreshData();

      const parts = [];
      if (newOrders.length > 0) parts.push(`${newOrders.length} new orders imported`);
      if (updatedCount > 0) parts.push(`${updatedCount} existing orders updated`);
      if (skippedOrders.length > 0) parts.push(`${skippedOrders.length} duplicate orders skipped (no changes)`);
      if (failedCount > 0) parts.push(`${failedCount} orders failed to update`);
      if (parts.length === 0) parts.push("No changes needed");
      showSuccess(parts.join(". "));

      // Save import results for summary page
      setImportResult({
        timestamp: new Date().toISOString(),
        newOrders,
        updatedOrders: updatedOrdersList,
        skippedOrders,
        failedOrders: failedOrdersList,
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

  const getBadgeVariant = (p?: string): string => {
    const v = (p || "normal").toLowerCase();
    if (v === "urgent" || v === "high") return "warning";
    if (v === "low") return "secondary";
    return "default";
    // Align with your design system as needed
  };

  // Render import summary page
  if (importResult) {
    const { timestamp, newOrders: newOrd, updatedOrders: updOrd, skippedOrders: skipOrd, failedOrders: failOrd } = importResult;
    const importTime = new Date(timestamp);
    const totalProcessed = newOrd.length + updOrd.length + skipOrd.length + failOrd.length;

    const formatTime = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const formatDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

    const timelineItems: { icon: React.FC<any>; color: string; bgColor: string; label: string; count: number; orders: ImportedOrder[] }[] = [
      { icon: Plus, color: "text-green-600", bgColor: "bg-green-100", label: "New Orders Imported", count: newOrd.length, orders: newOrd },
      { icon: RefreshCw, color: "text-blue-600", bgColor: "bg-blue-100", label: "Existing Orders Updated", count: updOrd.length, orders: updOrd },
      { icon: SkipForward, color: "text-gray-500", bgColor: "bg-gray-100", label: "Duplicates Skipped", count: skipOrd.length, orders: skipOrd },
      { icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-100", label: "Failed", count: failOrd.length, orders: failOrd },
    ];

    return (
      <div className="space-y-6">
        {/* Header */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Check className="h-8 w-8 text-green-600" />
                <h1 className="text-3xl font-bold text-gray-900">Import Complete</h1>
              </div>
              <p className="text-gray-600">
                {formatDate(importTime)} at {formatTime(importTime)} — {totalProcessed} orders processed
              </p>
            </div>
            <Button onClick={() => setImportResult(null)} className="gap-2">
              <Upload className="h-4 w-4" />
              New Import
            </Button>
          </div>
        </Card>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          {timelineItems.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg p-2 ${item.bgColor}`}>
                    <Icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${item.color}`}>{item.count}</div>
                    <div className="text-xs text-gray-600">{item.label}</div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-600" />
              <CardTitle>Import Timeline</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {timelineItems.filter((t) => t.count > 0).map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div key={item.label}>
                    {/* Timeline connector */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full ${item.bgColor} flex items-center justify-center`}>
                          <Icon className={`w-5 h-5 ${item.color}`} />
                        </div>
                        {idx < timelineItems.filter((t) => t.count > 0).length - 1 && (
                          <div className="w-0.5 flex-1 bg-gray-200 my-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-gray-900">{item.label}</h4>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.bgColor} ${item.color}`}>
                            {item.count}
                          </span>
                          <span className="text-xs text-gray-400">{formatTime(importTime)}</span>
                        </div>
                        {/* Order list */}
                        <div className="space-y-1.5">
                          {item.orders.slice(0, 20).map((order, i) => (
                            <div
                              key={`${order.ref}-${i}`}
                              className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-sm"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="font-semibold text-blue-600">{order.ref}</span>
                                <span className="text-gray-600 truncate">{order.customer}</span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0">
                                {order.eta && <span>{order.eta}</span>}
                                {order.warehouse && (
                                  <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">{order.warehouse}</span>
                                )}
                                {order.pallets !== undefined && <span>{order.pallets} plt</span>}
                              </div>
                            </div>
                          ))}
                          {item.orders.length > 20 && (
                            <p className="text-xs text-gray-400 pl-2">
                              + {item.orders.length - 20} more orders
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {timelineItems.every((t) => t.count === 0) && (
                <p className="text-center text-gray-500 py-8">No changes were made during this import.</p>
              )}
            </div>
          </CardContent>
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

      {/* Preview Table */}
      {importedOrders.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Preview Orders ({importedOrders.length})</CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setImportedOrders([]);
                    setImportStatus("idle");
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
                <Button onClick={importToDispatch} disabled={isImporting || isViewer}>
                  {isImporting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Importing... Please wait
                    </span>
                  ) : (
                    "Import to Dispatch System"
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Advanced Search & Filter Bar */}
            <div className="mb-6 space-y-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <Search className="h-5 w-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by reference, customer, warehouse..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 placeholder-gray-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Filters:</span>
                </div>

                <Select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  className="w-auto min-w-[200px]"
                >
                  <option value="all">All Warehouses</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse} value={warehouse}>
                      {warehouse}
                    </option>
                  ))}
                </Select>

                <Select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="w-auto"
                >
                  <option value="all">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </Select>

                <Select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as keyof ImportedOrder)}
                  className="w-auto"
                >
                  <option value="">Sort by...</option>
                  <option value="ref">Reference</option>
                  <option value="customer">Customer</option>
                  <option value="warehouse">Warehouse</option>
                  <option value="eta">ETA</option>
                  <option value="pallets">Pallets</option>
                </Select>

                {sortField && (
                  <button
                    onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                    className="flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    {sortDirection === "asc" ? "Ascending" : "Descending"}
                  </button>
                )}

                <span className="text-sm text-gray-600 ml-auto">
                  Showing {filteredAndSortedOrders.length} of {importedOrders.length} orders
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Reference</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Customer</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Warehouse</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Dropoff</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Priority</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">ETA</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Pallets</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Outstanding Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedOrders.map((order, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{order.ref}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{order.customer}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{order.warehouse ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{order.dropoff}</td>
                      <td className="px-4 py-3">
                        <Badge variant={getBadgeVariant(order.priority) as any}>
                          {order.priority || "normal"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{order.eta ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{order.pallets ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{order.outstandingQty ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
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
