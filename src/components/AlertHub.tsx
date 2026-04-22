import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { X, Search, Truck, Bell } from "lucide-react";
import { useDispatch } from "../context/DispatchContext";
import { Badge } from "./ui/Badge";

interface Alert {
  id: string;
  title: string;
  description?: string;
  severity: "critical" | "warning" | "info";
  category: string;
  jobRef?: string;
  jobId?: string;
  ts: number;
  read: boolean;
}

interface AlertHubProps {
  open: boolean;
  onClose: () => void;
  onSelectJob?: (jobId: string) => void;
}

const SEVERITY_ORDER = { critical: 3, warning: 2, info: 1 };

function colorFor(sev: string) {
  if (sev === "critical") return "#ef4444";
  if (sev === "warning") return "#eab308";
  return "#3b82f6";
}

export const AlertHub: React.FC<AlertHubProps> = ({ open, onClose, onSelectJob }) => {
  const { jobs, drivers } = useDispatch();
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [tab, setTab] = useState<"alerts" | "upcoming">("alerts");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("dispatch-dismissed-alerts");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const asideRef = useRef<HTMLDivElement>(null);

  // Save dismissed alerts
  useEffect(() => {
    localStorage.setItem("dispatch-dismissed-alerts", JSON.stringify([...dismissedIds]));
  }, [dismissedIds]);

  // Escape to close
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  // Generate alerts from job data
  const alerts = useMemo((): Alert[] => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const result: Alert[] = [];

    // Deduplicate by ref for alert generation
    const refMap = new Map<string, typeof jobs[0]>();
    jobs.forEach((j) => {
      if (!refMap.has(j.ref)) refMap.set(j.ref, j);
    });

    refMap.forEach((job) => {
      // 1. Overdue ETA - not delivered and ETA has passed
      if (job.eta && job.status !== "delivered" && job.status !== "cancelled") {
        const eta = new Date(job.eta);
        eta.setHours(0, 0, 0, 0);
        const daysOverdue = Math.floor((now.getTime() - eta.getTime()) / 86400000);
        if (daysOverdue > 0) {
          const reasonText = job.overdueReason ? ` — Reason: ${job.overdueReason}` : " — No reason provided";
          result.push({
            id: `overdue-${job.ref}`,
            title: `Overdue: ${job.ref}`,
            description: `${job.customer} — ETA was ${job.eta} (${daysOverdue} day${daysOverdue > 1 ? "s" : ""} overdue)${reasonText}`,
            severity: daysOverdue > 3 ? "critical" : "warning",
            category: "Overdue",
            jobRef: job.ref,
            jobId: job.id,
            ts: eta.getTime(),
            read: false,
          });
        }
      }

      // 2. Exception status
      if (job.status === "exception") {
        result.push({
          id: `exception-${job.ref}`,
          title: `Exception: ${job.ref}`,
          description: `${job.customer} — ${job.exceptionReason || "No reason provided"}`,
          severity: "critical",
          category: "Exception",
          jobRef: job.ref,
          jobId: job.id,
          ts: new Date(job.updatedAt).getTime(),
          read: false,
        });
      }

      // 3. ETD is today or tomorrow (needs dispatch action)
      if (job.etd && job.status !== "delivered" && job.status !== "cancelled" && job.status !== "en-route") {
        const etd = new Date(job.etd);
        etd.setHours(0, 0, 0, 0);
        const daysUntilETD = Math.floor((etd.getTime() - now.getTime()) / 86400000);
        if (daysUntilETD === 0) {
          result.push({
            id: `etd-today-${job.ref}`,
            title: `Dispatch Today: ${job.ref}`,
            description: `${job.customer} — ETD is today, needs to leave warehouse`,
            severity: "critical",
            category: "Dispatch Due",
            jobRef: job.ref,
            jobId: job.id,
            ts: etd.getTime(),
            read: false,
          });
        } else if (daysUntilETD === 1) {
          result.push({
            id: `etd-tomorrow-${job.ref}`,
            title: `Dispatch Tomorrow: ${job.ref}`,
            description: `${job.customer} — ETD is tomorrow, prepare for dispatch`,
            severity: "warning",
            category: "Dispatch Due",
            jobRef: job.ref,
            jobId: job.id,
            ts: etd.getTime(),
            read: false,
          });
        }
      }

      // 4. Urgent/high priority and still pending (not assigned)
      if ((job.priority === "urgent" || job.priority === "high") && job.status === "pending") {
        result.push({
          id: `unassigned-priority-${job.ref}`,
          title: `Unassigned ${job.priority}: ${job.ref}`,
          description: `${job.customer} — ${job.priority} priority order not yet assigned to a transporter`,
          severity: job.priority === "urgent" ? "critical" : "warning",
          category: "Unassigned",
          jobRef: job.ref,
          jobId: job.id,
          ts: new Date(job.createdAt).getTime(),
          read: false,
        });
      }
    });

    // 5. Transporter over capacity
    drivers.forEach((driver) => {
      if (driver.capacity > 0) {
        let assignedPallets = 0;
        jobs.forEach((j) => {
          if (j.driverId === driver.id && j.status !== "delivered" && j.status !== "cancelled") {
            assignedPallets += j.pallets || 0;
          }
        });
        if (assignedPallets > driver.capacity) {
          result.push({
            id: `overcapacity-${driver.id}`,
            title: `Over Capacity: ${driver.name}`,
            description: `${assignedPallets} pallets assigned vs ${driver.capacity} capacity (${assignedPallets - driver.capacity} over)`,
            severity: "warning",
            category: "Capacity",
            ts: Date.now(),
            read: false,
          });
        }
      }
    });

    return result.filter((a) => !dismissedIds.has(a.id));
  }, [jobs, drivers, dismissedIds]);

  // Upcoming deliveries (ETA within 3 days)
  const upcoming = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const threeDays = new Date(now.getTime() + 3 * 86400000);

    const refMap = new Map<string, typeof jobs[0]>();
    jobs.forEach((j) => {
      if (!refMap.has(j.ref) && j.eta && j.status !== "delivered" && j.status !== "cancelled") {
        refMap.set(j.ref, j);
      }
    });

    return Array.from(refMap.values())
      .filter((job) => {
        const eta = new Date(job.eta!);
        eta.setHours(0, 0, 0, 0);
        return eta >= now && eta <= threeDays;
      })
      .sort((a, b) => new Date(a.eta!).getTime() - new Date(b.eta!).getTime());
  }, [jobs]);

  const filtered = useMemo(() => {
    return alerts
      .filter((a) => severity === "all" || a.severity === severity)
      .filter((a) =>
        query.trim()
          ? (a.title + " " + (a.description || "")).toLowerCase().includes(query.toLowerCase())
          : true
      )
      .sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity] || b.ts - a.ts);
  }, [alerts, query, severity]);

  const dismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  const dismissAll = () => {
    setDismissedIds((prev) => new Set([...prev, ...alerts.map((a) => a.id)]));
  };

  if (!open) return null;

  const daysUntil = (dateStr: string) => {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = Math.floor((d.getTime() - now.getTime()) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return `In ${diff} days`;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-[999]"
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="true"
        aria-label="Alert Hub"
        onKeyDown={handleKeyDown}
        className="fixed top-0 right-0 h-screen w-[420px] max-w-[95vw] bg-white border-l border-gray-200 shadow-2xl z-[1000] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <Bell className="w-5 h-5 text-resilinc-primary" />
          <span className="font-bold text-gray-900">Alert Hub</span>
          {alerts.length > 0 && (
            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">
              {alerts.length}
            </span>
          )}
          <span className="ml-auto text-xs text-gray-500">
            {tab === "alerts" ? `${filtered.length} alerts` : `${upcoming.length} deliveries`}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setTab("alerts")}
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === "alerts"
                ? "border-resilinc-primary text-resilinc-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Alerts {alerts.length > 0 && `(${alerts.length})`}
          </button>
          <button
            onClick={() => setTab("upcoming")}
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === "upcoming"
                ? "border-resilinc-primary text-resilinc-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Next ETA {upcoming.length > 0 && `(${upcoming.length})`}
          </button>
        </div>

        {/* Alerts Tab */}
        {tab === "alerts" && (
          <>
            {/* Filters */}
            <div className="p-3 border-b border-gray-100 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search alerts..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-resilinc-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50"
                >
                  <option value="all">All severities</option>
                  <option value="critical">Critical</option>
                  <option value="warning">Warning</option>
                  <option value="info">Info</option>
                </select>
                {alerts.length > 0 && (
                  <button
                    onClick={dismissAll}
                    className="ml-auto text-xs text-gray-500 hover:text-red-600 transition-colors"
                  >
                    Dismiss all
                  </button>
                )}
              </div>
            </div>

            {/* Alert List — grouped by category */}
            <div className="flex-1 overflow-y-auto p-3 space-y-4">
              {filtered.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No alerts — everything looks good
                </div>
              )}
              {(() => {
                // Group alerts by category
                const categoryOrder = ["Overdue", "Dispatch Due", "Exception", "Unassigned", "Capacity"];
                const grouped = new Map<string, typeof filtered>();
                filtered.forEach((a) => {
                  const list = grouped.get(a.category) || [];
                  list.push(a);
                  grouped.set(a.category, list);
                });

                const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
                  "Overdue": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
                  "Dispatch Due": { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
                  "Exception": { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
                  "Unassigned": { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
                  "Capacity": { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
                };

                return categoryOrder
                  .filter((cat) => grouped.has(cat))
                  .map((category) => {
                    const items = grouped.get(category)!;
                    const colors = categoryColors[category] || { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };
                    return (
                      <div key={category}>
                        {/* Category header */}
                        <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${colors.bg} ${colors.border} border mb-2`}>
                          <span className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>{category}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>{items.length}</span>
                        </div>
                        {/* Alerts in this category */}
                        <div className="space-y-1.5">
                          {items.map((alert) => (
                            <div
                              key={alert.id}
                              className="border border-gray-100 rounded-lg p-2.5 hover:bg-gray-50 transition-colors cursor-pointer"
                              style={{ borderLeftWidth: 3, borderLeftColor: colorFor(alert.severity) }}
                              onClick={() => {
                                if (alert.jobId && onSelectJob) { onSelectJob(alert.jobId); onClose(); }
                              }}
                            >
                              <div className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: colorFor(alert.severity) }} />
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-semibold text-gray-900 truncate block">{alert.title}</span>
                                  {alert.description && (
                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{alert.description}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-1.5 pl-3.5" onClick={(e) => e.stopPropagation()}>
                                {alert.jobId && onSelectJob && (
                                  <button onClick={() => { onSelectJob(alert.jobId!); onClose(); }} className="text-[10px] px-2 py-0.5 bg-resilinc-primary text-white rounded hover:bg-resilinc-primary-dark transition-colors">View</button>
                                )}
                                <button onClick={() => dismiss(alert.id)} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded hover:bg-gray-200 transition-colors">Dismiss</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  });
              })()}
            </div>
          </>
        )}

        {/* Upcoming Tab */}
        {tab === "upcoming" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {upcoming.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">
                No upcoming deliveries in the next 3 days
              </div>
            )}
            {upcoming.map((job) => (
              <div
                key={job.id}
                className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor: daysUntil(job.eta!) === "Today" ? "#ef4444" : daysUntil(job.eta!) === "Tomorrow" ? "#eab308" : "#3b82f6",
                }}
                onClick={() => {
                  if (onSelectJob) {
                    onSelectJob(job.id);
                    onClose();
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-resilinc-primary">{job.ref}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    daysUntil(job.eta!) === "Today" ? "bg-red-100 text-red-700" :
                    daysUntil(job.eta!) === "Tomorrow" ? "bg-yellow-100 text-yellow-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>
                    {daysUntil(job.eta!)}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mt-1">{job.customer}</div>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span>ETA: {job.eta}</span>
                  {job.etd && <span>ETD: {job.etd}</span>}
                  <span className="ml-auto">
                    <Badge variant={job.status === "pending" ? "new" : "default"}>
                      {job.status}
                    </Badge>
                  </span>
                </div>
                {job.driverId && (
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Truck className="w-3 h-3" />
                    Assigned
                  </div>
                )}
                {!job.driverId && (
                  <div className="text-xs text-orange-600 mt-1 font-medium">
                    ⚠ Not assigned to transporter
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </aside>
    </>
  );
};
