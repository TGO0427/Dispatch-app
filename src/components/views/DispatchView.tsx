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
import { Truck, Briefcase, Plus } from "lucide-react";

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

import type { Job, Driver } from "../../types";

export const DispatchView: React.FC = () => {
  const { jobs, drivers, updateJob, updateDriver, addDriver, filters, sortOptions } = useDispatch();

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [selectedTransporter, setSelectedTransporter] = useState<Driver | null>(null);
  const [showAddDriver, setShowAddDriver] = useState(false);

  const filteredAndSortedJobs = useMemo(() => {
    const filtered = filterJobs(jobs, filters);
    return sortJobs(filtered, sortOptions);
  }, [jobs, filters, sortOptions]);

  const stats = useMemo(() => {
    return {
      total: jobs.length,
      pending: jobs.filter((j) => j.status === "pending").length,
      inRoute: jobs.filter((j) => j.status === "en-route").length, // ✅ your union
      delivered: jobs.filter((j) => j.status === "delivered").length, // ✅ your union
      exceptions: jobs.filter((j) => j.status === "exception").length,
      availableDrivers: drivers.filter((d) => d.status === "available").length,
      busyDrivers: drivers.filter((d) => d.status === "busy").length,
    };
  }, [jobs, drivers]);

  const handleDragStart = (event: DragStartEvent) => {
    const job = jobs.find((j) => j.id === event.active.id);
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
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-gray-600" />
                  <CardTitle>Jobs ({filteredAndSortedJobs.length})</CardTitle>
                </div>
                <p className="mt-1 text-sm text-gray-600">Drag jobs to transporters to assign</p>
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
    </div>
  );
};
