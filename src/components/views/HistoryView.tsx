// src/components/views/HistoryView.tsx
import React, { useMemo, useState } from "react";
import { Clock, Search, Filter, Download, Calendar as CalendarIcon, CheckCircle2, XCircle, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useDispatch } from "../../context/DispatchContext";
import { TRUCK_SIZES } from "../../types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Input } from "../ui/Input";
import * as XLSX from "xlsx";

type HistoryFilter = "all" | "delivered" | "cancelled";

// Helper: get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export const HistoryView: React.FC = () => {
  const { jobs, drivers } = useDispatch();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<HistoryFilter>("all");
  const [selectedTransporter, setSelectedTransporter] = useState<string>("all");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("30d");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Get unique warehouses
  const warehouses = useMemo(() => {
    const uniqueWarehouses = new Set<string>();
    jobs.forEach((job) => {
      if (job.warehouse) uniqueWarehouses.add(job.warehouse);
    });
    return Array.from(uniqueWarehouses).sort();
  }, [jobs]);

  // Get available weeks from completed jobs
  const availableWeeks = useMemo(() => {
    const weekSet = new Map<string, string>(); // value -> label
    jobs
      .filter((j) => j.status === "delivered" || j.status === "cancelled")
      .forEach((job) => {
        const date = new Date(job.actualDeliveryAt || job.updatedAt);
        const weekNum = getWeekNumber(date);
        const year = date.getFullYear();
        const value = `${year}-W${String(weekNum).padStart(2, "0")}`;
        const label = `Week ${weekNum}, ${year}`;
        weekSet.set(value, label);
      });
    return Array.from(weekSet.entries())
      .sort((a, b) => b[0].localeCompare(a[0])) // newest first
      .map(([value, label]) => ({ value, label }));
  }, [jobs]);

  // Filter completed/cancelled jobs
  const completedJobs = useMemo(() => {
    let filtered = jobs.filter(
      (job) => job.status === "delivered" || job.status === "cancelled"
    );

    // Status filter
    if (statusFilter === "delivered") {
      filtered = filtered.filter((job) => job.status === "delivered");
    } else if (statusFilter === "cancelled") {
      filtered = filtered.filter((job) => job.status === "cancelled");
    }

    // Transporter filter
    if (selectedTransporter !== "all") {
      filtered = filtered.filter((job) => job.driverId === selectedTransporter);
    }

    // Warehouse filter
    if (selectedWarehouse !== "all") {
      filtered = filtered.filter((job) => job.warehouse === selectedWarehouse);
    }

    // Week filter
    if (selectedWeek !== "all") {
      filtered = filtered.filter((job) => {
        const date = new Date(job.actualDeliveryAt || job.updatedAt);
        const weekNum = getWeekNumber(date);
        const year = date.getFullYear();
        const jobWeek = `${year}-W${String(weekNum).padStart(2, "0")}`;
        return jobWeek === selectedWeek;
      });
    }

    // Date filter (only when week filter is not active)
    if (selectedWeek === "all") {
      const now = new Date();
      if (dateFilter === "custom" && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        filtered = filtered.filter((job) => {
          const completedDate = new Date(job.actualDeliveryAt || job.updatedAt);
          return completedDate >= start && completedDate <= end;
        });
      } else if (dateFilter !== "all") {
        let daysBack = 0;
        if (dateFilter === "7d") daysBack = 7;
        else if (dateFilter === "30d") daysBack = 30;
        else if (dateFilter === "90d") daysBack = 90;

        if (daysBack > 0) {
          const cutoffDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
          filtered = filtered.filter((job) => {
            const completedDate = new Date(job.actualDeliveryAt || job.updatedAt);
            return completedDate >= cutoffDate;
          });
        }
      }
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((job) => {
        const searchableText = [
          job.ref,
          job.customer,
          job.pickup,
          job.dropoff,
          job.warehouse || "",
          job.notes || "",
        ]
          .join(" ")
          .toLowerCase();
        return searchableText.includes(query);
      });
    }

    // Sort by completion date (most recent first)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.actualDeliveryAt || a.updatedAt).getTime();
      const dateB = new Date(b.actualDeliveryAt || b.updatedAt).getTime();
      return dateB - dateA;
    });
  }, [
    jobs,
    statusFilter,
    selectedTransporter,
    selectedWarehouse,
    selectedWeek,
    dateFilter,
    startDate,
    endDate,
    searchQuery,
  ]);

  // Calculate statistics
  const stats = useMemo(() => {
    const delivered = completedJobs.filter((j) => j.status === "delivered").length;
    const cancelled = completedJobs.filter((j) => j.status === "cancelled").length;
    const total = completedJobs.length;
    const successRate = total > 0 ? Math.round((delivered / total) * 100) : 0;

    const totalPallets = completedJobs.reduce((sum, job) => sum + (job.pallets || 0), 0);

    const deliveredWithDates = completedJobs.filter(
      (j) => j.status === "delivered" && j.actualDeliveryAt
    );
    let avgDeliveryTime = 0;
    if (deliveredWithDates.length > 0) {
      const totalHours = deliveredWithDates.reduce((sum, job) => {
        const created = new Date(job.createdAt).getTime();
        const deliveredAt = new Date(job.actualDeliveryAt!).getTime();
        return sum + (deliveredAt - created) / (1000 * 60 * 60);
      }, 0);
      avgDeliveryTime = Math.round(totalHours / deliveredWithDates.length);
    }

    return {
      total,
      delivered,
      cancelled,
      successRate,
      totalPallets,
      avgDeliveryTime,
    };
  }, [completedJobs]);

  const getTruckSizeLabel = (size?: string) => {
    if (!size) return "—";
    return TRUCK_SIZES.find((ts) => ts.value === size)?.label || size;
  };

  // Export to Excel
  const exportToExcel = () => {
    const data = completedJobs.map((job) => {
      const completedDate = new Date(job.actualDeliveryAt || job.updatedAt);
      return {
        Reference: job.ref,
        Customer: job.customer,
        Status: job.status,
        Priority: job.priority,
        Pickup: job.pickup,
        Dropoff: job.dropoff,
        Warehouse: job.warehouse || "N/A",
        Transporter: job.driverId
          ? drivers.find((d) => d.id === job.driverId)?.name || "Unknown"
          : "Unassigned",
        "Truck Size": getTruckSizeLabel(job.truckSize),
        Pallets: job.pallets || 0,
        "Outstanding Qty": job.outstandingQty || 0,
        "Line Items": job.notes || "",
        "Week Number": `W${getWeekNumber(completedDate)}`,
        "Created Date": new Date(job.createdAt).toLocaleString(),
        "Completed Date": completedDate.toLocaleString(),
        ETA: job.eta || "N/A",
      };
    });

    const weekSuffix = selectedWeek !== "all" ? `-${selectedWeek}` : "";
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "History");
    XLSX.writeFile(workbook, `job-history${weekSuffix}-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const weekLabel = selectedWeek !== "all"
      ? availableWeeks.find((w) => w.value === selectedWeek)?.label || selectedWeek
      : "All Weeks";
    const reportDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

    // --- Header ---
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 28, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("K58 Dispatch — Job History Report", 14, 12);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${weekLabel}  |  Generated: ${reportDate}`, 14, 20);

    // --- Summary Cards ---
    const cardY = 34;
    const cardW = (pageWidth - 28 - 25) / 6; // 6 cards with gaps
    const cards = [
      { label: "Total Jobs", value: String(stats.total), color: [37, 99, 235] },
      { label: "Delivered", value: String(stats.delivered), color: [22, 163, 74] },
      { label: "Cancelled", value: String(stats.cancelled), color: [220, 38, 38] },
      { label: "Success Rate", value: `${stats.successRate}%`, color: [147, 51, 234] },
      { label: "Total Pallets", value: String(stats.totalPallets), color: [234, 88, 12] },
      { label: "Avg Delivery", value: `${stats.avgDeliveryTime}h`, color: [79, 70, 229] },
    ];

    cards.forEach((card, i) => {
      const x = 14 + i * (cardW + 5);
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(x, cardY, cardW, 20, 2, 2, "F");
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.roundedRect(x, cardY, cardW, 20, 2, 2, "S");
      doc.setTextColor(card.color[0], card.color[1], card.color[2]);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(card.value, x + cardW / 2, cardY + 10, { align: "center" });
      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(card.label.toUpperCase(), x + cardW / 2, cardY + 16, { align: "center" });
    });

    // --- Table ---
    const tableData = completedJobs.map((job) => {
      const completedDate = new Date(job.actualDeliveryAt || job.updatedAt);
      return [
        job.ref,
        job.customer,
        job.status === "delivered" ? "Delivered" : "Cancelled",
        `${job.pickup} → ${job.dropoff}`,
        job.warehouse || "—",
        job.driverId ? drivers.find((d) => d.id === job.driverId)?.name || "Unknown" : "Unassigned",
        getTruckSizeLabel(job.truckSize),
        String(job.pallets || 0),
        job.notes || "—",
        `W${getWeekNumber(completedDate)}`,
        completedDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      ];
    });

    autoTable(doc, {
      startY: cardY + 28,
      head: [["Reference", "Customer", "Status", "Route", "Warehouse", "Transporter", "Truck Size", "Pallets", "Line Items", "Week", "Completed"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7,
        cellPadding: 3,
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 22 },    // Reference
        2: { cellWidth: 16 },    // Status
        7: { cellWidth: 14 },    // Pallets
        9: { cellWidth: 12 },    // Week
        10: { cellWidth: 22 },   // Completed
      },
      styles: {
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        overflow: "linebreak",
      },
      margin: { left: 14, right: 14 },
      didDrawPage: () => {
        // Footer on each page
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFillColor(248, 250, 252);
        doc.rect(0, pageH - 10, pageWidth, 10, "F");
        doc.setDrawColor(226, 232, 240);
        doc.line(0, pageH - 10, pageWidth, pageH - 10);
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.text("K58 Dispatch — Confidential", 14, pageH - 4);
        doc.text(
          `Page ${(doc as any).internal.getCurrentPageInfo().pageNumber}`,
          pageWidth - 14,
          pageH - 4,
          { align: "right" }
        );
      },
    });

    const weekSuffix = selectedWeek !== "all" ? `-${selectedWeek}` : "";
    doc.save(`dispatch-report${weekSuffix}-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const getDriverName = (driverId?: string) => {
    if (!driverId) return "Unassigned";
    return drivers.find((d) => d.id === driverId)?.name || "Unknown";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Clock className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Job History</h1>
              {selectedWeek !== "all" && (
                <span className="ml-2 inline-flex items-center px-3 py-1 rounded-lg bg-blue-100 text-blue-700 text-sm font-semibold">
                  {availableWeeks.find((w) => w.value === selectedWeek)?.label}
                </span>
              )}
            </div>
            <p className="text-gray-600">View completed and cancelled jobs with detailed tracking</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={exportToPDF} className="gap-2 bg-slate-800 hover:bg-slate-900">
              <FileText className="h-4 w-4" />
              Export PDF
            </Button>
            <Button onClick={exportToExcel} className="gap-2">
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </div>
      </Card>

      {/* Week Number Banner */}
      {selectedWeek !== "all" && (
        <Card className="p-5 border-l-4 border-l-blue-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-xl">
                  W{selectedWeek.split("-W")[1]}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {availableWeeks.find((w) => w.value === selectedWeek)?.label}
                </h2>
                <p className="text-sm text-gray-500">
                  Viewing {stats.total} completed {stats.total === 1 ? "job" : "jobs"} for this week
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedWeek("all")}
              className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Clear filter
            </button>
          </div>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-xs text-gray-600">Total Jobs</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
              <div className="text-xs text-gray-600">Delivered</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-100 p-2">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
              <div className="text-xs text-gray-600">Cancelled</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <CalendarIcon className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">{stats.successRate}%</div>
              <div className="text-xs text-gray-600">Success Rate</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2">
              <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">{stats.totalPallets}</div>
              <div className="text-xs text-gray-600">Total Pallets</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-100 p-2">
              <Clock className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-indigo-600">{stats.avgDeliveryTime}h</div>
              <div className="text-xs text-gray-600">Avg Delivery</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-600" />
            <CardTitle>Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="mb-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <Search className="h-5 w-5 text-gray-500" />
              <input
                type="text"
                placeholder="Search by reference, customer, location..."
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
          </div>

          {/* Filter Controls */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as HistoryFilter)}
                className="w-full"
              >
                <option value="all">All</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Transporter</label>
              <Select
                value={selectedTransporter}
                onChange={(e) => setSelectedTransporter(e.target.value)}
                className="w-full"
              >
                <option value="all">All Transporters</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Warehouse</label>
              <Select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="w-full"
              >
                <option value="all">All Warehouses</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse} value={warehouse}>
                    {warehouse}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Week Number</label>
              <Select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="w-full"
              >
                <option value="all">All Weeks</option>
                {availableWeeks.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <Select
                value={selectedWeek !== "all" ? "all" : dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full"
                disabled={selectedWeek !== "all"}
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="all">All Time</option>
                <option value="custom">Custom Range</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">&nbsp;</label>
              <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 border border-gray-200">
                Showing <span className="font-semibold text-gray-900">{completedJobs.length}</span>{" "}
                jobs
              </div>
            </div>
          </div>

          {/* Custom Date Range */}
          {dateFilter === "custom" && selectedWeek === "all" && (
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Completed Jobs History
            {selectedWeek !== "all" && (
              <span className="ml-2 text-sm font-normal text-blue-600">
                — {availableWeeks.find((w) => w.value === selectedWeek)?.label}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-3 font-semibold text-gray-700">Reference</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Customer</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Status</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Route</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Warehouse</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Transporter</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Truck Size</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Pallets</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Line Items</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Week</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Completed</th>
                </tr>
              </thead>
              <tbody>
                {completedJobs.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-gray-500">
                      No completed jobs found matching your filters
                    </td>
                  </tr>
                ) : (
                  completedJobs.map((job) => {
                    const completedDate = new Date(job.actualDeliveryAt || job.updatedAt);
                    return (
                      <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">{job.ref}</td>
                        <td className="p-3 text-gray-700">{job.customer}</td>
                        <td className="p-3">
                          <Badge variant={job.status === "delivered" ? "success" : "destructive"}>
                            {job.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-gray-700 text-xs">
                          <div>{job.pickup}</div>
                          <div className="text-gray-400">→ {job.dropoff}</div>
                        </td>
                        <td className="p-3 text-gray-700 text-xs">{job.warehouse || "—"}</td>
                        <td className="p-3 text-gray-700">{getDriverName(job.driverId)}</td>
                        <td className="p-3 text-gray-700 text-xs">{getTruckSizeLabel(job.truckSize)}</td>
                        <td className="p-3 text-gray-700">
                          {job.pallets || 0}
                          {job.outstandingQty && (
                            <div className="text-xs text-orange-600">Out: {job.outstandingQty}</div>
                          )}
                        </td>
                        <td className="p-3 text-gray-700 text-xs max-w-[200px]">
                          <span className="truncate block" title={job.notes || "—"}>{job.notes || "—"}</span>
                        </td>
                        <td className="p-3 text-gray-700">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            W{getWeekNumber(completedDate)}
                          </span>
                        </td>
                        <td className="p-3 text-gray-600 text-xs">
                          {formatDate(job.actualDeliveryAt || job.updatedAt)}
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
