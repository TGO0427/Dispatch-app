import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock, ChevronRight, GripVertical, Truck, CheckCircle, Trash2 } from "lucide-react";
import { Job } from "../types";
import { priorityTone } from "../utils/helpers";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { useDispatch } from "../context/DispatchContext";
import { useNotification } from "../context/NotificationContext";
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
      className="flex items-center gap-3 rounded-card border border-gray-200 bg-white p-4 hover:shadow-card-hover transition-all cursor-pointer hover:border-blue-300"
      onClick={onSelect}
    >
      <button
        className="cursor-grab active:cursor-grabbing touch-none"
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5 text-gray-400" />
      </button>

      <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
        <p
          className="truncate font-semibold text-base text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        >
          {job.ref}
        </p>
        <p className="truncate text-sm text-gray-600 mt-0.5">
          <span className={priorityTone(job.priority)}>{job.customer}</span>
        </p>
        <div className="flex items-center gap-2 mt-1">
          <p className="truncate text-xs text-gray-500">
            {job.pickup} → {job.dropoff}
          </p>
          {job.serviceType === "collection" ? (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 flex-shrink-0">
              EX WORKS
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex-shrink-0">
              DELIVERY
            </span>
          )}
        </div>
        {job.pallets !== undefined && job.pallets > 0 && (
          <div className="flex items-center gap-2 mt-1 text-xs">
            <span className="text-gray-500">{job.pallets} pallets</span>
          </div>
        )}
        {job.driverId && (
          <div className="flex items-center gap-1 mt-1 text-xs text-gray-600">
            <Truck className="h-3 w-3" />
            <span className="truncate">{drivers.find(d => d.id === job.driverId)?.name || "Unknown"}</span>
          </div>
        )}
        <div className="mt-2">
          <JobWorkflow job={job} onUpdate={updateJob} compact />
        </div>
      </div>

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <Badge variant={getBadgeVariant()}>
          {job.status}
        </Badge>
        {(job.eta || job.etd) && (
          <div className="flex flex-col items-end text-xs">
            {job.etd && (
              <div className="flex items-center gap-1 text-blue-600 font-medium">
                <span className="text-[9px] text-blue-400">ETD</span> {job.etd}
              </div>
            )}
            {job.eta && (
              <div className="flex items-center gap-1 text-gray-600">
                <Clock className="h-3 w-3" />
                <span className="text-[9px] text-gray-400">ETA</span> {job.eta}
              </div>
            )}
            {job.eta && (
              <div className="text-gray-400 text-[10px]">
                Week {getWeekNumber(job.eta)}
              </div>
            )}
          </div>
        )}
        {job.status !== "delivered" && job.status !== "cancelled" && job.status !== "en-route" && (
          <Button
            size="sm"
            onClick={handleDispatch}
            className="bg-green-600 hover:bg-green-700 text-white"
            title="Mark as dispatched"
          >
            <CheckCircle className="h-4 w-4" />
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleRemove}
          className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200"
          title="Remove order"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <Button size="sm" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          Details <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
