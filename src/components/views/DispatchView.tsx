// src/components/views/DispatchView.tsx
import { useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Truck, Briefcase, Plus, X, Save, ChevronLeft, ChevronRight, AlertTriangle, Bell, PackageCheck, FileCheck2 } from "lucide-react";

import { useDispatch } from "../../context/DispatchContext";
import { useNotification } from "../../context/NotificationContext";
import { filterJobs, sortJobs } from "../../utils/helpers";

import { FilterBar } from "../FilterBar";
import { SortBar } from "../SortBar";
import { JobCard } from "../JobCard";
import { DriverCard } from "../DriverCard";
import { JobDetailsModal } from "../JobDetailsModal";
import { TransporterDetailsModal } from "../TransporterDetailsModal";
import { AddDriverModal } from "../AddDriverModal";
import { WarehouseSelector } from "../WarehouseSelector";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";

import type { Job, Driver, JobPriority, JobStatus } from "../../types";

interface DispatchViewProps {
  onOpenAlerts?: () => void;
}

export const DispatchView: React.FC<DispatchViewProps> = ({ onOpenAlerts }) => {
  const { jobs, drivers, updateJob, updateDriver, addDriver, refreshData, filters, sortOptions } = useDispatch();
  const { showSuccess, showError, showWarning, confirm } = useNotification();

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [selectedTransporter, setSelectedTransporter] = useState<Driver | null>(null);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [showAddJob, setShowAddJob] = useState(false);
  const [selectedAlertDate, setSelectedAlertDate] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"open" | "assigned" | "delivered">("open");
  const [showPickedOnly, setShowPickedOnly] = useState(false);
  const [showOutstandingCoaOnly, setShowOutstandingCoaOnly] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<"delivery" | "collection" | null>(null);
  const [newJob, setNewJob] = useState({
    ref: "",
    customer: "",
    pickup: "K58 Warehouse",
    dropoff: "TBD",
    warehouse: "",
    serviceType: "delivery" as "collection" | "delivery",
    priority: "normal" as JobPriority,
    pallets: undefined as number | undefined,
    outstandingQty: undefined as number | undefined,
    eta: "",
    notes: "",
  });

  // Filter to show only customer order jobs, deduplicated by ASO ref,
  // and only orders due within current week + 4 weeks
  const orderJobs = useMemo(() => {
    const allOrders = jobs.filter((job) => job.jobType === "order" || job.jobType === undefined);

    // Deduplicate by ref (ASO number) - keep the first occurrence per ref
    // and aggregate data from duplicate line items
    const refMap = new Map<string, Job>();
    allOrders.forEach((job) => {
      const existing = refMap.get(job.ref);
      if (!existing) {
        refMap.set(job.ref, { ...job });
      } else {
        // Merge: keep earliest ETA, sum pallets/qty, preserve status if more progressed
        if (job.eta && (!existing.eta || job.eta < existing.eta)) {
          existing.eta = job.eta;
        }
        if (job.pallets) {
          existing.pallets = (existing.pallets || 0) + job.pallets;
        }
        if (job.outstandingQty) {
          existing.outstandingQty = (existing.outstandingQty || 0) + job.outstandingQty;
        }
      }
    });

    // Filter to current week + 4 weeks by ETA
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfRange = new Date(startOfWeek);
    endOfRange.setDate(endOfRange.getDate() + 5 * 7); // 5 weeks total (current + 4)
    endOfRange.setHours(23, 59, 59, 999);

    return Array.from(refMap.values()).filter((job) => {
      // Always show jobs without ETA (so they don't disappear)
      if (!job.eta) return true;
      const etaDate = new Date(job.eta);
      return etaDate >= startOfWeek && etaDate <= endOfRange;
    });
  }, [jobs]);

  const filteredAndSortedJobs = useMemo(() => {
    const filtered = filterJobs(orderJobs, filters);
    const sorted = sortJobs(filtered, sortOptions);

    // Apply tab filter
    return sorted.filter((job) => {
      const isPendingOrAssigned = job.status === "pending" || job.status === "assigned" || job.status === "exception";

      // When "Orders Picked" card is active, show only picked orders that are pending/assigned
      if (showPickedOnly) {
        return !!job.orderPicked && isPendingOrAssigned;
      }

      // When "Outstanding COA" card is active, show picked orders missing COA
      if (showOutstandingCoaOnly) {
        return !!job.orderPicked && !job.coaAvailable && isPendingOrAssigned;
      }

      // When service type filter is active
      if (serviceFilter === "delivery") {
        return job.serviceType === "delivery" || !job.serviceType;
      }
      if (serviceFilter === "collection") {
        return job.serviceType === "collection";
      }

      switch (activeTab) {
        case "open":
          return job.status === "pending" || job.status === "exception";
        case "assigned":
          return job.status === "assigned" || job.status === "en-route";
        case "delivered":
          return job.status === "delivered" || job.status === "cancelled";
        default:
          return true;
      }
    });
  }, [orderJobs, filters, sortOptions, activeTab, showPickedOnly, showOutstandingCoaOnly, serviceFilter]);

  // Tab counts (unfiltered by search/filters, so tabs always show totals)
  const tabCounts = useMemo(() => ({
    open: orderJobs.filter((j) => j.status === "pending" || j.status === "exception").length,
    assigned: orderJobs.filter((j) => j.status === "assigned" || j.status === "en-route").length,
    delivered: orderJobs.filter((j) => j.status === "delivered" || j.status === "cancelled").length,
  }), [orderJobs]);

  const stats = useMemo(() => {
    return {
      total: orderJobs.length,
      pending: orderJobs.filter((j) => j.status === "pending").length,
      inRoute: orderJobs.filter((j) => j.status === "en-route").length,
      delivered: orderJobs.filter((j) => j.status === "delivered").length,
      exceptions: orderJobs.filter((j) => j.status === "exception").length,
      picked: orderJobs.filter((j) => j.orderPicked && (j.status === "pending" || j.status === "assigned" || j.status === "exception")).length,
      outstandingCoa: orderJobs.filter((j) => j.orderPicked && !j.coaAvailable && (j.status === "pending" || j.status === "assigned" || j.status === "exception")).length,
      delivery: orderJobs.filter((j) => j.serviceType === "delivery" || !j.serviceType).length,
      collection: orderJobs.filter((j) => j.serviceType === "collection").length,
    };
  }, [orderJobs, drivers]);

  // Compute assigned pallets per driver (from ALL jobs, not just deduplicated)
  const palletsByDriver = useMemo(() => {
    const map: Record<string, number> = {};
    jobs.forEach((job) => {
      if (job.driverId && job.status !== "delivered" && job.status !== "cancelled") {
        map[job.driverId] = (map[job.driverId] || 0) + (job.pallets || 0);
      }
    });
    return map;
  }, [jobs]);

  // Pagination
  const ITEMS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(filteredAndSortedJobs.length / ITEMS_PER_PAGE);
  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedJobs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAndSortedJobs, currentPage]);

  // Reset to page 1 when filters change
  const prevFilterKey = useMemo(() => JSON.stringify(filters), [filters]);
  useMemo(() => { setCurrentPage(1); }, [prevFilterKey]);

  // Alert: dates with 5+ orders (including IBT) due
  const busyDateAlerts = useMemo(() => {
    const dateCounts: { [date: string]: { orders: number; ibts: number } } = {};
    // Count ALL jobs (orders + IBT) by ETA date
    jobs.forEach((job) => {
      if (!job.eta) return;
      const dateKey = job.eta.split("T")[0]; // normalize to YYYY-MM-DD
      if (!dateCounts[dateKey]) dateCounts[dateKey] = { orders: 0, ibts: 0 };
      if (job.jobType === "ibt") {
        dateCounts[dateKey].ibts++;
      } else {
        dateCounts[dateKey].orders++;
      }
    });
    // Return dates with 5+ total
    return Object.entries(dateCounts)
      .filter(([, counts]) => counts.orders + counts.ibts >= 5)
      .map(([date, counts]) => ({ date, total: counts.orders + counts.ibts, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [jobs]);

  // Jobs due on selected alert date (all jobs, not deduplicated - show full detail)
  const alertDateJobs = useMemo(() => {
    if (!selectedAlertDate) return [];
    return jobs.filter((job) => {
      if (!job.eta) return false;
      return job.eta.split("T")[0] === selectedAlertDate;
    }).sort((a, b) => {
      // Orders first, then IBT
      if (a.jobType !== b.jobType) return a.jobType === "ibt" ? 1 : -1;
      return (a.ref || "").localeCompare(b.ref || "");
    });
  }, [jobs, selectedAlertDate]);

  // Get unique warehouses from all jobs
  const warehouses = useMemo(() => {
    const warehouseSet = new Set<string>();
    jobs.forEach((job) => {
      if (job.warehouse) {
        warehouseSet.add(job.warehouse);
      }
    });
    return Array.from(warehouseSet).sort();
  }, [jobs]);

  const handleDragStart = (event: DragStartEvent) => {
    const job = orderJobs.find((j) => j.id === event.active.id);
    setActiveJob(job || null);
  };

  const assignJobToDriver = async (job: Job, driver: Driver) => {
    const jobPallets = job.pallets || 0;
    const currentLoad = palletsByDriver[driver.id] || 0;
    const newLoad = currentLoad + jobPallets;
    const capacity = driver.capacity || 0;

    if (capacity > 0 && newLoad > capacity) {
      const proceed = await confirm({
        title: "Capacity Warning",
        message: `${driver.name}: ${currentLoad} + ${jobPallets} = ${newLoad} pallets (capacity: ${capacity}). Exceeds by ${newLoad - capacity} pallets. Assign anyway?`,
        type: "warning",
        confirmText: "Assign Anyway",
      });
      if (!proceed) return;
    }

    // Assign ALL line items sharing this ASO ref to the transporter
    const allLineItems = jobs.filter((j) => j.ref === job.ref);
    allLineItems.forEach((lineItem) => {
      updateJob(lineItem.id, {
        driverId: driver.id,
        status: "assigned",
      });
    });
    showSuccess(`${job.ref} assigned to ${driver.name}`);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const driver = drivers.find((d) => d.id === over.id);
      const job = orderJobs.find((j) => j.id === active.id);
      if (driver && job) {
        assignJobToDriver(job, driver);
      }
    }

    setActiveJob(null);
  };

  const handleJobSelect = (job: Job) => setSelectedJob(job);

  const handleTransporterEdit = (transporter: Driver) => {
    setSelectedTransporter(transporter);
  };

  const handleTransporterSave = (id: string, updates: Partial<Driver>) => {
    updateDriver(id, updates);
  };

  const handleAddDriver = async (driverData: Omit<Driver, "id" | "assignedJobs">) => {
    const { driversAPI } = await import("../../services/api");
    const newDriver = await driversAPI.create({
      ...driverData,
      assignedJobs: 0,
    });
    addDriver(newDriver);
  };

  const getDriverName = (driverId?: string) => {
    if (!driverId) return undefined;
    return drivers.find((d) => d.id === driverId)?.name;
  };

  const handleAddJob = async () => {
    if (!newJob.ref || !newJob.customer) {
      showWarning("Reference and Customer are required");
      return;
    }

    try {
      const { jobsAPI } = await import("../../services/api");
      await jobsAPI.create({
        ref: newJob.ref,
        customer: newJob.customer,
        pickup: newJob.pickup || "K58 Warehouse",
        dropoff: newJob.dropoff || "TBD",
        warehouse: newJob.warehouse,
        priority: newJob.priority,
        status: "pending" as JobStatus,
        pallets: newJob.pallets,
        outstandingQty: newJob.outstandingQty,
        eta: newJob.eta || undefined,
        notes: newJob.notes,
        jobType: "order",
      });

      await refreshData();
      setShowAddJob(false);
      setNewJob({
        ref: "",
        customer: "",
        pickup: "K58 Warehouse",
        dropoff: "TBD",
        warehouse: "",
        serviceType: "delivery",
        priority: "normal",
        pallets: undefined,
        outstandingQty: undefined,
        eta: "",
        notes: "",
      });
    } catch (error) {
      console.error("Error creating job:", error);
      showError("Failed to create job");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Order Management</h1>
            <p className="text-gray-600">
              Manage jobs, assign transporters, and track deliveries in real-time
            </p>
          </div>
          {onOpenAlerts && (
            <button
              onClick={onOpenAlerts}
              className="relative flex items-center gap-1.5 px-4 py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
            >
              <Bell className="w-4 h-4" />
              Alerts
              {stats.exceptions > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {stats.exceptions}
                </span>
              )}
            </button>
          )}
        </div>
      </Card>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-9">
        {([
          { label: "Total Jobs", value: stats.total, color: "text-gray-900", tab: "open" as const, borderColor: "hover:border-gray-400" },
          { label: "Pending", value: stats.pending, color: "text-resilinc-warning", tab: "open" as const, borderColor: "hover:border-yellow-400" },
          { label: "En Route", value: stats.inRoute, color: "text-resilinc-primary", tab: "assigned" as const, borderColor: "hover:border-blue-400" },
          { label: "Delivered", value: stats.delivered, color: "text-green-600", tab: "delivered" as const, borderColor: "hover:border-green-400" },
          { label: "Exceptions", value: stats.exceptions, color: "text-resilinc-alert", tab: "open" as const, borderColor: "hover:border-red-400" },
        ] as const).map((stat) => (
          <Card
            key={stat.label}
            className={`p-4 transition-all cursor-pointer ${stat.borderColor} hover:shadow-md active:scale-[0.97] ${
              !showPickedOnly && !showOutstandingCoaOnly && !serviceFilter && activeTab === stat.tab ? "ring-2 ring-offset-1 ring-blue-200" : ""
            }`}
            onClick={() => { setShowPickedOnly(false); setShowOutstandingCoaOnly(false); setServiceFilter(null); setActiveTab(stat.tab); setCurrentPage(1); }}
          >
            <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-gray-600">{stat.label}</div>
          </Card>
        ))}

        {/* Delivery Card */}
        <Card
          className={`p-4 transition-all cursor-pointer hover:border-blue-400 hover:shadow-md active:scale-[0.97] ${
            serviceFilter === "delivery" ? "ring-2 ring-offset-1 ring-blue-300 border-blue-400" : ""
          }`}
          onClick={() => {
            setShowPickedOnly(false);
            setShowOutstandingCoaOnly(false);
            setServiceFilter(serviceFilter === "delivery" ? null : "delivery");
            setCurrentPage(1);
          }}
        >
          <div className="text-3xl font-bold text-blue-600">{stats.delivery}</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-gray-600">Delivery</div>
        </Card>

        {/* Collection (Ex Works) Card */}
        <Card
          className={`p-4 transition-all cursor-pointer hover:border-purple-400 hover:shadow-md active:scale-[0.97] ${
            serviceFilter === "collection" ? "ring-2 ring-offset-1 ring-purple-300 border-purple-400" : ""
          }`}
          onClick={() => {
            setShowPickedOnly(false);
            setShowOutstandingCoaOnly(false);
            setServiceFilter(serviceFilter === "collection" ? null : "collection");
            setCurrentPage(1);
          }}
        >
          <div className="text-3xl font-bold text-purple-700">{stats.collection}</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-gray-600">Collection</div>
        </Card>

        {/* Orders Picked Card */}
        <Card
          className={`p-4 transition-all cursor-pointer hover:border-purple-400 hover:shadow-md active:scale-[0.97] ${
            showPickedOnly ? "ring-2 ring-offset-1 ring-purple-300 border-purple-400" : ""
          }`}
          onClick={() => {
            setShowOutstandingCoaOnly(false);
            setServiceFilter(null);
            setShowPickedOnly(!showPickedOnly);
            setCurrentPage(1);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-purple-600">{stats.picked}</div>
              <div className="mt-1 text-xs uppercase tracking-wide text-gray-600">Orders Picked</div>
            </div>
            <PackageCheck className={`w-6 h-6 ${showPickedOnly ? "text-purple-600" : "text-purple-400"}`} />
          </div>
          <div className="mt-2 text-[10px] text-gray-400">
            {stats.total > 0 ? Math.round((stats.picked / stats.total) * 100) : 0}% of total
          </div>
        </Card>

        {/* Outstanding COA Card */}
        <Card
          className={`p-4 transition-all cursor-pointer hover:border-amber-400 hover:shadow-md active:scale-[0.97] ${
            showOutstandingCoaOnly ? "ring-2 ring-offset-1 ring-amber-300 border-amber-400" : ""
          }`}
          onClick={() => {
            setShowPickedOnly(false);
            setServiceFilter(null);
            setShowOutstandingCoaOnly(!showOutstandingCoaOnly);
            setCurrentPage(1);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-amber-600">{stats.outstandingCoa}</div>
              <div className="mt-1 text-xs uppercase tracking-wide text-gray-600">Outstanding COA</div>
            </div>
            <FileCheck2 className={`w-6 h-6 ${showOutstandingCoaOnly ? "text-amber-600" : "text-amber-400"}`} />
          </div>
          <div className="mt-2 text-[10px] text-gray-400">
            {stats.picked > 0 ? Math.round((stats.outstandingCoa / stats.picked) * 100) : 0}% of picked
          </div>
        </Card>
      </div>

      {/* Order Tabs */}
      <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-1.5">
        {([
          { key: "open" as const, label: "Open Orders", count: tabCounts.open, color: "text-yellow-600", dotColor: "bg-yellow-500" },
          { key: "assigned" as const, label: "Assigned / In Transit", count: tabCounts.assigned, color: "text-blue-600", dotColor: "bg-blue-500" },
          { key: "delivered" as const, label: "Delivered / Closed", count: tabCounts.delivered, color: "text-green-600", dotColor: "bg-green-500" },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${activeTab === tab.key ? "bg-white" : tab.dotColor}`} />
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              activeTab === tab.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Busy Date Alerts */}
      {busyDateAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span className="font-semibold text-amber-800">High Volume Dates</span>
            <span className="text-xs text-amber-600">5+ orders due on the same day</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {busyDateAlerts.map((alert) => (
              <button
                key={alert.date}
                onClick={() => setSelectedAlertDate(alert.date)}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 rounded-lg text-sm cursor-pointer transition-colors border border-transparent hover:border-amber-300"
              >
                <span className="font-semibold text-amber-900">{alert.date}</span>
                <span className="text-amber-700">
                  {alert.total} total ({alert.orders} orders, {alert.ibts} IBT)
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Warehouse Selector */}
      <WarehouseSelector />

      {/* Filter and Sort Controls */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <FilterBar />
          <SortBar />
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-6 lg:grid-cols-3 items-start">
          {/* Jobs List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-gray-600" />
                      <CardTitle>
                        {activeTab === "open" ? "Open Orders" : activeTab === "assigned" ? "Assigned Orders" : "Delivered Orders"} ({filteredAndSortedJobs.length})
                      </CardTitle>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      {activeTab === "open" ? "Drag jobs to transporters to assign" :
                       activeTab === "assigned" ? "Orders assigned to transporters or in transit" :
                       "Completed and closed orders"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="gap-2 bg-green-600 hover:bg-green-700"
                    onClick={() => setShowAddJob(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add Job
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <SortableContext
                  items={paginatedJobs.map((j) => j.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {filteredAndSortedJobs.length === 0 ? (
                      <div className="py-12 text-center text-gray-500">
                        No jobs found matching your filters
                      </div>
                    ) : (
                      paginatedJobs.map((job) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          onSelect={() => handleJobSelect(job)}
                        />
                      ))
                    )}
                  </div>
                </SortableContext>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                    <span className="text-sm text-gray-500">
                      Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedJobs.length)} of {filteredAndSortedJobs.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                              currentPage === page
                                ? "bg-blue-600 text-white"
                                : "text-gray-600 hover:bg-gray-100"
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Transporters List - sticky so it stays visible while scrolling jobs */}
          <div className="lg:col-span-1 lg:sticky lg:top-8" style={{ maxHeight: "calc(100vh - 4rem)", overflowY: "auto" }}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Truck className="h-5 w-5 text-gray-600" />
                      <CardTitle>Transporters ({drivers.length})</CardTitle>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">Drop jobs here to assign</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => setShowAddDriver(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-2">
                  {drivers.length === 0 ? (
                    <div className="py-12 text-center text-gray-500">No transporters available</div>
                  ) : (
                    drivers.map((driver) => (
                      <DriverCard
                        key={driver.id}
                        driver={driver}
                        onEdit={handleTransporterEdit}
                        assignedPallets={palletsByDriver[driver.id] || 0}
                      />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeJob ? (
            <div className="rounded-card border bg-white p-3 shadow-lg opacity-90">
              <p className="font-medium">{activeJob.ref}</p>
              <p className="text-xs text-gray-500">{activeJob.customer}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Date Drill-Down Modal */}
      {selectedAlertDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedAlertDate(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-amber-50">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  Orders Due: {selectedAlertDate}
                </h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  {alertDateJobs.length} orders due on this date
                </p>
              </div>
              <button
                onClick={() => setSelectedAlertDate(null)}
                className="p-2 hover:bg-amber-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(85vh-80px)]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-semibold text-gray-700">Reference</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Type</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Customer</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Status</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Route</th>
                    <th className="text-right p-3 font-semibold text-gray-700">Pallets</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Transporter</th>
                  </tr>
                </thead>
                <tbody>
                  {alertDateJobs.map((job) => (
                    <tr
                      key={job.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => { setSelectedAlertDate(null); setSelectedJob(job); }}
                    >
                      <td className="p-3 font-medium text-gray-900">{job.ref}</td>
                      <td className="p-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          job.jobType === "ibt" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {job.jobType === "ibt" ? "IBT" : "ORDER"}
                        </span>
                      </td>
                      <td className="p-3 text-gray-700">{job.customer}</td>
                      <td className="p-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          job.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                          job.status === "assigned" ? "bg-blue-100 text-blue-700" :
                          job.status === "en-route" ? "bg-indigo-100 text-indigo-700" :
                          job.status === "delivered" ? "bg-green-100 text-green-700" :
                          job.status === "exception" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-700 text-xs">{job.pickup} → {job.dropoff}</td>
                      <td className="p-3 text-right font-medium">{job.pallets ?? "—"}</td>
                      <td className="p-3 text-gray-700">
                        {job.driverId ? drivers.find((d) => d.id === job.driverId)?.name : "Unassigned"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Job Details Modal */}
      {selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          driverName={getDriverName(selectedJob.driverId)}
        />
      )}

      {/* Transporter Details Modal */}
      {selectedTransporter && (
        <TransporterDetailsModal
          transporter={selectedTransporter}
          onClose={() => setSelectedTransporter(null)}
          onSave={handleTransporterSave}
        />
      )}

      {/* Add Driver Modal */}
      {showAddDriver && (
        <AddDriverModal
          onClose={() => setShowAddDriver(false)}
          onSave={handleAddDriver}
        />
      )}

      {/* Add Job Modal */}
      {showAddJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Add Job Manually</h2>
                <button
                  onClick={() => setShowAddJob(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Reference */}
                <div>
                  <label htmlFor="job-ref" className="block text-sm font-medium text-gray-700 mb-2">
                    Reference / Order No <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="job-ref"
                    type="text"
                    value={newJob.ref}
                    onChange={(e) => setNewJob({ ...newJob, ref: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="SO-0001"
                    required
                  />
                </div>

                {/* Customer */}
                <div>
                  <label htmlFor="job-customer" className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="job-customer"
                    type="text"
                    value={newJob.customer}
                    onChange={(e) => setNewJob({ ...newJob, customer: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Customer Name"
                    required
                  />
                </div>

                {/* Warehouse */}
                <div>
                  <label htmlFor="job-warehouse" className="block text-sm font-medium text-gray-700 mb-2">
                    Warehouse / Pickup
                  </label>
                  <select
                    id="job-warehouse"
                    value={newJob.warehouse}
                    onChange={(e) => setNewJob({ ...newJob, warehouse: e.target.value, pickup: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select Warehouse</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse} value={warehouse}>
                        {warehouse}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Service Type */}
                <div>
                  <label htmlFor="job-service-type" className="block text-sm font-medium text-gray-700 mb-2">
                    Service Type
                  </label>
                  <select
                    id="job-service-type"
                    value={newJob.serviceType}
                    onChange={(e) => setNewJob({ ...newJob, serviceType: e.target.value as "collection" | "delivery" })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="delivery">Delivery</option>
                    <option value="collection">Collection</option>
                  </select>
                </div>

                {/* Dropoff */}
                <div>
                  <label htmlFor="job-dropoff" className="block text-sm font-medium text-gray-700 mb-2">
                    Dropoff / Delivery Address
                  </label>
                  <input
                    id="job-dropoff"
                    type="text"
                    value={newJob.dropoff}
                    onChange={(e) => setNewJob({ ...newJob, dropoff: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Delivery address"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label htmlFor="job-priority" className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    id="job-priority"
                    value={newJob.priority}
                    onChange={(e) => setNewJob({ ...newJob, priority: e.target.value as JobPriority })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </div>

                {/* ETA */}
                <div>
                  <label htmlFor="job-eta" className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Date (ETA)
                  </label>
                  <input
                    id="job-eta"
                    type="date"
                    value={newJob.eta}
                    onChange={(e) => setNewJob({ ...newJob, eta: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Pallets */}
                <div>
                  <label htmlFor="job-pallets" className="block text-sm font-medium text-gray-700 mb-2">
                    Pallets
                  </label>
                  <input
                    id="job-pallets"
                    type="number"
                    value={newJob.pallets || ""}
                    onChange={(e) => setNewJob({ ...newJob, pallets: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                  />
                </div>

                {/* Outstanding Qty */}
                <div>
                  <label htmlFor="job-qty" className="block text-sm font-medium text-gray-700 mb-2">
                    Outstanding Qty
                  </label>
                  <input
                    id="job-qty"
                    type="number"
                    value={newJob.outstandingQty || ""}
                    onChange={(e) => setNewJob({ ...newJob, outstandingQty: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                  />
                </div>

                {/* Notes - Full Width */}
                <div className="col-span-2">
                  <label htmlFor="job-notes" className="block text-sm font-medium text-gray-700 mb-2">
                    Notes / Description
                  </label>
                  <textarea
                    id="job-notes"
                    value={newJob.notes}
                    onChange={(e) => setNewJob({ ...newJob, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Additional notes or item description"
                    rows={3}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 mt-6">
                <Button onClick={handleAddJob} className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700">
                  <Save className="w-4 h-4" />
                  Add Job
                </Button>
                <Button
                  type="button"
                  onClick={() => setShowAddJob(false)}
                  className="flex-1 bg-gray-200 text-gray-800 hover:bg-gray-300"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
