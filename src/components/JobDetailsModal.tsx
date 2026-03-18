import React, { useState, useMemo } from "react";
import { X, MapPin, User, Calendar, Package, AlertCircle, Edit2, Save, Undo2, List } from "lucide-react";
import { Job, JobStatus, JobPriority, ServiceType, JOB_STATUSES, JOB_PRIORITIES } from "../types";
import { priorityTone } from "../utils/helpers";
import { useDispatch } from "../context/DispatchContext";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/Card";
import { JobWorkflow } from "./JobWorkflow";

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
  const { updateJob, jobs } = useDispatch();
  const [isEditing, setIsEditing] = useState(false);
  const [editedJob, setEditedJob] = useState<Job>(job);

  // All line items sharing this ASO ref
  const lineItems = useMemo(() => {
    return jobs.filter((j) => j.ref === job.ref);
  }, [jobs, job.ref]);

  const hasMultipleLineItems = lineItems.length > 1;

  // Update all line items sharing the same ASO ref
  const updateAllLineItems = (updates: Partial<Job>) => {
    lineItems.forEach((lineItem) => {
      updateJob(lineItem.id, updates);
    });
  };

  // Workflow updates: propagate to all line items
  const handleWorkflowUpdate = (_jobId: string, updates: Partial<Job>) => {
    updateAllLineItems(updates);
    setEditedJob((prev) => ({ ...prev, ...updates }));
  };

  // Unassign a single line item back to pending
  const handleUnassignLineItem = (lineItemId: string) => {
    updateJob(lineItemId, { driverId: undefined, status: "pending" });
  };

  const handleSave = () => {
    // Validation: if status is "exception", require exception reason
    if (editedJob.status === "exception" && !editedJob.exceptionReason?.trim()) {
      alert("Exception status requires an exception reason");
      return;
    }

    // Validation: require all workflow steps before moving to en-route
    if (editedJob.status === "en-route" && job.status !== "en-route") {
      const allWorkflowComplete = editedJob.transporterBooked && editedJob.orderPicked && editedJob.coaAvailable;
      if (!allWorkflowComplete) {
        alert("Complete all dispatch workflow steps (Transporter Booked, Order Picked, COA Available) before moving to En Route.");
        return;
      }
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

    // Build shared updates to propagate to all line items
    const sharedUpdates: Partial<Job> = {};
    if (editedJob.status !== job.status) sharedUpdates.status = editedJob.status;
    if (editedJob.driverId !== job.driverId) sharedUpdates.driverId = editedJob.driverId;
    if (editedJob.transporterBooked !== job.transporterBooked) sharedUpdates.transporterBooked = editedJob.transporterBooked;
    if (editedJob.orderPicked !== job.orderPicked) sharedUpdates.orderPicked = editedJob.orderPicked;
    if (editedJob.coaAvailable !== job.coaAvailable) sharedUpdates.coaAvailable = editedJob.coaAvailable;
    if (editedJob.readyForDispatch !== job.readyForDispatch) sharedUpdates.readyForDispatch = editedJob.readyForDispatch;
    if (editedJob.transportService !== job.transportService) sharedUpdates.transportService = editedJob.transportService;
    if (editedJob.etd !== job.etd) sharedUpdates.etd = editedJob.etd;
    if (updates.actualDeliveryAt) sharedUpdates.actualDeliveryAt = updates.actualDeliveryAt;
    if (updates.exceptionReason !== undefined) sharedUpdates.exceptionReason = updates.exceptionReason;

    // Update the primary job with all edits
    updateJob(job.id, updates);

    // Propagate shared fields to sibling line items (only those still assigned)
    if (Object.keys(sharedUpdates).length > 0) {
      const assignedSiblings = jobs.filter((j) => j.ref === job.ref && j.id !== job.id && j.status !== "pending");
      assignedSiblings.forEach((sibling) => {
        updateJob(sibling.id, sharedUpdates);
      });
    }

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

  // Helper to format ISO string or date string to datetime-local format
  const formatDatetimeLocal = (dateString?: string): string => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      // Check if valid date
      if (isNaN(date.getTime())) return "";
      // Format to YYYY-MM-DDTHH:mm
      return date.toISOString().slice(0, 16);
    } catch {
      return "";
    }
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

          {/* Workflow Tracking */}
          <div className="pt-4 border-t">
            <JobWorkflow
              job={editedJob}
              onUpdate={handleWorkflowUpdate}
            />
          </div>

          {/* Service Type */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
              Service Type
            </div>
            {isEditing ? (
              <select
                value={editedJob.serviceType || "delivery"}
                onChange={(e) => updateField("serviceType", e.target.value as ServiceType)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="delivery">Delivery — We arrange transport</option>
                <option value="collection">Collection / Ex Works — Customer collects</option>
              </select>
            ) : (
              <div className="flex items-center gap-2">
                {job.serviceType === "collection" ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 font-semibold text-sm">
                    📦 Ex Works / Customer Collection
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-semibold text-sm">
                    🚚 Delivery — We arrange transport
                  </span>
                )}
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
                  value={formatDatetimeLocal(editedJob.eta)}
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
                  value={formatDatetimeLocal(editedJob.actualDeliveryAt)}
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
          {(driverName || editedJob.driverId) && (
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 mb-1">
                <User className="h-4 w-4" />
                Assigned Transporter
              </div>
              <div className="flex items-center justify-between">
                <p className="font-semibold">{driverName || "Assigned"}</p>
                {editedJob.status !== "delivered" && editedJob.status !== "cancelled" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => {
                      if (window.confirm("Unassign ALL line items for this order from the transporter?")) {
                        updateAllLineItems({ driverId: undefined, status: "pending" });
                        onClose();
                      }
                    }}
                  >
                    Unassign All
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Line Items (only show when there are multiple under same ASO ref) */}
          {hasMultipleLineItems && (
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 mb-3">
                <List className="h-4 w-4" />
                Line Items ({lineItems.length})
              </div>
              <div className="space-y-2">
                {lineItems.map((item, idx) => {
                  const isAssigned = item.status !== "pending" && item.driverId;
                  const isPending = item.status === "pending";
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isPending ? "bg-yellow-50 border-yellow-200" : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500">#{idx + 1}</span>
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {item.notes || item.dropoff}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          {item.pallets != null && item.pallets > 0 && <span>{item.pallets} pallets</span>}
                          {item.outstandingQty != null && item.outstandingQty > 0 && <span>{item.outstandingQty.toLocaleString()} qty</span>}
                          <Badge
                            variant={
                              item.status === "delivered" ? "success" :
                              item.status === "exception" ? "destructive" :
                              item.status === "pending" ? "new" : "default"
                            }
                            className="text-[10px] px-1.5 py-0"
                          >
                            {item.status}
                          </Badge>
                        </div>
                      </div>
                      {isAssigned && item.status !== "delivered" && item.status !== "cancelled" && item.status !== "en-route" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 ml-2 shrink-0"
                          onClick={() => {
                            if (window.confirm(`Unassign line item #${idx + 1} (${item.dropoff}) back to pending?`)) {
                              handleUnassignLineItem(item.id);
                            }
                          }}
                          title="Send back to pending"
                        >
                          <Undo2 className="h-4 w-4 mr-1" />
                          <span className="text-xs">Unassign</span>
                        </Button>
                      )}
                      {isPending && !item.driverId && (
                        <span className="text-xs text-yellow-600 font-medium ml-2 shrink-0">Pending</span>
                      )}
                    </div>
                  );
                })}
              </div>
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
