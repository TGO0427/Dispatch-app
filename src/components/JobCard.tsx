import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock, ChevronRight, GripVertical, Truck, CheckCircle } from "lucide-react";
import { Job } from "../types";
import { priorityTone } from "../utils/helpers";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { useDispatch } from "../context/DispatchContext";
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
  const { drivers, updateJob } = useDispatch();
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
      await updateJob(job.id, {
        status: "delivered",
        actualDeliveryAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error dispatching job:", error);
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
        <p className="truncate font-semibold text-base text-gray-900">
          {job.ref}
        </p>
        <p className="truncate text-sm text-gray-600 mt-0.5">
          <span className={priorityTone(job.priority)}>{job.customer}</span>
        </p>
        <p className="truncate text-xs text-gray-500 mt-1">
          {job.pickup} → {job.dropoff}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs">
          {job.pallets !== undefined && (
            <span className="text-gray-500">{job.pallets} pallets</span>
          )}
          {job.outstandingQty !== undefined && (
            <span className="font-semibold text-orange-600">
              Outstanding: {job.outstandingQty}
            </span>
          )}
        </div>
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
        {job.eta && (
          <div className="flex flex-col items-end text-xs">
            <div className="flex items-center gap-1 text-gray-600">
              <Clock className="h-3.5 w-3.5" /> {job.eta}
            </div>
            <div className="text-gray-400 text-xs">
              Week {getWeekNumber(job.eta)}
            </div>
          </div>
        )}
        {job.status !== "delivered" && job.status !== "cancelled" && (
          <Button
            size="sm"
            onClick={handleDispatch}
            className="bg-green-600 hover:bg-green-700 text-white"
            title="Mark as dispatched"
          >
            <CheckCircle className="h-4 w-4" />
          </Button>
        )}
        <Button size="sm" onClick={(e) => { e.stopPropagation(); onSelect(); }}>
          Details <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
