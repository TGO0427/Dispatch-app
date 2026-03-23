import React, { useMemo } from "react";
import {
  Package,
  Truck,
  Archive,
  AlertTriangle,
  ClipboardList,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Bell,
} from "lucide-react";
import { GlobalSearch } from "../GlobalSearch";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useDispatch } from "../../context/DispatchContext";
import { useAuth } from "../../context/AuthContext";

// Helper to get week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

interface DashboardProps {
  onOpenAlerts?: () => void;
  onNavigate?: (page: string, tab?: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenAlerts, onNavigate }) => {
  const { jobs, drivers } = useDispatch();
  const { user } = useAuth();

  // Filter to order jobs only
  const orderJobs = useMemo(() => {
    return jobs.filter((j) => j.jobType === "order" || j.jobType === undefined);
  }, [jobs]);

  // Stats - count unique order refs (ASO numbers), not individual line items
  const stats = useMemo(() => {
    // Helper: count unique refs matching a filter
    const uniqueRefs = (filter?: (j: typeof orderJobs[0]) => boolean) => {
      const refs = new Set<string>();
      orderJobs.forEach((j) => {
        if (!filter || filter(j)) refs.add(j.ref);
      });
      return refs.size;
    };

    const total = uniqueRefs();
    const pending = uniqueRefs((j) => j.status === "pending");
    const assigned = uniqueRefs((j) => j.status === "assigned");
    const inTransit = uniqueRefs((j) => j.status === "en-route");
    const delivered = uniqueRefs((j) => j.status === "delivered");
    const exceptions = uniqueRefs((j) => j.status === "exception");
    const cancelled = uniqueRefs((j) => j.status === "cancelled");
    const availableDrivers = drivers.filter((d) => d.status === "available").length;
    const busyDrivers = drivers.filter((d) => d.status === "busy").length;

    // Count orders with ETD this week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const departuresThisWeek = new Set<string>();
    let palletsThisWeek = 0;
    let weightThisWeek = 0;
    orderJobs.forEach((j) => {
      // Use ETD if available, otherwise ETA for current week calculation
      const dispatchDate = j.etd || j.eta;
      if (dispatchDate) {
        const d = new Date(dispatchDate);
        if (d >= startOfWeek && d < endOfWeek) {
          palletsThisWeek += j.pallets || 0;
          weightThisWeek += j.outstandingQty || 0;
        }
      }
      if (j.etd) {
        const etdDate = new Date(j.etd);
        if (etdDate >= startOfWeek && etdDate < endOfWeek) {
          departuresThisWeek.add(j.ref);
        }
      }
    });

    // Alert count: use ALL jobs (not date-filtered) so overdue orders aren't missed
    let alertCount = 0;
    const alertRefSeen = new Set<string>();
    jobs.filter((j) => j.jobType === "order" || j.jobType === undefined).forEach((j) => {
      if (alertRefSeen.has(j.ref)) return;
      alertRefSeen.add(j.ref);
      if (j.status === "exception") alertCount++;
      if (j.eta && j.status !== "delivered" && j.status !== "cancelled") {
        const eta = new Date(j.eta); eta.setHours(0, 0, 0, 0);
        if (eta < now) alertCount++;
      }
      if (j.etd && j.status !== "delivered" && j.status !== "cancelled" && j.status !== "en-route") {
        const etd = new Date(j.etd); etd.setHours(0, 0, 0, 0);
        if (Math.floor((etd.getTime() - now.getTime()) / 86400000) <= 1) alertCount++;
      }
      if ((j.priority === "urgent" || j.priority === "high") && j.status === "pending") alertCount++;
    });

    // High volume date achievements: current month only
    // Dates with 5+ orders where 95%+ are delivered or picked
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const dateCounts: Record<string, { total: number; completed: number }> = {};
    jobs.filter((j) => j.jobType === "order" || j.jobType === undefined).forEach((j) => {
      if (!j.eta) return;
      const dateKey = j.eta.split("T")[0];
      const etaDate = new Date(dateKey);
      // Only current month
      if (etaDate < startOfMonth || etaDate > endOfMonth) return;
      if (!dateCounts[dateKey]) dateCounts[dateKey] = { total: 0, completed: 0 };
      dateCounts[dateKey].total++;
      if (j.status === "delivered" || j.orderPicked) dateCounts[dateKey].completed++;
    });
    const highVolumeWins = Object.entries(dateCounts)
      .filter(([, c]) => c.total >= 5 && c.completed / c.total >= 0.95)
      .map(([date, c]) => ({ date, total: c.total, completed: c.completed, pct: Math.round((c.completed / c.total) * 100) }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3);

    return {
      total,
      pending,
      assigned,
      inTransit,
      delivered,
      exceptions,
      cancelled,
      availableDrivers,
      busyDrivers,
      departuresThisWeek: departuresThisWeek.size,
      palletsThisWeek,
      weightThisWeek,
      alertCount,
      highVolumeWins,
    };
  }, [orderJobs, jobs, drivers]);

  // Weekly trend data
  const weeklyData = useMemo(() => {
    const weeks: Record<string, { week: string; created: number; delivered: number; pending: number }> = {};
    const now = new Date();
    // Last 8 weeks only
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const weekNum = getWeekNumber(d);
      const key = `W${weekNum}`;
      weeks[key] = { week: key, created: 0, delivered: 0, pending: 0 };
    }
    // Count unique orders per week by status
    const seenCreated = new Set<string>();
    const seenDelivered = new Set<string>();
    const seenPending = new Set<string>();
    orderJobs.forEach((job) => {
      const weekNum = getWeekNumber(new Date(job.createdAt));
      const key = `W${weekNum}`;
      if (!(key in weeks)) return;
      const refKey = `${job.ref}-${key}`;
      if (!seenCreated.has(refKey)) { seenCreated.add(refKey); weeks[key].created++; }
      if (job.status === "delivered" && !seenDelivered.has(refKey)) { seenDelivered.add(refKey); weeks[key].delivered++; }
      if ((job.status === "pending" || job.status === "assigned") && !seenPending.has(refKey)) { seenPending.add(refKey); weeks[key].pending++; }
    });
    return Object.values(weeks);
  }, [orderJobs]);

  // Status distribution
  const statusDistribution = useMemo(() => {
    return [
      { name: "Pending", value: stats.pending, color: "#F59E0B" },
      { name: "In Transit", value: stats.inTransit, color: "#3B82F6" },
      { name: "Delivered", value: stats.delivered, color: "#10B981" },
      { name: "Exceptions", value: stats.exceptions, color: "#EF4444" },
    ].filter((item) => item.value > 0);
  }, [stats]);

  // By warehouse
  const warehouseData = useMemo(() => {
    const wh: { [key: string]: number } = {};
    orderJobs.forEach((job) => {
      const warehouse = job.warehouse || "Unassigned";
      wh[warehouse] = (wh[warehouse] || 0) + 1;
    });
    return Object.entries(wh)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [orderJobs]);

  // Top customers - count unique order references (ASO numbers), not line items
  const topCustomers = useMemo(() => {
    const customerOrders: { [customer: string]: Set<string> } = {};
    orderJobs.forEach((job) => {
      if (job.customer && job.ref) {
        if (!customerOrders[job.customer]) {
          customerOrders[job.customer] = new Set();
        }
        customerOrders[job.customer].add(job.ref);
      }
    });
    return Object.entries(customerOrders)
      .map(([name, refs]) => ({ name, count: refs.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [orderJobs]);

  const statCards = [
    {
      icon: Package, value: stats.total, label: "TOTAL JOBS",
      change: stats.total > 0 ? `${stats.total} active` : "No jobs", changeType: "neutral" as const, sublabel: "",
      color: "text-yellow-500", bgColor: "bg-yellow-500/10", nav: "clipboard", tab: "open",
    },
    {
      icon: Truck, value: stats.inTransit, label: "IN TRANSIT",
      change: `${stats.busyDrivers} drivers busy`, changeType: "neutral" as const, sublabel: "Active",
      color: "text-red-500", bgColor: "bg-red-500/10", nav: "clipboard", tab: "assigned",
    },
    {
      icon: Archive, value: stats.delivered, label: "DELIVERED",
      change: `${stats.delivered} completed`, changeType: "up" as const, sublabel: "Completed",
      color: "text-green-500", bgColor: "bg-green-500/10", nav: "clock", tab: undefined,
    },
    {
      icon: AlertTriangle, value: stats.exceptions, label: "EXCEPTIONS",
      change: stats.exceptions > 0 ? "Needs Attention" : "All clear",
      changeType: stats.exceptions > 0 ? ("down" as const) : ("up" as const),
      sublabel: stats.exceptions > 0 ? "Needs Attention" : "",
      color: "text-orange-500", bgColor: "bg-orange-500/10", nav: "clipboard", tab: "open",
    },
    {
      icon: ClipboardList, value: stats.pending, label: "PENDING",
      change: `${stats.assigned} assigned`, changeType: "neutral" as const, sublabel: "",
      color: "text-blue-500", bgColor: "bg-blue-500/10", nav: "clipboard", tab: "open",
    },
    {
      icon: Clock, value: stats.departuresThisWeek, label: "ETD THIS WEEK",
      change: "Departures scheduled",
      changeType: stats.departuresThisWeek > 0 ? "up" as const : "neutral" as const,
      sublabel: stats.departuresThisWeek > 5 ? "Busy Week" : "",
      color: "text-purple-500", bgColor: "bg-purple-500/10", nav: "calendar", tab: undefined,
    },
    {
      icon: Truck, value: stats.availableDrivers, label: "AVAILABLE DRIVERS",
      change: `${drivers.length} total`, changeType: "neutral" as const, sublabel: "",
      color: "text-teal-500", bgColor: "bg-teal-500/10", nav: "clipboard", tab: "open",
    },
    {
      icon: Package, value: stats.palletsThisWeek, label: "PALLETS THIS WEEK",
      change: "To dispatch",
      changeType: stats.palletsThisWeek > 0 ? "up" as const : "neutral" as const, sublabel: "",
      color: "text-indigo-500", bgColor: "bg-indigo-500/10", nav: "clipboard", tab: "open",
    },
    {
      icon: Archive, value: stats.weightThisWeek.toLocaleString(), label: "WEIGHT THIS WEEK",
      change: "Qty to dispatch",
      changeType: stats.weightThisWeek > 0 ? "up" as const : "neutral" as const, sublabel: "",
      color: "text-cyan-500", bgColor: "bg-cyan-500/10", nav: "clipboard", tab: "open",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">K58 Dispatch</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Global Search */}
          <GlobalSearch />

          {/* User */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>
              Logged in as: <strong className="text-gray-900">{user?.username}</strong>
            </span>
          </div>

          {/* Alerts */}
          {onOpenAlerts && (
            <button
              onClick={onOpenAlerts}
              className="relative flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
            >
              <Bell className="w-4 h-4" />
              Alerts
              {stats.alertCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {stats.alertCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 rounded-full transition-all duration-1000"
          style={{
            width: `${stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0}%`,
          }}
        />
      </div>

      {/* Live Status Strip — simplified */}
      <div className="bg-gray-900 rounded-xl px-5 py-2.5 flex items-center gap-3 text-xs">
        <span className="text-gray-300">
          {stats.pending > 0 ? `${stats.pending} pending` : "All processed"} • {stats.inTransit} in transit • {stats.availableDrivers} drivers available
        </span>
        {stats.highVolumeWins.length > 0 && (
          <>
            <span className="w-px h-4 bg-gray-700" />
            <span className="text-emerald-400">
              {stats.highVolumeWins.map((w) => `${w.date}: ${w.pct}%`).join(" • ")}
            </span>
          </>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-4">
        {statCards.map((card, idx) => (
          <div
            key={idx}
            className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer active:scale-[0.97]"
            onClick={() => onNavigate?.(card.nav, card.tab)}
          >
            <div className={`inline-flex p-1.5 rounded-lg ${card.bgColor} mb-2`}>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{card.value}</div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mt-0.5">
              {card.label}
            </div>
            <div className="flex items-center gap-1 mt-2">
              {card.changeType === "up" && <TrendingUp className="w-3 h-3 text-green-500" />}
              {card.changeType === "down" && <TrendingDown className="w-3 h-3 text-red-500" />}
              {card.changeType === "neutral" && <Minus className="w-3 h-3 text-gray-400" />}
              <span
                className={`text-xs ${
                  card.changeType === "up"
                    ? "text-green-600"
                    : card.changeType === "down"
                    ? "text-red-600"
                    : "text-gray-500"
                }`}
              >
                {card.change}
              </span>
            </div>
            {card.sublabel && (
              <span
                className={`inline-block mt-1 text-[10px] font-medium ${
                  card.sublabel === "Needs Attention"
                    ? "text-orange-600"
                    : card.sublabel === "Completed"
                    ? "text-green-600"
                    : card.sublabel === "Active"
                    ? "text-blue-600"
                    : "text-gray-500"
                }`}
              >
                {card.sublabel}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Trend — bar chart with created/delivered/pending */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900">Weekly Trend</h3>
            <span className="text-sm text-gray-500">Last 8 weeks</span>
          </div>
          <div className="h-64 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                <YAxis tick={{ fontSize: 11 }} stroke="#9CA3AF" allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #E5E7EB" }} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="created" fill="#3B82F6" name="Created" radius={[3, 3, 0, 0]} />
                <Bar dataKey="delivered" fill="#10B981" name="Delivered" radius={[3, 3, 0, 0]} />
                <Bar dataKey="pending" fill="#F59E0B" name="Pending" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Overview — horizontal bars */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Status Overview</h3>
          </div>
          {statusDistribution.length > 0 ? (
            <div className="space-y-3">
              {statusDistribution.map((item, idx) => {
                const pct = stats.total > 0 ? Math.round((item.value / stats.total) * 100) : 0;
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-gray-700">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">{item.value}</span>
                        <span className="text-xs text-gray-400">{pct}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">No data</div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Warehouse */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold text-gray-900">By Warehouse</h3>
            <span className="text-sm text-gray-500">{warehouseData.length} locations</span>
          </div>
          {warehouseData.length > 0 ? (
            <div className="space-y-3">
              {warehouseData.map((wh, idx) => {
                const maxCount = warehouseData[0]?.count || 1;
                const pct = (wh.count / maxCount) * 100;
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700 uppercase">
                        {wh.name}
                      </span>
                      <span className="text-sm text-gray-500">{wh.count}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
              No warehouse data
            </div>
          )}
        </div>

        {/* Top Customers */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Top Customers</h3>
            <span className="text-sm text-gray-500">By order volume</span>
          </div>
          {topCustomers.length > 0 ? (
            <div className="space-y-3">
              {topCustomers.map((customer, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                        idx === 0
                          ? "bg-red-500"
                          : idx === 1
                          ? "bg-orange-500"
                          : idx === 2
                          ? "bg-yellow-500"
                          : "bg-gray-400"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{customer.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">{customer.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
              No customer data
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
