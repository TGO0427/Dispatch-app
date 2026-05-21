import React, { useState, useMemo } from "react";
import { X, Edit2, Save, Maximize2, Minimize2, AlertTriangle, RotateCcw } from "lucide-react";
import { Job, JobStatus, JobPriority, ServiceType, TruckSize, JOB_STATUSES, JOB_PRIORITIES, TRUCK_SIZES } from "../types";
import { priorityTone } from "../utils/helpers";
import { useDispatch } from "../context/DispatchContext";
import { useNotification } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import { flowbinsAPI } from "../services/api";
import type { FlowbinBatch } from "../types";
import { JobWorkflow } from "./JobWorkflow";
import { calculateETD, calculateRevisedETD, getDeliveryDelayDays } from "../utils/deliveryDates";
import { hasCompletedPallets } from "../utils/jobValidation";
import { formatDateTime, formatNumber } from "../utils/format";

interface JobDetailsModalProps {
  job: Job;
  onClose: () => void;
  driverName?: string;
}

export const JobDetailsModal: React.FC<JobDetailsModalProps> = ({ job, onClose, driverName }) => {
  const { updateJob, updateJobs, jobs, drivers } = useDispatch();
  const { showSuccess, showError, showWarning, confirm } = useNotification();
  const { isViewer } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editedJob, setEditedJob] = useState<Job>(job);

  // Flowbin state
  const [flowbinBatches, setFlowbinBatches] = useState<FlowbinBatch[]>([]);
  const [newBatchNumber, setNewBatchNumber] = useState("");
  const [newBatchQty, setNewBatchQty] = useState("");

  // Fetch flowbin batches when job has flowbin enabled
  React.useEffect(() => {
    if (job.hasFlowbin) {
      flowbinsAPI.getAll().then((data) => {
        const jobBatches = data.find((j: any) => j.id === job.id)?.flowbinBatches || [];
        setFlowbinBatches(jobBatches);
      }).catch((err) => {
        console.error("Failed to fetch flowbin batches", err);
        showWarning("Could not load flowbin batches");
      });
    }
  }, [job.id, job.hasFlowbin, showWarning]);

  const handleAddBatch = async () => {
    if (!newBatchNumber.trim() || !newBatchQty) return;
    try {
      await flowbinsAPI.create({ jobId: job.id, batchNumber: newBatchNumber.trim(), quantity: Number(newBatchQty) });
      const data = await flowbinsAPI.getAll();
      setFlowbinBatches(data.find((j: any) => j.id === job.id)?.flowbinBatches || []);
      setNewBatchNumber("");
      setNewBatchQty("");
    } catch { showError("Failed to add batch"); }
  };

  const handleRemoveBatch = async (batchId: string) => {
    try {
      await flowbinsAPI.remove(batchId);
      setFlowbinBatches((prev) => prev.filter((b) => b.id !== batchId));
    } catch { showError("Failed to remove batch"); }
  };

  const lineItems = useMemo(() => jobs.filter((j) => j.ref === job.ref), [jobs, job.ref]);
  const hasMultipleLineItems = lineItems.length > 1;
  const revisedETD = calculateRevisedETD(editedJob);
  const deliveryDelayDays = getDeliveryDelayDays(editedJob);

  const updateAllLineItems = (updates: Partial<Job>) => {
    updateJobs(lineItems.map((li) => li.id), updates);
  };

  const handleWorkflowUpdate = (_jobId: string, updates: Partial<Job>) => {
    // Auto-assign DHL + Airline truck type when Export Airfreight is selected
    if (updates.transportService === "airfreight") {
      const dhlDriver = drivers.find((d) => d.name.toLowerCase().includes("dhl"));
      if (dhlDriver) {
        updates.driverId = dhlDriver.id;
        updates.truckSize = "airline";
        updates.status = "assigned";
      }
    }
    // Auto-assign Vessel truck type when Export Seafreight is selected
    if (updates.transportService === "seafreight") {
      updates.truckSize = "vessel";
    }
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
    if (editedJob.status === "returned" && !editedJob.returnReason?.trim()) {
      showError("Returned status requires a return reason");
      return;
    }

    if (editedJob.status === "en-route" && job.status !== "en-route") {
      const missing: string[] = [];
      if (!editedJob.transporterBooked) missing.push("Transporter Booked");
      if (!editedJob.orderPicked) missing.push("Order Picked");
      if (!editedJob.coaAvailable) missing.push("COA Available");
      if (!editedJob.transportService) missing.push("Transport Lead Time");
      if (!editedJob.truckSize) missing.push("Transport Type");
      if (!hasCompletedPallets(editedJob)) {
        missing.push("Pallets");
      }
      if (missing.length > 0) {
        showWarning(`Complete the following before moving to En Route:\n${missing.join(", ")}`);
        return;
      }
    }

    const updates: Partial<Job> = { ...editedJob };
    if (editedJob.status === "en-route" && job.status !== "en-route" && !editedJob.dispatchedAt) {
      updates.dispatchedAt = new Date().toISOString();
    }
    if (editedJob.status === "delivered" && job.status !== "delivered" && !editedJob.actualDeliveryAt) {
      updates.actualDeliveryAt = new Date().toISOString();
    }
    if (editedJob.status === "returned" && job.status !== "returned" && !editedJob.returnedAt) {
      updates.returnedAt = new Date().toISOString();
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
    if (updates.dispatchedAt !== job.dispatchedAt) sharedUpdates.dispatchedAt = updates.dispatchedAt;
    if (updates.actualDeliveryAt !== job.actualDeliveryAt) sharedUpdates.actualDeliveryAt = updates.actualDeliveryAt;
    if (updates.returnedAt !== job.returnedAt) sharedUpdates.returnedAt = updates.returnedAt;
    if (editedJob.returnReason !== job.returnReason) sharedUpdates.returnReason = editedJob.returnReason;
    if (editedJob.returnedPallets !== job.returnedPallets) sharedUpdates.returnedPallets = editedJob.returnedPallets;
    if (editedJob.returnNotes !== job.returnNotes) sharedUpdates.returnNotes = editedJob.returnNotes;
    if (updates.exceptionReason !== undefined) sharedUpdates.exceptionReason = updates.exceptionReason;
    if (editedJob.overdueReason !== job.overdueReason) sharedUpdates.overdueReason = editedJob.overdueReason;
    if (editedJob.internalNotes !== job.internalNotes) sharedUpdates.internalNotes = editedJob.internalNotes;

    updateJob(job.id, updates);

    if (Object.keys(sharedUpdates).length > 0) {
      const isClosingOrder =
        editedJob.status === "delivered" ||
        editedJob.status === "returned" ||
        editedJob.status === "cancelled";
      const siblingIds = jobs
        .filter((j) => j.ref === job.ref && j.id !== job.id && (isClosingOrder || j.status !== "pending"))
        .map((j) => j.id);
      if (siblingIds.length > 0) updateJobs(siblingIds, sharedUpdates);
    }

    const isAmend = job.status === "delivered" || job.status === "returned" || job.status === "cancelled";
    showSuccess(isAmend ? `${job.ref} amended successfully` : `${job.ref} saved successfully`);
    setIsEditing(false);
    onClose();
  };

  const handleCancel = () => { setEditedJob(job); setIsEditing(false); };

  const updateField = <K extends keyof Job>(field: K, value: Job[K]) => {
    setEditedJob((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "eta" && next.transportService) {
        next.etd = calculateETD(next.eta, next.transportService);
      }
      return next;
    });
  };

  const formatDatetimeLocal = (dateString?: string): string => {
    if (!dateString) return "";
    try { const d = new Date(dateString); return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16); } catch { return ""; }
  };

  // Common input classes
  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-resilinc-primary focus:border-transparent bg-gray-50";
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
            <Badge variant={job.status === "exception" ? "destructive" : job.status === "delivered" ? "success" : job.status === "returned" ? "warning" : "secondary"}>
              {job.status}
            </Badge>
            <Badge className={`${priorityTone(job.priority)} text-[10px]`}>{job.priority}</Badge>
          </div>
          <div className="flex items-center gap-1">
            {!isViewer && !isEditing && job.status === "delivered" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditedJob((prev) => ({
                    ...prev,
                    status: "returned",
                    returnedAt: prev.returnedAt || new Date().toISOString(),
                    returnedPallets: prev.returnedPallets ?? prev.pallets,
                  }));
                  setIsEditing(true);
                }}
                className="text-xs gap-1 text-amber-600 hover:text-amber-700"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Mark Returned
              </Button>
            )}
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
                className={`text-xs gap-1 ${job.status === "delivered" || job.status === "returned" || job.status === "cancelled" ? "text-amber-600 hover:text-amber-700" : ""}`}
              >
                <Edit2 className="h-3.5 w-3.5" />
                {job.status === "delivered" || job.status === "returned" || job.status === "cancelled" ? "Amend" : "Edit"}
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
          {isEditing && (job.status === "delivered" || job.status === "returned" || job.status === "cancelled") && (
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
                  {editedJob.status !== "delivered" && editedJob.status !== "returned" && editedJob.status !== "cancelled" && (
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
                <label className={labelCls}>Pallets <span className="text-red-500">*</span></label>
                {!hasCompletedPallets(editedJob) && <AlertTriangle className="w-3 h-3 text-amber-400" />}
              </div>
              {isEditing ? (
                <input type="number" value={editedJob.pallets ?? ""} onChange={(e) => updateField("pallets", e.target.value !== "" ? Number(e.target.value) : undefined)} className={`${inputCls} ${!hasCompletedPallets(editedJob) ? "border-amber-300 bg-amber-50" : ""}`} placeholder="Required" min="1" />
              ) : (
                <p className="text-sm font-medium text-gray-900 mt-0.5">{job.pallets ?? "—"}</p>
              )}
              {isEditing && !hasCompletedPallets(editedJob) && (
                <p className="mt-1 text-[10px] font-medium text-amber-600">Required before En Route</p>
              )}
            </div>
            <div>
              <label className={labelCls}>ETA</label>
              {isEditing ? (
                <input type="datetime-local" value={formatDatetimeLocal(editedJob.eta)} onChange={(e) => updateField("eta", e.target.value ? new Date(e.target.value).toISOString() : undefined)} className={inputCls} />
              ) : (
                <p className="text-sm font-medium text-gray-900 mt-0.5">{formatDateTime(job.eta, "—")}</p>
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
                <p className="text-sm font-medium text-gray-900 mt-0.5">{formatDateTime(job.actualDeliveryAt, "—")}</p>
              )}
            </div>
          )}

          {revisedETD && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Original ETD</label>
                  <p className="text-sm font-semibold text-amber-950 mt-0.5">{editedJob.etd || "—"}</p>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Revised ETD</label>
                  <p className="text-sm font-semibold text-amber-950 mt-0.5">{revisedETD}</p>
                </div>
              </div>
              <p className="text-xs text-amber-800 mt-2">
                Actual delivery missed ETA by {deliveryDelayDays} day{deliveryDelayDays === 1 ? "" : "s"}, so this revised ETD reflects the corrected timeline while keeping the original ETD unchanged.
              </p>
            </div>
          )}

          {((isEditing && editedJob.status === "returned") || job.status === "returned" || job.returnedAt) && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 mb-3">
                <RotateCcw className="w-4 h-4 text-amber-700" />
                <label className="text-xs font-bold text-amber-700 uppercase tracking-wider">Return Details</label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Returned Date</label>
                  {isEditing ? (
                    <input type="datetime-local" value={formatDatetimeLocal(editedJob.returnedAt)} onChange={(e) => updateField("returnedAt", e.target.value ? new Date(e.target.value).toISOString() : undefined)} className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white" />
                  ) : (
                    <p className="text-sm font-semibold text-amber-950 mt-0.5">{formatDateTime(job.returnedAt, "—")}</p>
                  )}
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Returned Pallets</label>
                  {isEditing ? (
                    <input type="number" value={editedJob.returnedPallets ?? ""} onChange={(e) => updateField("returnedPallets", e.target.value !== "" ? Number(e.target.value) : undefined)} className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white" min="0" placeholder="Optional" />
                  ) : (
                    <p className="text-sm font-semibold text-amber-950 mt-0.5">{job.returnedPallets ?? "—"}</p>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <label className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Return Reason <span className="text-red-500">*</span></label>
                {isEditing ? (
                  <textarea value={editedJob.returnReason ?? ""} onChange={(e) => updateField("returnReason", e.target.value || undefined)} className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white" rows={2} placeholder="Why did the client return this shipment?" />
                ) : (
                  <p className="text-sm text-amber-900 mt-0.5">{job.returnReason || "—"}</p>
                )}
              </div>
              <div className="mt-3">
                <label className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Return Notes</label>
                {isEditing ? (
                  <textarea value={editedJob.returnNotes ?? ""} onChange={(e) => updateField("returnNotes", e.target.value || undefined)} className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white" rows={2} placeholder="Condition, next action, collection details..." />
                ) : (
                  <p className="text-sm text-amber-900 mt-0.5">{job.returnNotes || "—"}</p>
                )}
              </div>
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
            const isOverdue = job.eta && job.status !== "delivered" && job.status !== "returned" && job.status !== "cancelled" && (() => {
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
                        {item.outstandingQty != null && item.outstandingQty > 0 && (
                          <span className="text-xs text-orange-600 font-medium">{formatNumber(item.outstandingQty)} qty</span>
                        )}
                        <Badge variant={item.status === "delivered" ? "success" : item.status === "returned" ? "warning" : item.status === "exception" ? "destructive" : item.status === "pending" ? "new" : "default"} className="text-[9px] px-1.5 py-0">{item.status}</Badge>
                      </div>
                      {isAssigned && item.status !== "delivered" && item.status !== "returned" && item.status !== "cancelled" && item.status !== "en-route" && (
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

          {/* Flowbin Section */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Flowbin</label>
              {!isViewer && (
                <button
                  onClick={() => {
                    const newVal = !editedJob.hasFlowbin;
                    updateField("hasFlowbin", newVal);
                    updateJob(job.id, { hasFlowbin: newVal });
                  }}
                  className={`relative w-10 h-5 rounded-full transition-colors ${editedJob.hasFlowbin ? "bg-resilinc-primary" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${editedJob.hasFlowbin ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              )}
            </div>

            {editedJob.hasFlowbin && (
              <div className="space-y-2 mt-3">
                {flowbinBatches.length > 0 && (
                  <div className="space-y-1">
                    {flowbinBatches.map((b) => {
                      const outstanding = b.quantity - (b.quantityReturned || 0);
                      return (
                        <div key={b.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white border border-gray-100 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{b.batchNumber}</span>
                            <span className="text-xs text-gray-500">{b.quantity} sent</span>
                            {b.returnedAt ? (
                              <>
                                <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1 py-0.5 rounded">
                                  {b.quantityReturned ?? b.quantity} returned
                                </span>
                                {outstanding > 0 && (
                                  <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1 py-0.5 rounded">
                                    {outstanding} outstanding
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded">Pending return</span>
                            )}
                          </div>
                          {!isViewer && !b.returnedAt && (
                            <button onClick={() => handleRemoveBatch(b.id)} className="text-[10px] text-red-400 hover:text-red-600">Remove</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {!isViewer && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text" placeholder="Batch number" value={newBatchNumber}
                      onChange={(e) => setNewBatchNumber(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-resilinc-primary"
                    />
                    <input
                      type="number" placeholder="Qty" value={newBatchQty}
                      onChange={(e) => setNewBatchQty(e.target.value)}
                      className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-resilinc-primary"
                      min="1"
                    />
                    <Button size="sm" onClick={handleAddBatch} disabled={!newBatchNumber.trim() || !newBatchQty} className="text-xs h-7">
                      Add
                    </Button>
                  </div>
                )}
                {flowbinBatches.length === 0 && <p className="text-[10px] text-gray-400">No batches added — add batch numbers above</p>}
              </div>
            )}
          </div>

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
            <span>Created: {formatDateTime(job.createdAt)}</span>
            <span>Updated: {formatDateTime(job.updatedAt)}</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
