// src/types.ts

// ------------------------------
// Status & Priority
// ------------------------------
export type JobStatus =
  | "pending"
  | "assigned"
  | "en-route"
  | "delivered"
  | "exception"
  | "cancelled";

export type JobPriority = "urgent" | "high" | "normal" | "low";

export type DriverStatus = "available" | "busy" | "offline" | "break";

export type JobType = "order" | "ibt";

// Handy constants (useful for dropdowns and validation)
export const JOB_STATUSES: JobStatus[] = [
  "pending",
  "assigned",
  "en-route",
  "delivered",
  "exception",
  "cancelled",
];

export const JOB_PRIORITIES: JobPriority[] = ["urgent", "high", "normal", "low"];

export const DRIVER_STATUSES: DriverStatus[] = [
  "available",
  "busy",
  "offline",
  "break",
];

// ------------------------------
// Core Entities
// ------------------------------
export interface Job {
  id: string;

  ref: string;
  customer: string;
  pickup: string;
  dropoff: string;
  warehouse?: string;      // which warehouse this job belongs to

  priority: JobPriority;
  status: JobStatus;
  jobType?: JobType;       // "order" or "ibt" - distinguishes between customer orders and IBT jobs

  pallets?: number;
  outstandingQty?: number;  // Outstanding quantity from Excel import

  // Workflow tracking
  transporterBooked?: boolean;  // Transporter has been booked
  orderPicked?: boolean;        // Order has been picked from warehouse
  coaAvailable?: boolean;       // Certificate of Analysis available
  readyForDispatch?: boolean;   // Auto-calculated: all three above are true

  // Dates as ISO strings — easy to serialize, compare, and store
  eta?: string;                 // planned ETA (e.g. "2025-10-10" or ISO datetime)
  scheduledAt?: string;         // planned pickup/delivery (ISO datetime)
  actualDeliveryAt?: string;    // set when delivered (ISO datetime)
  exceptionReason?: string;     // set when status === "exception"

  driverId?: string;
  notes?: string;

  createdAt: string;            // ISO datetime
  updatedAt: string;            // ISO datetime
}

export interface Driver {
  id: string;
  name: string;
  callsign: string;
  location: string;
  capacity: number;
  assignedJobs: number;
  status: DriverStatus;
  phone?: string;
  email?: string;
}

// ------------------------------
// Sorting / Filtering
// ------------------------------
export type SortField =
  | "ref"
  | "customer"
  | "priority"
  | "status"
  | "eta"
  | "createdAt";

export type SortDirection = "asc" | "desc";

export interface FilterOptions {
  status?: JobStatus[];
  priority?: JobPriority[];
  driverId?: string;
  warehouse?: string;
  searchQuery?: string;
  etaWeek?: string; // Format: "YYYY-Wnn" e.g. "2025-W45"
  workflowStatus?: "ready" | "in-progress" | "not-started"; // Workflow filter
  transporterBooked?: boolean; // Filter by transporter booked status
  orderPicked?: boolean; // Filter by order picked status
  coaAvailable?: boolean; // Filter by COA available status
}

export interface SortOptions {
  field: SortField;
  direction: SortDirection;
}

// ------------------------------
// Type Guards & Helpers (optional)
// ------------------------------
export const isJobStatus = (v: string): v is JobStatus =>
  (JOB_STATUSES as string[]).includes(v);

export const isJobPriority = (v: string): v is JobPriority =>
  (JOB_PRIORITIES as string[]).includes(v);

export const nowIso = () => new Date().toISOString();

/**
 * Create a new Job skeleton with sensible defaults.
 * Fill in ref/customer/pickup/dropoff before use.
 */
export const makeNewJob = (partial: Partial<Job> = {}): Job => {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? (crypto as any).randomUUID()
      : `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const ts = nowIso();

  return {
    id,
    ref: partial.ref ?? "",
    customer: partial.customer ?? "",
    pickup: partial.pickup ?? "",
    dropoff: partial.dropoff ?? "",
    priority: partial.priority ?? "normal",
    status: partial.status ?? "pending",
    pallets: partial.pallets,
    eta: partial.eta,
    scheduledAt: partial.scheduledAt,
    actualDeliveryAt: partial.actualDeliveryAt,
    exceptionReason: partial.exceptionReason,
    driverId: partial.driverId,
    notes: partial.notes,
    createdAt: partial.createdAt ?? ts,
    updatedAt: partial.updatedAt ?? ts,
  };
};
