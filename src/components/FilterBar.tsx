import React, { useMemo } from "react";
import { Search, Filter, X } from "lucide-react";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { Select } from "./ui/Select";
import { useDispatch } from "../context/DispatchContext";
import { JobStatus, JobPriority } from "../types";

export const FilterBar: React.FC = () => {
  const { filters, setFilters, resetFilters, drivers, jobs } = useDispatch();

  // Helper function to get week number and year from date
  const getWeekInfo = (dateString: string | undefined) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const daysSinceStart = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7);
    return {
      week: weekNumber,
      year: date.getFullYear(),
      label: `Week ${weekNumber}, ${date.getFullYear()}`,
      value: `${date.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`
    };
  };

  // Get unique ETA weeks from jobs
  const etaWeeks = useMemo(() => {
    const weeks = new Set<string>();
    jobs.forEach(job => {
      const weekInfo = getWeekInfo(job.eta);
      if (weekInfo) {
        weeks.add(weekInfo.value);
      }
    });
    return Array.from(weeks).sort().reverse(); // Most recent first
  }, [jobs]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, searchQuery: e.target.value });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "all") {
      setFilters({ ...filters, status: undefined });
    } else {
      setFilters({ ...filters, status: [value as JobStatus] });
    }
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "all") {
      setFilters({ ...filters, priority: undefined });
    } else {
      setFilters({ ...filters, priority: [value as JobPriority] });
    }
  };

  const handleDriverChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFilters({ ...filters, driverId: value === "all" ? undefined : value });
  };

  const handleEtaWeekChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFilters({ ...filters, etaWeek: value === "all" ? undefined : value });
  };

  const handleWorkflowStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFilters({
      ...filters,
      workflowStatus: value === "all" ? undefined : value as "ready" | "in-progress" | "not-started"
    });
  };

  const handleTransporterBookedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFilters({
      ...filters,
      transporterBooked: value === "all" ? undefined : value === "yes"
    });
  };

  const handleOrderPickedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFilters({
      ...filters,
      orderPicked: value === "all" ? undefined : value === "yes"
    });
  };

  const handleCoaAvailableChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setFilters({
      ...filters,
      coaAvailable: value === "all" ? undefined : value === "yes"
    });
  };

  const hasActiveFilters =
    filters.searchQuery ||
    (filters.status && filters.status.length > 0) ||
    (filters.priority && filters.priority.length > 0) ||
    filters.driverId ||
    filters.etaWeek ||
    filters.workflowStatus ||
    filters.transporterBooked !== undefined ||
    filters.orderPicked !== undefined ||
    filters.coaAvailable !== undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search jobs by ref, customer, location..."
            value={filters.searchQuery || ""}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>
        {hasActiveFilters && (
          <Button variant="outline" size="icon" onClick={resetFilters} title="Clear filters">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Filters:</span>
        </div>

        <Select
          value={filters.status?.[0] || "all"}
          onChange={handleStatusChange}
          className="w-auto"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="exception">Exception</option>
        </Select>

        <Select
          value={filters.priority?.[0] || "all"}
          onChange={handlePriorityChange}
          className="w-auto"
        >
          <option value="all">All Priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </Select>

        <Select
          value={filters.driverId || "all"}
          onChange={handleDriverChange}
          className="w-auto"
        >
          <option value="all">Transporter</option>
          <option value="unassigned">Unassigned</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name}
            </option>
          ))}
        </Select>

        <Select
          value={filters.etaWeek || "all"}
          onChange={handleEtaWeekChange}
          className="w-auto"
        >
          <option value="all">ETA Week</option>
          {etaWeeks.map(week => {
            const [year, weekNum] = week.split('-W');
            return (
              <option key={week} value={week}>
                Week {weekNum}, {year}
              </option>
            );
          })}
        </Select>

        <Select
          value={filters.workflowStatus || "all"}
          onChange={handleWorkflowStatusChange}
          className="w-auto"
        >
          <option value="all">Workflow Status</option>
          <option value="ready">Ready for Dispatch</option>
          <option value="in-progress">In Progress</option>
          <option value="not-started">Not Started</option>
        </Select>

        <Select
          value={filters.transporterBooked === undefined ? "all" : filters.transporterBooked ? "yes" : "no"}
          onChange={handleTransporterBookedChange}
          className="w-auto"
        >
          <option value="all">Transporter Booked</option>
          <option value="yes">✓ Booked</option>
          <option value="no">✗ Not Booked</option>
        </Select>

        <Select
          value={filters.orderPicked === undefined ? "all" : filters.orderPicked ? "yes" : "no"}
          onChange={handleOrderPickedChange}
          className="w-auto"
        >
          <option value="all">Order Picked</option>
          <option value="yes">✓ Picked</option>
          <option value="no">✗ Not Picked</option>
        </Select>

        <Select
          value={filters.coaAvailable === undefined ? "all" : filters.coaAvailable ? "yes" : "no"}
          onChange={handleCoaAvailableChange}
          className="w-auto"
        >
          <option value="all">COA Available</option>
          <option value="yes">✓ Available</option>
          <option value="no">✗ Not Available</option>
        </Select>
      </div>
    </div>
  );
};
