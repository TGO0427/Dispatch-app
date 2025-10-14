import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { Phone, MessageSquare, Edit } from "lucide-react";
import { Driver } from "../types";
import { statusColour } from "../utils/helpers";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

interface DriverCardProps {
  driver: Driver;
  onEdit?: (driver: Driver) => void;
}

export const DriverCard: React.FC<DriverCardProps> = ({ driver, onEdit }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: driver.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex items-center justify-between rounded-card border p-4 transition-all ${
        isOver ? "border-resilinc-primary bg-blue-50 shadow-card-hover" : "border-gray-200 bg-white"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-base text-gray-900">
          {driver.name}
        </p>
        <p className="truncate text-sm text-gray-600 mt-0.5">
          {driver.callsign}
        </p>
        <p className="truncate text-xs text-gray-500 mt-1">
          {driver.location} • Cap: {driver.capacity} • Jobs: {driver.assignedJobs}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge className={statusColour(driver.status)}>
          {driver.status}
        </Badge>
        {driver.phone && (
          <Button
            variant="outline"
            size="icon"
            title="Call"
            onClick={() => window.open(`tel:${driver.phone}`)}
          >
            <Phone className="h-4 w-4" />
          </Button>
        )}
        {driver.email && (
          <Button
            variant="outline"
            size="icon"
            title="Email"
            onClick={() => window.open(`mailto:${driver.email}`)}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        )}
        {onEdit && (
          <Button
            variant="outline"
            size="icon"
            title="Edit Details"
            onClick={() => onEdit(driver)}
          >
            <Edit className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
