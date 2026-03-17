import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { Phone, MessageSquare, Edit, AlertTriangle } from "lucide-react";
import { Driver } from "../types";
import { statusColour } from "../utils/helpers";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

interface DriverCardProps {
  driver: Driver;
  onEdit?: (driver: Driver) => void;
  assignedPallets?: number;
}

export const DriverCard: React.FC<DriverCardProps> = ({ driver, onEdit, assignedPallets = 0 }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: driver.id,
  });

  const capacity = driver.capacity || 0;
  const usagePercent = capacity > 0 ? Math.min((assignedPallets / capacity) * 100, 100) : 0;
  const isOverCapacity = assignedPallets > capacity && capacity > 0;
  const isNearCapacity = usagePercent >= 80 && !isOverCapacity;
  const remaining = capacity - assignedPallets;

  return (
    <div
      ref={setNodeRef}
      className={`rounded-card border p-4 transition-all ${
        isOver
          ? "border-resilinc-primary bg-blue-50 shadow-card-hover"
          : isOverCapacity
            ? "border-red-400 bg-red-50"
            : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-base text-gray-900">
            {driver.name}
          </p>
          <p className="truncate text-sm text-gray-600 mt-0.5">
            {driver.callsign}
          </p>
          <p className="truncate text-xs text-gray-500 mt-1">
            {driver.location} • Jobs: {driver.assignedJobs}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusColour(driver.status)}>
            {driver.status}
          </Badge>
          {driver.phone && (
            <Button variant="outline" size="icon" title="Call" onClick={() => window.open(`tel:${driver.phone}`)}>
              <Phone className="h-4 w-4" />
            </Button>
          )}
          {driver.email && (
            <Button variant="outline" size="icon" title="Email" onClick={() => window.open(`mailto:${driver.email}`)}>
              <MessageSquare className="h-4 w-4" />
            </Button>
          )}
          {onEdit && (
            <Button variant="outline" size="icon" title="Edit Details" onClick={() => onEdit(driver)}>
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Capacity Bar */}
      {capacity > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-500">
              Pallet Capacity
            </span>
            <span className={`font-semibold ${
              isOverCapacity ? "text-red-600" : isNearCapacity ? "text-amber-600" : "text-gray-700"
            }`}>
              {assignedPallets} / {capacity}
              {remaining > 0 && !isOverCapacity && (
                <span className="text-gray-400 font-normal ml-1">({remaining} avail)</span>
              )}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isOverCapacity ? "bg-red-500" : isNearCapacity ? "bg-amber-500" : "bg-green-500"
              }`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
          {isOverCapacity && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-red-600 font-medium">
              <AlertTriangle className="w-3 h-3" />
              Over capacity by {assignedPallets - capacity} pallets
            </div>
          )}
        </div>
      )}
    </div>
  );
};
