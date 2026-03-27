import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { Phone, MessageSquare, Edit, AlertTriangle, Truck } from "lucide-react";
import { Driver } from "../types";
import { useDispatch } from "../context/DispatchContext";
import { statusColour } from "../utils/helpers";
import { Badge } from "./ui/Badge";

interface DriverCardProps {
  driver: Driver;
  onEdit?: (driver: Driver) => void;
  assignedPallets?: number;
}

export const DriverCard: React.FC<DriverCardProps> = ({ driver, onEdit, assignedPallets = 0 }) => {
  const { jobs } = useDispatch();
  const actualAssignedJobs = jobs.filter(j => j.driverId === driver.id && j.status !== "delivered" && j.status !== "cancelled").length;
  const { setNodeRef, isOver } = useDroppable({
    id: driver.id,
  });

  const capacity = driver.capacity || 0;
  const usagePercent = capacity > 0 ? Math.min((assignedPallets / capacity) * 100, 100) : 0;
  const isOverCapacity = assignedPallets > capacity && capacity > 0;
  const isNearCapacity = usagePercent >= 80 && !isOverCapacity;
  const remaining = capacity - assignedPallets;
  const utilization = capacity > 0 ? Math.round(usagePercent) : 0;

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border px-3 py-2.5 transition-all ${
        isOver
          ? "border-blue-400 bg-blue-50 shadow-md"
          : isOverCapacity
            ? "border-red-300 bg-red-50"
            : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      {/* Top row: name + status + actions */}
      <div className="flex items-center gap-2">
        <Truck className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-900 truncate">{driver.name}</span>
            <span className="text-[10px] text-gray-400 flex-shrink-0">{driver.callsign}</span>
          </div>
        </div>
        <Badge className={`${statusColour(driver.status)} text-[10px] px-1.5 py-0`}>
          {driver.status}
        </Badge>
        <div className="flex items-center gap-1 flex-shrink-0">
          {driver.phone && (
            <button onClick={() => window.open(`tel:${driver.phone}`)} title="Call" className="h-6 w-6 rounded-md border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-500">
              <Phone className="h-3 w-3" />
            </button>
          )}
          {driver.email && (
            <button onClick={() => window.open(`mailto:${driver.email}`)} title="Email" className="h-6 w-6 rounded-md border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-500">
              <MessageSquare className="h-3 w-3" />
            </button>
          )}
          {onEdit && (
            <button onClick={() => onEdit(driver)} title="Edit" className="h-6 w-6 rounded-md border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-500">
              <Edit className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Meta line */}
      <div className="flex items-center gap-3 mt-1 ml-6 text-[10px] text-gray-400">
        <span>{driver.location}</span>
        <span>{actualAssignedJobs} {actualAssignedJobs === 1 ? "job" : "jobs"}</span>
        {capacity > 0 && <span>{utilization}% utilized</span>}
      </div>

      {/* Capacity bar */}
      {capacity > 0 && (
        <div className="mt-2 ml-6">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isOverCapacity ? "bg-red-500" : isNearCapacity ? "bg-amber-500" : "bg-green-500"
                }`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
            <span className={`text-[11px] font-bold tabular-nums flex-shrink-0 ${
              isOverCapacity ? "text-red-600" : isNearCapacity ? "text-amber-600" : "text-gray-700"
            }`}>
              {assignedPallets}/{capacity}
            </span>
            {remaining > 0 && !isOverCapacity && (
              <span className="text-[10px] text-gray-400 flex-shrink-0">{remaining} avail</span>
            )}
          </div>
          {isOverCapacity && (
            <div className="flex items-center gap-1 mt-1 text-[10px] text-red-600 font-medium">
              <AlertTriangle className="w-3 h-3" />
              Over by {assignedPallets - capacity} pallets
            </div>
          )}
        </div>
      )}
    </div>
  );
};
