import { Job, Driver, FilterOptions, SortOptions, JobPriority, DriverStatus } from "../types";

export function priorityTone(priority: JobPriority): string {
  const tones = {
    urgent: "text-red-600",
    high: "text-orange-600",
    normal: "text-blue-600",
    low: "text-gray-600",
  };
  return tones[priority];
}

export function statusColour(status: DriverStatus): string {
  const colours = {
    available: "border-green-500 bg-green-50 text-green-700",
    busy: "border-orange-500 bg-orange-50 text-orange-700",
    offline: "border-gray-500 bg-gray-50 text-gray-700",
    break: "border-blue-500 bg-blue-50 text-blue-700",
  };
  return colours[status];
}

// Helper function to get week info from date
function getWeekInfo(dateString: string | undefined) {
  if (!dateString) return null;
  const date = new Date(dateString);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const daysSinceStart = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}

export function filterJobs(jobs: Job[], filters: FilterOptions): Job[] {
  return jobs.filter((job) => {
    // Filter by status
    if (filters.status && filters.status.length > 0) {
      if (!filters.status.includes(job.status)) return false;
    }

    // Filter by priority
    if (filters.priority && filters.priority.length > 0) {
      if (!filters.priority.includes(job.priority)) return false;
    }

    // Filter by driver
    if (filters.driverId) {
      if (job.driverId !== filters.driverId) return false;
    }

    // Filter by warehouse
    if (filters.warehouse) {
      if (job.warehouse !== filters.warehouse) return false;
    }

    // Filter by ETA week
    if (filters.etaWeek) {
      const jobWeek = getWeekInfo(job.eta);
      if (jobWeek !== filters.etaWeek) return false;
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const searchableText = [
        job.ref,
        job.customer,
        job.pickup,
        job.dropoff,
        job.notes || "",
      ]
        .join(" ")
        .toLowerCase();
      if (!searchableText.includes(query)) return false;
    }

    // Filter by workflow status
    if (filters.workflowStatus) {
      if (filters.workflowStatus === "ready") {
        // Ready for dispatch: all three workflow items complete
        if (!job.readyForDispatch) return false;
      } else if (filters.workflowStatus === "in-progress") {
        // In progress: at least one item checked but not all
        const hasAnyChecked = job.transporterBooked || job.orderPicked || job.coaAvailable;
        if (!hasAnyChecked || job.readyForDispatch) return false;
      } else if (filters.workflowStatus === "not-started") {
        // Not started: none of the workflow items checked
        const hasAnyChecked = job.transporterBooked || job.orderPicked || job.coaAvailable;
        if (hasAnyChecked) return false;
      }
    }

    // Filter by individual workflow items
    if (filters.transporterBooked !== undefined) {
      if (!!job.transporterBooked !== filters.transporterBooked) return false;
    }

    if (filters.orderPicked !== undefined) {
      if (!!job.orderPicked !== filters.orderPicked) return false;
    }

    if (filters.coaAvailable !== undefined) {
      if (!!job.coaAvailable !== filters.coaAvailable) return false;
    }

    return true;
  });
}

export function sortJobs(jobs: Job[], sortOptions: SortOptions): Job[] {
  const { field, direction } = sortOptions;
  const multiplier = direction === "asc" ? 1 : -1;

  return [...jobs].sort((a, b) => {
    // PRIMARY SORT: nearest ETA date first (orders with upcoming dates on top)
    const aEta = a.eta ? new Date(a.eta).getTime() : Infinity;
    const bEta = b.eta ? new Date(b.eta).getTime() : Infinity;

    // Jobs with ETA always come before jobs without ETA
    if (aEta !== Infinity && bEta === Infinity) return -1;
    if (bEta !== Infinity && aEta === Infinity) return 1;

    // Both have ETA: nearest date first
    if (aEta !== bEta) return aEta - bEta;

    // SECONDARY SORT: high-priority jobs first
    const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
    const aPriority = priorityOrder[a.priority];
    const bPriority = priorityOrder[b.priority];

    if (aPriority !== bPriority) return bPriority - aPriority;

    // TERTIARY SORT: use the selected sort field
    let aVal: any = a[field];
    let bVal: any = b[field];

    if (field === "priority") {
      aVal = aPriority;
      bVal = bPriority;
    }

    if (field === "status") {
      const statusOrder = {
        exception: 6,
        pending: 5,
        assigned: 4,
        "en-route": 3,
        delivered: 2,
        cancelled: 1
      };
      aVal = statusOrder[a.status] || 0;
      bVal = statusOrder[b.status] || 0;
    }

    if (field === "createdAt" || field === "eta") {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    }

    if (typeof aVal === "string" && typeof bVal === "string") {
      return multiplier * aVal.localeCompare(bVal);
    }

    if (aVal < bVal) return -1 * multiplier;
    if (aVal > bVal) return 1 * multiplier;
    return 0;
  });
}

export function filterDrivers(drivers: Driver[], searchQuery?: string): Driver[] {
  if (!searchQuery) return drivers;

  const query = searchQuery.toLowerCase();
  return drivers.filter((driver) => {
    const searchableText = [
      driver.name,
      driver.callsign,
      driver.location,
      driver.phone || "",
      driver.email || "",
    ]
      .join(" ")
      .toLowerCase();
    return searchableText.includes(query);
  });
}

export function cn(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
