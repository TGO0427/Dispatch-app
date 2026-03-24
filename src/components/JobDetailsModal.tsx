import React, { useState, useMemo } from "react";
import { X, Edit2, Save, Maximize2, Minimize2, AlertTriangle } from "lucide-react";
import { Job, JobStatus, JobPriority, ServiceType, TruckSize, JOB_STATUSES, JOB_PRIORITIES, TRUCK_SIZES } from "../types";
import { priorityTone } from "../utils/helpers";
import { useDispatch } from "../context/DispatchContext";
import { useNotification } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import { JobWorkflow } from "./JobWorkflow";

interface JobDetailsModalProps {
  job: Job;
  onClose: () => void;
  driverName?: string;
}

const formatHumanDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return dateStr; }
};

export const JobDetailsModal: React.FC<JobDetailsModalProps> = ({ job, onClose, driverName }) => {
  const { updateJob, jobs } = useDispatch();
  const { showSuccess, showError, showWarning, confirm } = useNotification();
  const { isViewer } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editedJob, setEditedJob] = useState<Job>(job);

  const lineItems = useMemo(() => jobs.filter((j) => j.ref === job.ref), [jobs, job.ref]);
  const hasMultipleLineItems = lineItems.length > 1;

  const updateAllLineItems = (updates: Partial<Job>) => {
    lineItems.forEach((li) => updateJob(li.id, updates));
  };

  const handleWorkflowUpdate = (_jobId: string, updates: Partial<Job>) => {
    updateAllLineItems(updates);
    setEditedJob((prev) => ({ ...prev, ...updates }));
  };

  const handleUnassignLineItem = (lineItemId: string) => {
    updateJob(lineItemId, { driverId: undefined, status: "pending" });
  };

  const handleSave = () => {
    if (editedJob.status === "exception" && !editedJob.exceptionReason?.trim()) {
      showError("Exception status requires an exception reason");
      return;
    }

    if (editedJob.status === "en-route" && job.status !== "en-route") {
      const missing: string[] = [];
      if (!editedJob.transporterBooked) missing.push("Transporter Booked");
      if (!editedJob.orderPicked) missing.push("Order Picked");
      if (!editedJob.coaAvailable) missing.push("COA Available");
      if (!editedJob.transportService) missing.push("Transport Lead Time");
      if (!editedJob.truckSize) missing.push("Transport Type");
      if (!editedJob.pallets && editedJob.pallets !== 0) missing.push("Pallets");
      if (missing.length > 0) {
        showWarning(`Complete the following before moving to En Route:\n${missing.join(", ")}`);
        return;
      }
    }

    const updates: Partial<Job> = { ...editedJob };
    if (editedJob.status === "delivered" && !editedJob.actualDeliveryAt) {
      updates.actualDeliveryAt = new Date().toISOString();
    }
    if (editedJob.status !== "exception") updates.exceptionReason = undefined;

    const sharedUpdates: Partial<Job> = {};
    if (editedJob.status !== job.status) sharedUpdates.status = editedJob.status;
    if (editedJob.driverId !== job.driverId) sharedUpdates.driverId = editedJob.driverId;
    if (editedJob.transporterBooked !== job.transporterBooked) sharedUpdates.transporterBooked = editedJob.transporterBooked;
    if (editedJob.orderPicked !== job.orderPicked) sharedUpdates.orderPicked = editedJob.orderPicked;
    if (editedJob.coaAvailable !== job.coaAvailable) sharedUpdates.coaAvailable = editedJob.coaAvailable;
    if (editedJob.readyForDispatch !== job.readyForDispatch) sharedUpdates.readyForDispatch = editedJob.readyForDispatch;
    if (editedJob.transportService !== job.transportService) sharedUpdates.transportService = editedJob.transportService;
    if (editedJob.truckSize !== job.truckSize) sharedUpdates.truckSize = editedJob.truckSize;
    if (editedJob.etd !== job.etd) sharedUpdates.etd = editedJob.etd;
    if (editedJob.pallets !== job.pallets) sharedUpdates.pallets = editedJob.pallets;
    if (updates.actualDeliveryAt) sharedUpdates.actualDeliveryAt = updates.actualDeliveryAt;
    if (updates.exceptionReason !== undefined) sharedUpdates.exceptionReason = updates.exceptionReason;
    if (editedJob.overdueReason !== job.overdueReason) sharedUpdates.overdueReason = editedJob.overdueReason;
    if (editedJob.internalNotes !== job.internalNotes) sharedUpdates.internalNotes = editedJob.internalNotes;

    updateJob(job.id, updates);

    if (Object.keys(sharedUpdates).length > 0) {
      jobs.filter((j) => j.ref === job.ref && j.id !== job.id && j.status !== "pending")
        .forEach((sibling) => updateJob(sibling.id, sharedUpdates));
    }

    const isAmend = job.status === "delivered" || job.status === "cancelled";
    showSuccess(isAmend ? `${job.ref} amended successfully` : `${job.ref} saved successfully`);
    setIsEditing(false);
    onClose();
  };

  const handleCancel = () => { setEditedJob(job); setIsEditing(false); };

  const updateField = <K extends keyof Job>(field: K, value: Job[K]) => {
    setEditedJob((prev) => ({ ...prev, [field]: value }));
  };

  const formatDatetimeLocal = (dateString?: string): string => {
    if (!dateString) return "";
    try { const d = new Date(dateString); return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16); } catch { return ""; }
  };

  // Common input classes
  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50";
  const labelCls = "text-[11px] font-semibold text-gray-400 uppercase tracking-wider";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog" aria-modal="true" aria-label={`Job details for ${job.ref}`}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <Card
        className={`overflow-y-auto transition-all duration-300 ${
          isFullscreen ? "w-full h-full max-w-none max-h-none rounded-none" : "w-full max-w-2xl max-h-[90vh]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — sticky */}
        <div className="sticky top-0 bg-white z-10 border-b border-gray-100 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{job.ref}</h2>
              <p className="text-xs text-gray-400">{job.customer}</p>
            </div>
            <Badge variant={job.status === "exception" ? "destructive" : job.status === "delivered" ? "success" : "secondary"}>
              {job.status}
            </Badge>
            <Badge className={`${priorityTone(job.priority)} text-[10px]`}>{job.priority}</Badge>
          </div>
          <div className="flex items-center gap-1">
            {!isViewer && (isEditing ? (
              <>
                <Button variant="ghost" size="sm" onClick={handleCancel} className="text-xs">Cancel</Button>
                <Button size="sm" onClick={handleSave} className="text-xs gap-1">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className={`text-xs gap-1 ${job.status === "delivered" || job.status === "cancelled" ? "text-amber-600 hover:text-amber-700" : ""}`}
              >
                <Edit2 className="h-3.5 w-3.5" />
                {job.status === "delivered" || job.status === "cancelled" ? "Amend" : "Edit"}
              </Button>
            ))}
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100" title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Amend notice for delivered/cancelled orders */}
          {isEditing && (job.status === "delivered" || job.status === "cancelled") && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Amending a {job.status} order — changes will be saved to the record (pallets, truck size, notes, etc.)</span>
            </div>
          )}

          {/* Status & Priority (edit mode) */}
          {isEditing && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Status</label>
                <select value={editedJob.status} onChange={(e) => updateField("status", e.target.value as JobStatus)} className={inputCls}>
                  {JOB_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Priority</label>
                <select value={editedJob.priority} onChange={(e) => updateField("priority", e.target.value as JobPriority)} className={inputCls}>
                  {JOB_PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Workflow */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
            <JobWorkflow job={editedJob} onUpdate={handleWorkflowUpdate} />
          </div>

          {/* Service Type + Transport Type — 2 columns */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Service Type</label>
              {isEditing ? (
                <select value={editedJob.serviceType || "delivery"} onChange={(e) => updateField("serviceType", e.target.value as ServiceType)} className={inputCls}>
                  <option value="delivery">Delivery</option>
                  <option value="collection">Collection / Ex Works</option>
                </select>
              ) : (
                <p className="text-sm font-medium text-gray-900 mt-0.5">
                  {job.serviceType === "collection" ? "📦 Ex Works" : "🚚 Delivery"}
                </p>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1">
                <label className={labelCls}>Transport Type</label>
                {!(isEditing ? editedJob.truckSize : job.truckSize) && <AlertTriangle className="w-3 h-3 text-amber-400" />}
              </div>
              {isEditing ? (
                <select value={editedJob.truckSize || ""} onChange={(e) => updateField("truckSize", e.target.value as TruckSize || undefined)} className={inputCls}>
                  <option value="">Select...</option>
                  {TRUCK_SIZES.map((ts) => <option key={ts.value} value={ts.value}>{ts.label}</option>)}
                </select>
              ) : (
                <p className="text-sm font-medium text-gray-900 mt-0.5">
                  {job.truckSize ? TRUCK_SIZES.find((ts) => ts.value === job.truckSize)?.label || job.truckSize : "—"}
                </p>
              )}
            </div>
          </div>

          {/* Route — timeline style */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
            <label className={`${labelCls} mb-2 block`}>Route</label>
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-1">
                <div className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-100" />
                <div className="w-0.5 h-8 bg-gray-300" />
                <div className="w-3 h-3 rounded-full bg-green-500 ring-2 ring-green-100" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase">Pickup</p>
                  <p className="text-sm font-medium text-gray-900">{job.pickup}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 uppercase">Dropoff</p>
                  <p className="text-sm font-medium text-gray-900">{job.dropoff}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Customer + Transporter — 2 columns */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Customer</label>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{job.customer}</p>
            </div>
            {(driverName || editedJob.driverId) && (
              <div>
                <label className={labelCls}>Assigned Transporter</label>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-sm font-semibold text-gray-900">{driverName || "Assigned"}</p>
                  {editedJob.status !== "delivered" && editedJob.status !== "cancelled" && (
                    <button
                      onClick={async () => {
                        const ok = await confirm({ title: "Unassign Order", message: "Unassign ALL line items?", type: "warning", confirmText: "Unassign" });
                        if (ok) { updateAllLineItems({ driverId: undefined, status: "pending" }); onClose(); }
                      }}
                      className="text-[10px] text-red-500 hover:text-red-700 font-medium"
                    >
                      Unassign
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Pallets + ETA — 2 columns */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-1">
                <label className={labelCls}>Pallets</label>
                {!editedJob.pallets && editedJob.pallets !== 0 && <AlertTriangle className="w-3 h-3 text-amber-400" />}
              </div>
              {isEditing ? (
                <input type="number" value={editedJob.pallets ?? ""} onChange={(e) => updateField("pallets", e.target.value !== "" ? Number(e.target.value) : undefined)} className={inputCls} placeholder="0" min="0" />
              ) : (
                <p className="text-sm font-medium text-gray-900 mt-0.5">{job.pallets ?? "—"}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>ETA</label>
              {isEditing ? (
                <input type="datetime-local" value={formatDatetimeLocal(editedJob.eta)} onChange={(e) => updateField("eta", e.target.value ? new Date(e.target.value).toISOString() : undefined)} className={inputCls} />
              ) : (
                <p className="text-sm font-medium text-gray-900 mt-0.5">{job.eta ? formatHumanDate(job.eta) : "—"}</p>
              )}
            </div>
          </div>

          {/* Actual Delivery Date */}
          {(isEditing || job.actualDeliveryAt) && (
            <div>
              <label className={labelCls}>Actual Delivery Date</label>
              {isEditing ? (
                <input type="datetime-local" value={formatDatetimeLocal(editedJob.actualDeliveryAt)} onChange={(e) => updateField("actualDeliveryAt", e.target.value ? new Date(e.target.value).toISOString() : undefined)} className={inputCls} />
              ) : (
                <p className="text-sm font-medium text-gray-900 mt-0.5">{job.actualDeliveryAt ? formatHumanDate(job.actualDeliveryAt) : "—"}</p>
              )}
            </div>
          )}

          {/* Exception Reason */}
          {((isEditing && editedJob.status === "exception") || job.exceptionReason) && (
            <div>
              <label className={labelCls}>Exception Reason</label>
              {isEditing ? (
                <textarea value={editedJob.exceptionReason ?? ""} onChange={(e) => updateField("exceptionReason", e.target.value || undefined)} className={inputCls} rows={2} placeholder="Describe the exception..." />
              ) : (
                <p className="text-sm text-red-700 mt-0.5 bg-red-50 rounded-lg px-3 py-2">{job.exceptionReason}</p>
              )}
            </div>
          )}

          {/* Overdue Reason — show when ETA has passed and not delivered/cancelled */}
          {(() => {
            const isOverdue = job.eta && job.status !== "delivered" && job.status !== "cancelled" && (() => {
              const eta = new Date(job.eta!); eta.setHours(0, 0, 0, 0);
              const now = new Date(); now.setHours(0, 0, 0, 0);
              return now > eta;
            })();
            if (!isOverdue && !job.overdueReason) return null;
            const eta = new Date(job.eta!); eta.setHours(0, 0, 0, 0);
            const now = new Date(); now.setHours(0, 0, 0, 0);
            const daysOverdue = Math.floor((now.getTime() - eta.getTime()) / 86400000);
            return (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <label className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                    Overdue {daysOverdue > 0 ? `(${daysOverdue} day${daysOverdue > 1 ? "s" : ""})` : ""}
                  </label>
                </div>
                {isEditing || isOverdue ? (
                  <textarea
                    value={editedJob.overdueReason ?? ""}
                    onChange={(e) => updateField("overdueReason", e.target.value || undefined)}
                    className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                    rows={2}
                    placeholder="Please provide a reason for the delay..."
                  />
                ) : (
                  <p className="text-sm text-amber-800">{job.overdueReason}</p>
                )}
                {isOverdue && !editedJob.overdueReason && (
                  <p className="text-[10px] text-amber-600 mt-1">A reason is required for overdue orders</p>
                )}
              </div>
            );
          })()}

          {/* Line Items */}
          {hasMultipleLineItems && (
            <div>
              <label className={`${labelCls} mb-2 block`}>Line Items ({lineItems.length})</label>
              <div className="space-y-1.5">
                {lineItems.map((item, idx) => {
                  const isAssigned = item.status !== "pending" && item.driverId;
                  const isPending = item.status === "pending";
                  return (
                    <div key={item.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm ${isPending ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-100"}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-gray-400">#{idx + 1}</span>
                        <span className="font-medium text-gray-900 truncate">
                          {item.notes && !item.notes.match(/^(ASO|IBT|CSO)\d/) ? item.notes : item.dropoff}
                        </span>
                        {item.pallets != null && item.pallets > 0 && <span className="text-xs text-gray-400">{item.pallets} plt</span>}
                        <Badge variant={item.status === "delivered" ? "success" : item.status === "exception" ? "destructive" : item.status === "pending" ? "new" : "default"} className="text-[9px] px-1.5 py-0">{item.status}</Badge>
                      </div>
                      {isAssigned && item.status !== "delivered" && item.status !== "cancelled" && item.status !== "en-route" && (
                        <button onClick={async () => { const ok = await confirm({ title: "Unassign", message: `Unassign #${idx + 1}?`, type: "warning", confirmText: "Unassign" }); if (ok) handleUnassignLineItem(item.id); }} className="text-[10px] text-orange-500 hover:text-orange-700 font-medium ml-2">Unassign</button>
                      )}
                      {isPending && !item.driverId && <span className="text-[10px] text-amber-600 font-medium ml-2">Pending</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Line Item — product name from import (only for single line item) */}
          {!hasMultipleLineItems && job.notes && (
            <div>
              <label className={labelCls}>Line Item</label>
              <p className="text-sm font-medium text-gray-900 mt-0.5">{job.notes}</p>
            </div>
          )}

          {/* Notes — editable free-text for important details */}
          <div>
            <label className={labelCls}>Notes</label>
            {isEditing ? (
              <textarea value={editedJob.internalNotes ?? ""} onChange={(e) => updateField("internalNotes", e.target.value || undefined)} className={inputCls} rows={2} placeholder="Add important details, special instructions..." />
            ) : (
              job.internalNotes ? (
                <p className="text-sm text-gray-600 mt-0.5 bg-gray-50 rounded-lg px-3 py-2">{job.internalNotes}</p>
              ) : (
                <p className="text-xs text-gray-400 mt-0.5">No notes added</p>
              )
            )}
          </div>

          {/* Timestamps — human-readable */}
          <div className="flex items-center gap-4 pt-3 border-t border-gray-100 text-[10px] text-gray-400">
            <span>Created: {formatHumanDate(job.createdAt)}</span>
            <span>Updated: {formatHumanDate(job.updatedAt)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
