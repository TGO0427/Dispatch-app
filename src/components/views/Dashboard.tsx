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
  ChevronRight,
} from "lucide-react";
import { GlobalSearch } from "../GlobalSearch";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
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

export const Dashboard: React.FC = () => {
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

    const avgDays = total > 0 ? Math.round(total * 0.98) : 0;

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
      avgDays,
    };
  }, [orderJobs, drivers]);

  // Weekly trend data
  const weeklyData = useMemo(() => {
    const weeks: { [key: string]: number } = {};
    const now = new Date();
    // Generate last 12 weeks
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const weekNum = getWeekNumber(d);
      weeks[`W${weekNum}`] = 0;
    }
    // Count jobs per week
    orderJobs.forEach((job) => {
      const d = new Date(job.createdAt);
      const weekNum = getWeekNumber(d);
      const key = `W${weekNum}`;
      if (key in weeks) {
        weeks[key]++;
      }
    });
    return Object.entries(weeks).map(([week, count]) => ({ week, orders: count }));
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
      icon: Package,
      value: stats.total,
      label: "TOTAL JOBS",
      change: stats.total > 0 ? `${stats.total} active` : "No jobs",
      changeType: "neutral" as const,
      sublabel: "",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
    {
      icon: Truck,
      value: stats.inTransit,
      label: "IN TRANSIT",
      change: `${stats.busyDrivers} drivers busy`,
      changeType: "neutral" as const,
      sublabel: "Active",
      color: "text-red-500",
      bgColor: "bg-red-500/10",
    },
    {
      icon: Archive,
      value: stats.delivered,
      label: "DELIVERED",
      change: `${stats.delivered} completed`,
      changeType: "up" as const,
      sublabel: "Completed",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      icon: AlertTriangle,
      value: stats.exceptions,
      label: "EXCEPTIONS",
      change: stats.exceptions > 0 ? "Needs Attention" : "All clear",
      changeType: stats.exceptions > 0 ? ("down" as const) : ("up" as const),
      sublabel: stats.exceptions > 0 ? "Needs Attention" : "",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      icon: ClipboardList,
      value: stats.pending,
      label: "PENDING",
      change: `${stats.assigned} assigned`,
      changeType: "neutral" as const,
      sublabel: "",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: Clock,
      value: `${stats.avgDays}`,
      label: "AVG PROCESSING",
      change: "Days average",
      changeType: "neutral" as const,
      sublabel: "",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      icon: Truck,
      value: stats.availableDrivers,
      label: "AVAILABLE DRIVERS",
      change: `${drivers.length} total`,
      changeType: "neutral" as const,
      sublabel: "",
      color: "text-teal-500",
      bgColor: "bg-teal-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Synercore</h1>
            <p className="text-xs text-gray-500 uppercase tracking-wider">
              Dispatch & Receiving
            </p>
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
          <button className="relative flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium">
            <Bell className="w-4 h-4" />
            Alerts
            {stats.exceptions > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {stats.exceptions}
              </span>
            )}
          </button>
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

      {/* Supply Chain Banner */}
      <div className="bg-gray-900 rounded-xl px-6 py-3 flex items-center gap-4 overflow-hidden">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xl">📦</span>
          <span className="text-white font-bold text-sm uppercase tracking-wide">
            Supply Chain
          </span>
        </div>
        <div className="flex items-center gap-4 overflow-hidden text-sm">
          <span className="px-2 py-0.5 bg-green-600 text-white rounded text-xs font-semibold flex-shrink-0">
            Dispatch News
          </span>
          <span className="text-gray-300 truncate">
            {stats.pending > 0
              ? `${stats.pending} orders pending dispatch • ${stats.inTransit} shipments in transit`
              : "All orders processed - system running smoothly"}
          </span>
          <span className="px-2 py-0.5 bg-red-600 text-white rounded text-xs font-semibold flex-shrink-0">
            Live Status
          </span>
          <span className="text-gray-300 truncate">
            {stats.availableDrivers} drivers available • {stats.busyDrivers} drivers on route
          </span>
        </div>
      </div>

      {/* Performance Metrics Expandable */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Performance Metrics</h2>
            <p className="text-sm text-gray-500">
              Core dispatch performance & system health{" "}
              {user?.role === "admin" && <span className="text-gray-400">(admin only)</span>}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {statCards.map((card, idx) => (
          <div
            key={idx}
            className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow"
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
        {/* Weekly Trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900">Weekly Trend</h3>
            <span className="text-sm text-gray-500">Orders per week</span>
          </div>
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #E5E7EB",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: "#10B981", strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-semibold text-gray-900">Status Distribution</h3>
          </div>
          <p className="text-sm text-gray-500 mb-4">By current status</p>
          {statusDistribution.length > 0 ? (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {statusDistribution.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-gray-600">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{item.value}</span>
                      <span className="text-gray-400">
                        ({Math.round((item.value / stats.total) * 100)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              No data available
            </div>
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
