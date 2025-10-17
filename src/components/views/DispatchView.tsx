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
import { Truck, Briefcase, Plus, X, Save } from "lucide-react";

import { useDispatch } from "../../context/DispatchContext";
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

export const DispatchView: React.FC = () => {
  const { jobs, drivers, updateJob, updateDriver, addDriver, refreshData, filters, sortOptions } = useDispatch();

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [selectedTransporter, setSelectedTransporter] = useState<Driver | null>(null);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [showAddJob, setShowAddJob] = useState(false);
  const [newJob, setNewJob] = useState({
    ref: "",
    customer: "",
    pickup: "K58 Warehouse",
    dropoff: "TBD",
    warehouse: "",
    priority: "normal" as JobPriority,
    pallets: undefined as number | undefined,
    outstandingQty: undefined as number | undefined,
    eta: "",
    notes: "",
  });

  // Filter to show only customer order jobs (jobType === "order" or undefined for backwards compatibility)
  const orderJobs = useMemo(() => {
    return jobs.filter((job) => job.jobType === "order" || job.jobType === undefined);
  }, [jobs]);

  const filteredAndSortedJobs = useMemo(() => {
    const filtered = filterJobs(orderJobs, filters);
    return sortJobs(filtered, sortOptions);
  }, [orderJobs, filters, sortOptions]);

  const stats = useMemo(() => {
    return {
      total: orderJobs.length,
      pending: orderJobs.filter((j) => j.status === "pending").length,
      inRoute: orderJobs.filter((j) => j.status === "en-route").length,
      delivered: orderJobs.filter((j) => j.status === "delivered").length,
      exceptions: orderJobs.filter((j) => j.status === "exception").length,
      availableDrivers: drivers.filter((d) => d.status === "available").length,
      busyDrivers: drivers.filter((d) => d.status === "busy").length,
    };
  }, [orderJobs, drivers]);

  const handleDragStart = (event: DragStartEvent) => {
    const job = orderJobs.find((j) => j.id === event.active.id);
    setActiveJob(job || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const driver = drivers.find((d) => d.id === over.id);
      if (driver) {
        // Assign job to driver; also move status to "assigned" if it isn't yet
        updateJob(active.id as string, {
          driverId: driver.id,
          status: "assigned",
        });
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
      alert("Reference and Customer are required");
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
        priority: "normal",
        pallets: undefined,
        outstandingQty: undefined,
        eta: "",
        notes: "",
      });
    } catch (error) {
      console.error("Error creating job:", error);
      alert("Failed to create job");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card className="p-6">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Dispatch Dashboard</h1>
        <p className="text-gray-600">
          Manage jobs, assign transporters, and track deliveries in real-time
        </p>
      </Card>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
        <Card className="p-4">
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-gray-600">Total Jobs</div>
        </Card>

        <Card className="p-4">
          <div className="text-3xl font-bold text-resilinc-warning">{stats.pending}</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-gray-600">Pending</div>
        </Card>

        <Card className="p-4">
          <div className="text-3xl font-bold text-resilinc-primary">{stats.inRoute}</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-gray-600">En Route</div>
        </Card>

        <Card className="p-4">
          <div className="text-3xl font-bold text-green-600">{stats.delivered}</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-gray-600">Delivered</div>
        </Card>

        <Card className="p-4">
          <div className="text-3xl font-bold text-resilinc-alert">{stats.exceptions}</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-gray-600">Exceptions</div>
        </Card>

        <Card className="p-4">
          <div className="text-3xl font-bold text-green-600">{stats.availableDrivers}</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-gray-600">Available</div>
        </Card>

        <Card className="p-4">
          <div className="text-3xl font-bold text-resilinc-warning">{stats.busyDrivers}</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-gray-600">Busy</div>
        </Card>
      </div>

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
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Jobs List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-gray-600" />
                      <CardTitle>Jobs ({filteredAndSortedJobs.length})</CardTitle>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">Drag jobs to transporters to assign</p>
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
                  items={filteredAndSortedJobs.map((j) => j.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {filteredAndSortedJobs.length === 0 ? (
                      <div className="py-12 text-center text-gray-500">
                        No jobs found matching your filters
                      </div>
                    ) : (
                      filteredAndSortedJobs.map((job) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          onSelect={() => handleJobSelect(job)}
                        />
                      ))
                    )}
                  </div>
                </SortableContext>
              </CardContent>
            </Card>
          </div>

          {/* Transporters List */}
          <div className="lg:col-span-1">
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
                  <input
                    id="job-warehouse"
                    type="text"
                    value={newJob.warehouse}
                    onChange={(e) => setNewJob({ ...newJob, warehouse: e.target.value, pickup: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="K58 Warehouse"
                  />
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
