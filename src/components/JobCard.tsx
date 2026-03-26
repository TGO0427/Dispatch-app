import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, GripVertical, Truck, CheckCircle, Trash2 } from "lucide-react";
import { Job } from "../types";
import { priorityTone } from "../utils/helpers";
import { Badge } from "./ui/Badge";
import { useDispatch } from "../context/DispatchContext";
import { useNotification } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import { JobWorkflow } from "./JobWorkflow";

interface JobCardProps {
  job: Job;
  onSelect: () => void;
}

// Helper function to get week number
const getWeekNumber = (dateString: string | undefined) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const daysSinceStart = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7);
  return weekNumber;
};

export const JobCard: React.FC<JobCardProps> = ({ job, onSelect }) => {
  const { drivers, updateJob, removeJob } = useDispatch();
  const { confirm } = useNotification();
  const { isViewer } = useAuth();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: job.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getBadgeVariant = () => {
    if (job.status === "exception") return "destructive";
    if (job.status === "pending" && job.priority === "urgent") return "past-due";
    if (job.status === "pending") return "new";
    if (job.status === "delivered") return "success";
    return "default";
  };

  const handleDispatch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateJob(job.id, { status: "en-route" });
    } catch (error) {
      console.error("Error dispatching job:", error);
    }
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm({ title: "Remove Order", message: `Remove order ${job.ref}? This cannot be undone.`, type: "danger", confirmText: "Remove" });
    if (ok) {
      try {
        await removeJob(job.id);
      } catch (error) {
        console.error("Error removing job:", error);
      }
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5 hover:shadow-sm transition-all cursor-pointer hover:border-blue-200"
      onClick={onSelect}
    >
      {!isViewer && (
        <button
          className="cursor-grab active:cursor-grabbing touch-none"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-gray-300" />
        </button>
      )}

      <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <p
            className="truncate font-semibold text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
          >
            {job.ref}
          </p>
          <span className={`truncate text-xs ${priorityTone(job.priority)}`}>{job.customer}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="truncate text-[11px] text-gray-400">
            {job.pickup} → {job.dropoff}
          </p>
          {job.serviceType === "collection" ? (
            <span className="text-[9px] font-semibold px-1 py-px rounded bg-purple-100 text-purple-700 flex-shrink-0">EX WORKS</span>
          ) : (
            <span className="text-[9px] font-semibold px-1 py-px rounded bg-blue-100 text-blue-700 flex-shrink-0">DELIVERY</span>
          )}
          {job.pallets !== undefined && <span className="text-[11px] text-gray-400 flex-shrink-0">{job.pallets} plt</span>}
          {job.outstandingQty !== undefined && job.outstandingQty > 0 && (
            <span className="text-[11px] text-orange-600 font-medium flex-shrink-0">{job.outstandingQty.toLocaleString()} qty</span>
          )}
          {job.driverId && (
            <span className="text-[11px] text-gray-500 flex-shrink-0 flex items-center gap-0.5">
              <Truck className="h-2.5 w-2.5" />
              {drivers.find(d => d.id === job.driverId)?.name || "Unknown"}
            </span>
          )}
        </div>
        <div className="mt-1.5">
          <JobWorkflow job={job} onUpdate={(jobId, updates) => {
            // Auto-assign DHL + Airline when Export Airfreight is selected
            if (updates.transportService === "airfreight") {
              const dhlDriver = drivers.find((d) => d.name.toLowerCase().includes("dhl"));
              if (dhlDriver) {
                updates.driverId = dhlDriver.id;
                updates.truckSize = "airline";
                updates.status = "assigned";
              }
            }
            if (updates.transportService === "seafreight") {
              updates.truckSize = "vessel";
            }
            updateJob(jobId, updates);
          }} compact />
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <Badge variant={getBadgeVariant()} className="text-[10px] px-1.5 py-0">
          {job.status}
        </Badge>
        {(job.eta || job.etd) && (
          <div className="flex flex-col items-end text-[10px] leading-tight">
            {job.etd && (
              <span className="text-blue-600 font-medium">ETD {job.etd}</span>
            )}
            {job.eta && (
              <span className="text-gray-500">ETA {job.eta}</span>
            )}
            {job.eta && (
              <span className="text-gray-400">W{getWeekNumber(job.eta)}</span>
            )}
          </div>
        )}
        {!isViewer && job.status !== "delivered" && job.status !== "cancelled" && job.status !== "en-route" && (
          <button onClick={handleDispatch} className="h-7 w-7 rounded-md bg-green-600 hover:bg-green-700 text-white flex items-center justify-center" title="Mark as dispatched">
            <CheckCircle className="h-3.5 w-3.5" />
          </button>
        )}
        {!isViewer && (
          <button onClick={handleRemove} className="h-7 w-7 rounded-md bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 flex items-center justify-center" title="Remove order">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); onSelect(); }} className="h-7 px-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1">
          Details <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
