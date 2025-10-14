import React, { useState } from "react";
import { X, MapPin, User, Calendar, Package, AlertCircle, Edit2, Save } from "lucide-react";
import { Job, JobStatus, JobPriority, JOB_STATUSES, JOB_PRIORITIES } from "../types";
import { priorityTone } from "../utils/helpers";
import { useDispatch } from "../context/DispatchContext";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";

interface JobDetailsModalProps {
  job: Job;
  onClose: () => void;
  driverName?: string;
}

export const JobDetailsModal: React.FC<JobDetailsModalProps> = ({
  job,
  onClose,
  driverName,
}) => {
  const { updateJob } = useDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [editedJob, setEditedJob] = useState<Job>(job);

  const handleSave = () => {
    // Validation: if status is "exception", require exception reason
    if (editedJob.status === "exception" && !editedJob.exceptionReason?.trim()) {
      alert("Exception status requires an exception reason");
      return;
    }

    // Auto-set actualDeliveryAt when marking as delivered
    const updates: Partial<Job> = { ...editedJob };
    if (editedJob.status === "delivered" && !editedJob.actualDeliveryAt) {
      updates.actualDeliveryAt = new Date().toISOString();
    }

    // Clear exception reason if status is not "exception"
    if (editedJob.status !== "exception") {
      updates.exceptionReason = undefined;
    }

    updateJob(job.id, updates);
    setIsEditing(false);
    onClose();
  };

  const handleCancel = () => {
    setEditedJob(job); // Reset changes
    setIsEditing(false);
  };

  const updateField = <K extends keyof Job>(field: K, value: Job[K]) => {
    setEditedJob((prev) => ({ ...prev, [field]: value }));
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Job Details</CardTitle>
            <p className="text-sm text-zinc-500 mt-1">Reference: {job.ref}</p>
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button variant="ghost" size="sm" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave}>
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-4 w-4 mr-1" />
                Edit
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Status and Priority */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
              Status & Priority
            </div>
            {isEditing ? (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-zinc-500 mb-1">Status</label>
                  <select
                    value={editedJob.status}
                    onChange={(e) => updateField("status", e.target.value as JobStatus)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {JOB_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-zinc-500 mb-1">Priority</label>
                  <select
                    value={editedJob.priority}
                    onChange={(e) => updateField("priority", e.target.value as JobPriority)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {JOB_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Badge
                  variant={job.status === "exception" ? "destructive" : "secondary"}
                >
                  {job.status}
                </Badge>
                <Badge className={priorityTone(job.priority)}>
                  {job.priority} priority
                </Badge>
              </div>
            )}
          </div>

          {/* Customer */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4 text-zinc-500" />
              Customer
            </div>
            <p className="text-lg font-semibold">{job.customer}</p>
          </div>

          {/* Route */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4 text-zinc-500" />
              Route
            </div>
            <div className="space-y-2 pl-6">
              <div>
                <p className="text-xs text-zinc-500">Pickup</p>
                <p className="font-medium">{job.pickup}</p>
              </div>
              <div className="border-l-2 border-zinc-300 pl-4 ml-1">
                <p className="text-xs text-zinc-500">Dropoff</p>
                <p className="font-medium">{job.dropoff}</p>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 mb-1">
                <Package className="h-4 w-4" />
                Pallets
              </div>
              {isEditing ? (
                <input
                  type="number"
                  value={editedJob.pallets ?? ""}
                  onChange={(e) => updateField("pallets", e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Number of pallets"
                  min="0"
                />
              ) : (
                <p className="font-semibold">{job.pallets ?? "—"}</p>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 mb-1">
                <Calendar className="h-4 w-4" />
                ETA
              </div>
              {isEditing ? (
                <input
                  type="datetime-local"
                  value={editedJob.eta ? editedJob.eta.slice(0, 16) : ""}
                  onChange={(e) => updateField("eta", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="font-semibold">{job.eta ? new Date(job.eta).toLocaleString() : "—"}</p>
              )}
            </div>
          </div>

          {/* Actual Delivery Date (only show if delivered or in edit mode) */}
          {(isEditing || job.actualDeliveryAt) && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 mb-1">
                <Calendar className="h-4 w-4" />
                Actual Delivery Date
              </div>
              {isEditing ? (
                <input
                  type="datetime-local"
                  value={editedJob.actualDeliveryAt ? editedJob.actualDeliveryAt.slice(0, 16) : ""}
                  onChange={(e) => updateField("actualDeliveryAt", e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="font-semibold">
                  {job.actualDeliveryAt ? new Date(job.actualDeliveryAt).toLocaleString() : "—"}
                </p>
              )}
            </div>
          )}

          {/* Exception Reason (only show if exception or in edit mode with exception status) */}
          {(isEditing && editedJob.status === "exception") || job.exceptionReason ? (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 mb-1">
                <AlertCircle className="h-4 w-4" />
                Exception Reason
              </div>
              {isEditing ? (
                <textarea
                  value={editedJob.exceptionReason ?? ""}
                  onChange={(e) => updateField("exceptionReason", e.target.value || undefined)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Describe the exception..."
                />
              ) : (
                <p className="text-sm">{job.exceptionReason}</p>
              )}
            </div>
          ) : null}

          {/* Assigned Driver */}
          {driverName && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 mb-1">
                <User className="h-4 w-4" />
                Assigned Driver
              </div>
              <p className="font-semibold">{driverName}</p>
            </div>
          )}

          {/* Notes */}
          {(isEditing || job.notes) && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 mb-1">
                <AlertCircle className="h-4 w-4" />
                Notes
              </div>
              {isEditing ? (
                <textarea
                  value={editedJob.notes ?? ""}
                  onChange={(e) => updateField("notes", e.target.value || undefined)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Add notes about this job..."
                />
              ) : (
                <p className="text-sm">{job.notes}</p>
              )}
            </div>
          )}

          {/* Timestamps */}
          <div className="pt-4 border-t text-xs text-zinc-500 space-y-1">
            <p>Created: {job.createdAt.toLocaleString()}</p>
            <p>Updated: {job.updatedAt.toLocaleString()}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
