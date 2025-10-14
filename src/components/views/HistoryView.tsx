// src/components/views/HistoryView.tsx
import React, { useMemo, useState } from "react";
import { Clock, Search, Filter, Download, Calendar as CalendarIcon, CheckCircle2, XCircle } from "lucide-react";
import { useDispatch } from "../../context/DispatchContext";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Input } from "../ui/Input";
import { Job } from "../../types";
import * as XLSX from "xlsx";

type HistoryFilter = "all" | "delivered" | "cancelled";

export const HistoryView: React.FC = () => {
  const { jobs, drivers } = useDispatch();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<HistoryFilter>("all");
  const [selectedTransporter, setSelectedTransporter] = useState<string>("all");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
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

    // Date filter
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

    // Calculate average delivery time (for delivered jobs)
    const deliveredWithDates = completedJobs.filter(
      (j) => j.status === "delivered" && j.actualDeliveryAt
    );
    let avgDeliveryTime = 0;
    if (deliveredWithDates.length > 0) {
      const totalHours = deliveredWithDates.reduce((sum, job) => {
        const created = new Date(job.createdAt).getTime();
        const delivered = new Date(job.actualDeliveryAt!).getTime();
        return sum + (delivered - created) / (1000 * 60 * 60);
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

  // Export to Excel
  const exportToExcel = () => {
    const data = completedJobs.map((job) => ({
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
      Pallets: job.pallets || 0,
      "Outstanding Qty": job.outstandingQty || 0,
      "Created Date": new Date(job.createdAt).toLocaleString(),
      "Completed Date": job.actualDeliveryAt
        ? new Date(job.actualDeliveryAt).toLocaleString()
        : new Date(job.updatedAt).toLocaleString(),
      ETA: job.eta || "N/A",
      Notes: job.notes || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "History");
    XLSX.writeFile(workbook, `job-history-${new Date().toISOString().split("T")[0]}.xlsx`);
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
            </div>
            <p className="text-gray-600">View completed and cancelled jobs with detailed tracking</p>
          </div>
          <Button onClick={exportToExcel} className="gap-2">
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      </Card>

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
              <svg
                className="h-5 w-5 text-orange-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <Select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full"
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
          {dateFilter === "custom" && (
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
          <CardTitle>Completed Jobs History</CardTitle>
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
                  <th className="text-left p-3 font-semibold text-gray-700">Pallets</th>
                  <th className="text-left p-3 font-semibold text-gray-700">Completed</th>
                </tr>
              </thead>
              <tbody>
                {completedJobs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-500">
                      No completed jobs found matching your filters
                    </td>
                  </tr>
                ) : (
                  completedJobs.map((job) => (
                    <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-900">{job.ref}</td>
                      <td className="p-3 text-gray-700">{job.customer}</td>
                      <td className="p-3">
                        <Badge
                          variant={job.status === "delivered" ? "success" : "destructive"}
                        >
                          {job.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-gray-700 text-xs">
                        <div>{job.pickup}</div>
                        <div className="text-gray-400">→ {job.dropoff}</div>
                      </td>
                      <td className="p-3 text-gray-700 text-xs">{job.warehouse || "—"}</td>
                      <td className="p-3 text-gray-700">{getDriverName(job.driverId)}</td>
                      <td className="p-3 text-gray-700">
                        {job.pallets || 0}
                        {job.outstandingQty && (
                          <div className="text-xs text-orange-600">Out: {job.outstandingQty}</div>
                        )}
                      </td>
                      <td className="p-3 text-gray-600 text-xs">
                        {formatDate(job.actualDeliveryAt || job.updatedAt)}
                      </td>
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
