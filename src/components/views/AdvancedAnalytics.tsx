// src/components/views/AdvancedAnalytics.tsx
import React, { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { TrendingUp, Package, Truck, Calendar, BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { useDispatch } from "../../context/DispatchContext";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Select } from "../ui/Select";

const COLORS = {
  primary: "#0EA5E9",
  secondary: "#8B5CF6",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#06B6D4",
  purple: "#A855F7",
  pink: "#EC4899",
};


export const AdvancedAnalytics: React.FC = () => {
  const { jobs, drivers } = useDispatch();
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("7d");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");

  // Get unique warehouses
  const warehouses = useMemo(() => {
    const uniqueWarehouses = new Set<string>();
    jobs.forEach((job) => {
      if (job.warehouse) uniqueWarehouses.add(job.warehouse);
    });
    return Array.from(uniqueWarehouses).sort();
  }, [jobs]);

  // Filter jobs by time range
  const filteredJobs = useMemo(() => {
    const now = new Date();
    let cutoffDate: Date | null = null;

    if (timeRange === "7d") {
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeRange === "30d") {
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (timeRange === "90d") {
      cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    }

    // Filter by customer orders only (exclude IBT)
    let filtered = jobs.filter((j) => j.jobType === "order" || j.jobType === undefined);

    if (cutoffDate) {
      filtered = filtered.filter((job) => {
        const jobDate = new Date(job.createdAt);
        return jobDate >= cutoffDate;
      });
    }

    if (selectedWarehouse !== "all") {
      filtered = filtered.filter((job) => job.warehouse === selectedWarehouse);
    }

    // Deduplicate by ref — 1 order = 1 ASO number
    const refMap = new Map<string, typeof filtered[0]>();
    filtered.forEach((job) => {
      const existing = refMap.get(job.ref);
      if (!existing) {
        refMap.set(job.ref, { ...job });
      } else {
        // Aggregate: sum pallets and qty
        if (job.pallets) existing.pallets = (existing.pallets || 0) + job.pallets;
        if (job.outstandingQty) existing.outstandingQty = (existing.outstandingQty || 0) + job.outstandingQty;
      }
    });

    return Array.from(refMap.values());
  }, [jobs, timeRange, selectedWarehouse]);

  // 1. Transporter Performance Metrics
  const transporterMetrics = useMemo(() => {
    const metrics: Record<
      string,
      {
        name: string;
        totalJobs: number;
        completedJobs: number;
        inProgress: number;
        palletsLoaded: number;
        capacity: number;
        peakDayPallets: number;
        peakDayDate: string;
        peakUtilization: number;
      }
    > = {};

    drivers.forEach((driver) => {
      metrics[driver.id] = {
        name: driver.name,
        totalJobs: 0,
        completedJobs: 0,
        inProgress: 0,
        palletsLoaded: 0,
        capacity: driver.capacity,
        peakDayPallets: 0,
        peakDayDate: "",
        peakUtilization: 0,
      };
    });

    // Track pallets per driver per ETD date for capacity planning
    const dailyLoad: Record<string, Record<string, number>> = {}; // driverId -> { date -> pallets }

    filteredJobs.forEach((job) => {
      if (job.driverId && metrics[job.driverId]) {
        metrics[job.driverId].totalJobs++;
        if (job.status === "delivered") {
          metrics[job.driverId].completedJobs++;
        }
        if (job.status === "en-route" || job.status === "assigned") {
          metrics[job.driverId].inProgress++;
        }
        if (job.pallets) {
          metrics[job.driverId].palletsLoaded += job.pallets;

          // Track daily load by ETD date (or ETA if no ETD)
          const dateKey = (job.etd || job.eta || job.createdAt).split("T")[0];
          if (!dailyLoad[job.driverId]) dailyLoad[job.driverId] = {};
          dailyLoad[job.driverId][dateKey] = (dailyLoad[job.driverId][dateKey] || 0) + job.pallets;
        }
      }
    });

    // Calculate peak day utilization per transporter
    Object.entries(dailyLoad).forEach(([driverId, dates]) => {
      if (!metrics[driverId]) return;
      let peakPallets = 0;
      let peakDate = "";
      Object.entries(dates).forEach(([date, pallets]) => {
        if (pallets > peakPallets) {
          peakPallets = pallets;
          peakDate = date;
        }
      });
      metrics[driverId].peakDayPallets = peakPallets;
      metrics[driverId].peakDayDate = peakDate;
      if (metrics[driverId].capacity > 0) {
        metrics[driverId].peakUtilization = Math.round((peakPallets / metrics[driverId].capacity) * 100);
      }
    });

    return Object.values(metrics).filter((m) => m.totalJobs > 0);
  }, [filteredJobs, drivers]);

  // 2. (Removed — Jobs by Status donut replaced with trend chart)


  // 4. Jobs Frequency Timeline (Daily) — already deduplicated via filteredJobs
  const jobsTimeline = useMemo(() => {
    const timeline: Record<string, { date: string; created: number; delivered: number }> = {};

    filteredJobs.forEach((job) => {
      const createdDate = new Date(job.createdAt).toISOString().split("T")[0];
      if (!timeline[createdDate]) {
        timeline[createdDate] = { date: createdDate, created: 0, delivered: 0 };
      }
      timeline[createdDate].created++;

      if (job.status === "delivered" && job.actualDeliveryAt) {
        const deliveredDate = new Date(job.actualDeliveryAt).toISOString().split("T")[0];
        if (!timeline[deliveredDate]) {
          timeline[deliveredDate] = { date: deliveredDate, created: 0, delivered: 0 };
        }
        timeline[deliveredDate].delivered++;
      }
    });

    return Object.values(timeline).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredJobs]);

  // 5. Warehouse Distribution
  const warehouseDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};

    filteredJobs.forEach((job) => {
      const warehouse = job.warehouse || "Unknown";
      distribution[warehouse] = (distribution[warehouse] || 0) + 1;
    });

    return Object.entries(distribution).map(([warehouse, count]) => ({
      warehouse,
      count,
    }));
  }, [filteredJobs]);

  // 6. Items Picked This Week (daily breakdown using ALL jobs, not deduplicated)
  const itemsPickedThisWeek = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const days: { day: string; picked: number; delivered: number }[] = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      let picked = 0;
      let delivered = 0;
      // Use ALL order jobs (not deduplicated) — count each line item
      jobs.filter((j) => j.jobType === "order" || j.jobType === undefined).forEach((j) => {
        const jobDate = (j.etd || j.eta || "").split("T")[0];
        if (jobDate === dateKey) {
          if (j.orderPicked) picked++;
          if (j.status === "delivered") delivered++;
        }
      });

      days.push({ day: `${dayNames[i]} ${d.getDate()}`, picked, delivered });
    }
    return days;
  }, [jobs]);



  // Key Performance Indicators
  const kpis = useMemo(() => {
    const totalJobs = filteredJobs.length;
    const deliveredJobs = filteredJobs.filter((j) => j.status === "delivered").length;
    const exceptionsCount = filteredJobs.filter((j) => j.status === "exception").length;
    const deliveryRate = totalJobs > 0 ? Math.round((deliveredJobs / totalJobs) * 100) : 0;
    const exceptionRate = totalJobs > 0 ? Math.round((exceptionsCount / totalJobs) * 100) : 0;

    return {
      totalJobs,
      deliveredJobs,
      deliveryRate,
      exceptionsCount,
      exceptionRate,
      activeTransporters: drivers.filter((d) => d.status !== "offline").length,
    };
  }, [filteredJobs, drivers]);

  return (
    <div className="space-y-4">
      {/* Header — compact with filters inline */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500">
            Performance insights • {kpis.totalJobs} jobs • {timeRange === "all" ? "All time" : `Last ${timeRange === "7d" ? "7 days" : timeRange === "30d" ? "30 days" : "90 days"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)} className="w-auto text-sm">
            <option value="all">All Warehouses</option>
            {warehouses.map((wh) => <option key={wh} value={wh}>{wh}</option>)}
          </Select>
          <Select value={timeRange} onChange={(e) => setTimeRange(e.target.value as "7d" | "30d" | "90d" | "all")} className="w-auto text-sm">
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
            <option value="90d">90 Days</option>
            <option value="all">All Time</option>
          </Select>
        </div>
      </div>

      {/* KPI Strip — tighter, stronger hierarchy */}
      <div className="grid gap-3 grid-cols-3 lg:grid-cols-6">
        {([
          { icon: Package, label: "Total Jobs", value: String(kpis.totalJobs), color: "text-gray-900", iconColor: "text-blue-600", bg: "bg-blue-50" },
          { icon: TrendingUp, label: "Delivered", value: String(kpis.deliveredJobs), color: "text-green-600", iconColor: "text-green-600", bg: "bg-green-50" },
          { icon: BarChart3, label: "Delivery Rate", value: `${kpis.deliveryRate}%`, color: "text-green-600", iconColor: "text-green-600", bg: "bg-green-50" },
          { icon: Calendar, label: "Exceptions", value: String(kpis.exceptionsCount), color: "text-red-600", iconColor: "text-red-600", bg: "bg-red-50" },
          { icon: PieChartIcon, label: "Exception Rate", value: `${kpis.exceptionRate}%`, color: "text-amber-600", iconColor: "text-amber-600", bg: "bg-amber-50" },
          { icon: Truck, label: "Transporters", value: String(kpis.activeTransporters), color: "text-gray-900", iconColor: "text-gray-600", bg: "bg-gray-100" },
        ] as const).map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="p-3">
              <div className="flex items-center gap-2.5">
                <div className={`rounded-lg p-1.5 ${kpi.bg}`}>
                  <Icon className={`h-4 w-4 ${kpi.iconColor}`} />
                </div>
                <div>
                  <div className={`text-xl font-bold leading-tight ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{kpi.label}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Row 1: Hero Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Transporter Workload & Delivery */}
        <Card>
          <CardHeader>
            <CardTitle>Transporter Workload</CardTitle>
            <p className="text-xs text-gray-400 mt-0.5">Delivered vs assigned/en-route + pallet load per transporter</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={transporterMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "8px" }} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="completedJobs" fill={COLORS.success} name="Delivered" radius={[3, 3, 0, 0]} />
                <Bar dataKey="inProgress" fill={COLORS.warning} name="Assigned / En Route" radius={[3, 3, 0, 0]} />
                <Bar dataKey="palletsLoaded" fill={COLORS.primary} name="Pallets" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Job Status Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Job Status Trend</CardTitle>
            <p className="text-xs text-gray-400 mt-0.5">Daily jobs created vs delivered</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={jobsTimeline}>
                <defs>
                  <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.8} />
                    <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "8px" }} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Area type="monotone" dataKey="created" stroke={COLORS.primary} fillOpacity={1} fill="url(#colorCreated)" name="Created" />
                <Area type="monotone" dataKey="delivered" stroke={COLORS.success} fillOpacity={1} fill="url(#colorDelivered)" name="Delivered" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Supporting Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Items Picked This Week */}
        <Card>
          <CardHeader>
            <CardTitle>Items Picked This Week</CardTitle>
            <p className="text-xs text-gray-400 mt-0.5">Line items picked and delivered per day</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={itemsPickedThisWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "8px" }} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="picked" fill={COLORS.success} name="Picked" radius={[3, 3, 0, 0]} />
                <Bar dataKey="delivered" fill={COLORS.primary} name="Delivered" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Warehouse Volume — bar chart instead of donut */}
        <Card>
          <CardHeader>
            <CardTitle>Warehouse Volume</CardTitle>
            <p className="text-xs text-gray-400 mt-0.5">Orders per warehouse location</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={warehouseDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="warehouse" type="category" tick={{ fontSize: 10 }} width={120} />
                <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "8px" }} />
                <Bar dataKey="count" fill={COLORS.primary} name="Orders" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Exceptions & Bottlenecks */}
      <Card>
        <CardHeader>
          <CardTitle>Exceptions & Bottlenecks</CardTitle>
          <p className="text-xs text-gray-400 mt-0.5">Orders that need attention right now</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
            {(() => {
              const now = new Date(); now.setHours(0, 0, 0, 0);
              const overdue = filteredJobs.filter(j => j.eta && j.status !== "delivered" && j.status !== "cancelled" && new Date(j.eta) < now).length;
              const unassigned = filteredJobs.filter(j => !j.driverId && j.status === "pending").length;
              const missingCoa = filteredJobs.filter(j => j.orderPicked && !j.coaAvailable && j.status !== "delivered" && j.status !== "cancelled").length;
              const noTransporter = filteredJobs.filter(j => !j.transporterBooked && j.status !== "delivered" && j.status !== "cancelled" && j.status !== "pending").length;
              const overCapacity = transporterMetrics.filter(m => m.peakUtilization > 100).length;
              return [
                { label: "Overdue Orders", value: overdue, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
                { label: "Unassigned Orders", value: unassigned, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
                { label: "Missing COA", value: missingCoa, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
                { label: "No Transporter Booked", value: noTransporter, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
                { label: "Over Capacity", value: overCapacity, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
              ].map((item) => (
                <div key={item.label} className={`${item.bg} ${item.border} border rounded-xl p-4 text-center`}>
                  <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mt-1">{item.label}</div>
                </div>
              ));
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Row 4: Capacity Planning */}
      <Card>
        <CardHeader>
          <CardTitle>Capacity Planning</CardTitle>
          <p className="text-xs text-gray-400 mt-0.5">Peak day pallet load vs daily capacity per transporter</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={transporterMetrics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "8px" }} formatter={(value: number) => [`${value} plt`]} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="peakDayPallets" fill={COLORS.warning} name="Peak Day Load" radius={[3, 3, 0, 0]} />
              <Bar dataKey="capacity" fill={COLORS.primary} name="Daily Capacity" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed Transporter Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Transporter Metrics</CardTitle>
          <p className="text-xs text-gray-400 mt-0.5">Performance and daily capacity utilization by transporter</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Transporter</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Orders</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Delivered</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">In Transit</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Total Pallets</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Daily Capacity</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Peak Day</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">Peak Utilization</th>
                </tr>
              </thead>
              <tbody>
                {transporterMetrics.map((metric, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{metric.name}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{metric.totalJobs}</td>
                    <td className="px-4 py-3 text-center text-green-600 font-semibold">{metric.completedJobs}</td>
                    <td className="px-4 py-3 text-center text-blue-600">{metric.inProgress}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{metric.palletsLoaded}</td>
                    <td className="px-4 py-3 text-center text-gray-700">{metric.capacity} plt/day</td>
                    <td className="px-4 py-3 text-center">
                      {metric.peakDayDate ? (
                        <div>
                          <span className="font-medium text-gray-900">{metric.peakDayPallets} plt</span>
                          <span className="text-[10px] text-gray-400 block">{metric.peakDayDate}</span>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold ${
                        metric.peakUtilization > 100 ? "text-red-600" :
                        metric.peakUtilization >= 80 ? "text-amber-600" :
                        "text-green-600"
                      }`}>
                        {metric.peakUtilization}%
                      </span>
                      {metric.peakUtilization > 100 && (
                        <span className="text-[10px] text-red-500 block">Over capacity</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
