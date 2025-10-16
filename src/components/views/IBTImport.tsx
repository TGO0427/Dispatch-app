// src/components/views/OrderImport.tsx
import React, { useState, useCallback, useRef, useMemo } from "react";
import { Upload, Check, AlertCircle, Download, Search, Filter, ArrowUpDown } from "lucide-react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Select } from "../ui/Select";
import { useDispatch } from "../../context/DispatchContext";
import { JobPriority, JobStatus } from "../../types";

/**
 * IBTImport component (Internal Branch Transfer mapping)
 * - Robust parsing (CSV/Excel via xlsx) with cellDates + raw:false
 * - Maps IBT columns:
 *      "Document No" or "IBT No"       -> ref
 *      "From Branch" or "Source"       -> pickup (warehouse)
 *      "To Branch" or "Destination"    -> dropoff
 *      "Transfer Date" or "Date"       -> eta (normalized to YYYY-MM-DD)
 *      "Description" or "Notes"        -> notes
 *      "Priority" or "Status"          -> priority
 * - Automatically tags as IBT transfers
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
const DEFAULT_CUSTOMER = "IBT - Internal Transfer";
const DEFAULT_PICKUP = "Source Branch";
const DEFAULT_DROPOFF = "Destination Branch";

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

  // If Excel serial number
  if (typeof val === "number" && isFinite(val)) {
    const d = excelSerialToDate(val);
    if (!isNaN(d.getTime())) return toISODate(d);
  }

  // If string: try parse
  if (typeof val === "string") {
    // If already in YYYY-MM-DD format, return as-is
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return val;
    }

    // If in DD/MM/YYYY format (common in Excel exports)
    const ddmmyyyyMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return toISODate(date);
      }
    }

    // Try parsing as standard date string
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) return toISODate(parsed);

    // If it's a time-only "14:30", return undefined
    if (/^\d{1,2}:\d{2}$/.test(val)) return undefined;

    // Otherwise keep original string (might be useful for debugging)
    return val;
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
  const s = typeof v === "number" ? String(v) : v;
  const cleaned = s.replace(/\s/g, "").replace(/,/g, "");
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : undefined;
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
  ref: ["ref", "reference", "document no", "document", "ibt no", "ibt number", "transfer no", "transfer number"],
  customer: ["customer", "customer name", "transfer type", "type"],
  pickup: ["pickup", "from branch", "source", "from", "origin", "source branch", "collect from"],
  dropoff: ["dropoff", "to branch", "destination", "to", "destination branch", "deliver to"],
  warehouse: ["warehouse", "from warehouse", "source warehouse"],
  priority: ["priority", "urgency", "rush", "status"],
  pallets: ["pallets", "pallet qty", "pallet quantity", "qty"],
  outstandingQty: ["outstanding qty", "outstanding", "outstanding quantity", "qty outstanding", "balance qty", "balance"],
  eta: ["eta", "transfer date", "date", "delivery date", "required date", "due date"],
  notes: ["notes", "remarks", "comment", "description", "items"],
};

// ----- Row mapping with ETA normalization -----
const rowToOrder = (headers: string[], row: any[], i: number): ImportedOrder | null => {
  const idx = indexHeaders(headers);

  const refIdx = findFirst(idx, ALIASES.ref);
  const pickupIdx = findFirst(idx, ALIASES.pickup);
  const dropoffIdx = findFirst(idx, ALIASES.dropoff);
  const warehouseIdx = findFirst(idx, ALIASES.warehouse);
  const priorityIdx = findFirst(idx, ALIASES.priority);
  const palletsIdx = findFirst(idx, ALIASES.pallets);
  const outstandingQtyIdx = findFirst(idx, ALIASES.outstandingQty);
  const etaIdx = findFirst(idx, ALIASES.eta);
  const notesIdx = findFirst(idx, ALIASES.notes);

  const ref =
    safeStr(coalesce(row, idx["ibt no"])) ??
    safeStr(coalesce(row, idx["transfer no"])) ??
    safeStr(coalesce(row, refIdx)) ??
    `IBT-${Date.now()}-${i}`;

  const customer = DEFAULT_CUSTOMER; // Always "IBT - Internal Transfer"

  // Warehouse field for filtering
  const warehouse =
    safeStr(coalesce(row, idx["warehouse"])) ??
    safeStr(coalesce(row, warehouseIdx));

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
export const IBTImport: React.FC = () => {
  const { setJobs } = useDispatch();
  const [importedOrders, setImportedOrders] = useState<ImportedOrder[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importStatus, setImportStatus] = useState<"idle" | "success" | "error">("idle");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    try {
      // Convert all imported orders to jobs (without id, createdAt, updatedAt - server generates these)
      const jobsToCreate = importedOrders.map((order) => ({
        ref: order.ref,
        customer: order.customer,
        pickup: order.pickup || DEFAULT_PICKUP,
        dropoff: order.dropoff || DEFAULT_DROPOFF,
        warehouse: order.warehouse,  // Add warehouse field for filtering
        priority: normalizePriority(order.priority),
        status: DEFAULT_STATUS,
        pallets: order.pallets,
        outstandingQty: order.outstandingQty,
        eta: order.eta,
        notes: order.notes,
      }));

      // Save to database via API
      const { jobsAPI } = await import("../../services/api");
      const createdJobs = await jobsAPI.bulkCreate(jobsToCreate);

      // Update local state with the created jobs from the database
      setJobs(createdJobs);

      setImportedOrders([]);
      setImportStatus("idle");
    } catch (error) {
      console.error("Error importing jobs to database:", error);
      setImportStatus("error");
    }
  };

  const downloadTemplate = (format: "csv" | "excel" = "csv") => {
    const headers = [
      "IBT No",
      "From Branch",
      "To Branch",
      "Transfer Date",
      "Priority",
      "Pallets",
      "Outstanding Qty",
      "Description",
    ];

    if (format === "csv") {
      const example = [
        "IBT-0001",
        "K58 Warehouse",
        "K63 Warehouse",
        "2025-10-10",
        "Normal",
        "10",
        "120",
        "Mixed items for K63",
      ];
      const csv = [headers.join(","), example.join(",")].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ibt_template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const data = [
        headers,
        ["IBT-0001", "K58 Warehouse", "K63 Warehouse", "2025-10-10", "Normal", "10", "120", "Mixed items for K63"],
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "IBTTemplate");
      XLSX.writeFile(workbook, "ibt_template.xlsx");
    }
  };

  const getBadgeVariant = (p?: string): string => {
    const v = (p || "normal").toLowerCase();
    if (v === "urgent" || v === "high") return "warning";
    if (v === "low") return "secondary";
    return "default";
    // Align with your design system as needed
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Import Internal Branch Transfers (IBT)</h1>
            <p className="text-gray-600">
              Drop your IBT export (CSV or Excel). We'll map <em>IBT No</em>, <em>From Branch</em>, <em>To Branch</em>, and <em>Transfer Date</em> automatically.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => downloadTemplate("csv")}>
              <Download className="mr-2 h-4 w-4" /> CSV Template
            </Button>
            <Button variant="outline" onClick={() => downloadTemplate("excel")}>
              <Download className="mr-2 h-4 w-4" /> Excel Template
            </Button>
          </div>
        </div>
      </Card>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed p-12 text-center transition-colors rounded-xl ${
              isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <Upload className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              Drop CSV/Excel file here or click to browse
            </h3>
            <p className="mb-4 text-sm text-gray-600">Supported formats: .csv, .xlsx, .xls</p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <Button type="button" onClick={() => fileInputRef.current?.click()} className="cursor-pointer">
              Select File
            </Button>
          </div>

          {/* Status Messages */}
          {importStatus === "success" && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-green-700">
              <Check className="h-5 w-5" />
              <span className="font-medium">Successfully imported {importedOrders.length} orders</span>
            </div>
          )}

          {importStatus === "error" && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">No valid rows found. Please check your headers (e.g., “Document No”, “Customer Name”).</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Table */}
      {importedOrders.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Preview Orders ({importedOrders.length})</CardTitle>
              <Button onClick={importToDispatch}>Import to Dispatch System</Button>
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

      {/* Instructions */}
      <Card className="bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900">CSV/Excel Format Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-blue-900">
            <p className="font-semibold">Detects these columns automatically:</p>
            <ul className="ml-2 list-inside list-disc space-y-1">
              <li><strong>IBT No / Transfer No</strong> → Reference</li>
              <li><strong>From Branch / Source</strong> → Pickup (Source Branch)</li>
              <li><strong>To Branch / Destination</strong> → Dropoff (Destination Branch)</li>
              <li><strong>Transfer Date</strong> → ETA (normalized to YYYY-MM-DD)</li>
              <li><strong>Description / Notes</strong> → Notes</li>
              <li><strong>Priority / Status</strong> → Priority</li>
            </ul>
            <p className="mt-3 text-xs">
              <strong>Note:</strong> All imports are automatically tagged as "IBT - Internal Transfer"
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
