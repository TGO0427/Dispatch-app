import React, { useMemo } from "react";
import { Search, X } from "lucide-react";
import { Input } from "./ui/Input";
import { Button } from "./ui/Button";
import { Select } from "./ui/Select";
import { useDispatch } from "../context/DispatchContext";
import { JobStatus, JobPriority } from "../types";

export const FilterBar: React.FC<{ showMore?: boolean }> = ({ showMore }) => {
  const { filters, setFilters, resetFilters, drivers, jobs } = useDispatch();

  const getWeekInfo = (dateString: string | undefined) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const daysSinceStart = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7);
    return { week: weekNumber, year: date.getFullYear(), value: `${date.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}` };
  };

  const etaWeeks = useMemo(() => {
    const weeks = new Set<string>();
    jobs.forEach(job => {
      const weekInfo = getWeekInfo(job.eta);
      if (weekInfo) weeks.add(weekInfo.value);
    });
    return Array.from(weeks).sort().reverse();
  }, [jobs]);

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

  const selectCls = "h-7 text-[11px]";

  return (
    <div className="flex items-center gap-1.5">
      {/* Search */}
      <div className="relative w-44 flex-shrink-0">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="Search ref, customer..."
          value={filters.searchQuery || ""}
          onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
          className="pl-7 h-7 text-[11px]"
        />
      </div>

      {/* Core filters */}
      <Select value={filters.status?.[0] || "all"} onChange={(e) => setFilters({ ...filters, status: e.target.value === "all" ? undefined : [e.target.value as JobStatus] })} className={selectCls}>
        <option value="all">Status</option>
        <option value="pending">Pending</option>
        <option value="assigned">Assigned</option>
        <option value="en-route">En Route</option>
        <option value="exception">Exception</option>
      </Select>

      <Select value={filters.priority?.[0] || "all"} onChange={(e) => setFilters({ ...filters, priority: e.target.value === "all" ? undefined : [e.target.value as JobPriority] })} className={selectCls}>
        <option value="all">Priority</option>
        <option value="urgent">Urgent</option>
        <option value="high">High</option>
        <option value="normal">Normal</option>
        <option value="low">Low</option>
      </Select>

      <Select value={filters.driverId || "all"} onChange={(e) => setFilters({ ...filters, driverId: e.target.value === "all" ? undefined : e.target.value })} className={selectCls}>
        <option value="all">Transporter</option>
        <option value="unassigned">Unassigned</option>
        {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
      </Select>

      <Select value={filters.etaWeek || "all"} onChange={(e) => setFilters({ ...filters, etaWeek: e.target.value === "all" ? undefined : e.target.value })} className={selectCls}>
        <option value="all">ETA Week</option>
        {etaWeeks.map(w => { const [y, wn] = w.split('-W'); return <option key={w} value={w}>W{wn}, {y}</option>; })}
      </Select>

      {/* Workflow filters */}
      {showMore && (
        <>
          <Select value={filters.workflowStatus || "all"} onChange={(e) => setFilters({ ...filters, workflowStatus: e.target.value === "all" ? undefined : e.target.value as "ready" | "in-progress" | "not-started" })} className={selectCls}>
            <option value="all">Workflow</option>
            <option value="ready">Ready</option>
            <option value="in-progress">In Progress</option>
            <option value="not-started">Not Started</option>
          </Select>

          <Select value={filters.transporterBooked === undefined ? "all" : filters.transporterBooked ? "yes" : "no"} onChange={(e) => setFilters({ ...filters, transporterBooked: e.target.value === "all" ? undefined : e.target.value === "yes" })} className={selectCls}>
            <option value="all">TB</option>
            <option value="yes">Booked</option>
            <option value="no">Not Booked</option>
          </Select>

          <Select value={filters.orderPicked === undefined ? "all" : filters.orderPicked ? "yes" : "no"} onChange={(e) => setFilters({ ...filters, orderPicked: e.target.value === "all" ? undefined : e.target.value === "yes" })} className={selectCls}>
            <option value="all">OP</option>
            <option value="yes">Picked</option>
            <option value="no">Not Picked</option>
          </Select>

          <Select value={filters.coaAvailable === undefined ? "all" : filters.coaAvailable ? "yes" : "no"} onChange={(e) => setFilters({ ...filters, coaAvailable: e.target.value === "all" ? undefined : e.target.value === "yes" })} className={selectCls}>
            <option value="all">COA</option>
            <option value="yes">Available</option>
            <option value="no">Not Available</option>
          </Select>
        </>
      )}

      {hasActiveFilters && (
        <Button variant="outline" size="icon" onClick={resetFilters} title="Clear all filters" className="h-7 w-7">
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};
