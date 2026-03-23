// src/components/views/AdvancedAnalytics.tsx
import React, { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
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

const CHART_COLORS = [
  COLORS.primary,
  COLORS.secondary,
  COLORS.success,
  COLORS.warning,
  COLORS.danger,
  COLORS.info,
  COLORS.purple,
  COLORS.pink,
];

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
        outstandingQty: number;
        capacity: number;
        utilizationRate: number;
      }
    > = {};

    drivers.forEach((driver) => {
      metrics[driver.id] = {
        name: driver.name,
        totalJobs: 0,
        completedJobs: 0,
        inProgress: 0,
        palletsLoaded: 0,
        outstandingQty: 0,
        capacity: driver.capacity,
        utilizationRate: 0,
      };
    });

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
        }
        if (job.outstandingQty) {
          metrics[job.driverId].outstandingQty += job.outstandingQty;
        }
      }
    });

    // Calculate utilization rate
    Object.values(metrics).forEach((metric) => {
      if (metric.capacity > 0) {
        metric.utilizationRate = Math.round((metric.palletsLoaded / metric.capacity) * 100);
      }
    });

    return Object.values(metrics).filter((m) => m.totalJobs > 0);
  }, [filteredJobs, drivers]);

  // 2. Jobs by Status
  const jobsByStatus = useMemo(() => {
    const statusCount: Record<string, number> = {
      pending: 0,
      assigned: 0,
      "en-route": 0,
      delivered: 0,
      exception: 0,
      cancelled: 0,
    };

    filteredJobs.forEach((job) => {
      statusCount[job.status]++;
    });

    return Object.entries(statusCount)
      .map(([status, count]) => ({
        status: status.charAt(0).toUpperCase() + status.slice(1).replace("-", " "),
        count,
      }))
      .filter((item) => item.count > 0);
  }, [filteredJobs]);

  // 3. Pallet Analysis (by status)
  const quantityAnalysis = useMemo(() => {
    let total = 0, delivered = 0, pending = 0, inTransit = 0;

    filteredJobs.forEach((job) => {
      const p = job.pallets || 0;
      total += p;
      if (job.status === "delivered") delivered += p;
      else if (job.status === "pending" || job.status === "assigned") pending += p;
      else if (job.status === "en-route") inTransit += p;
    });

    return [
      { category: "Total", value: total, fill: "#3B82F6" },
      { category: "Delivered", value: delivered, fill: "#10B981" },
      { category: "In Transit", value: inTransit, fill: "#F59E0B" },
      { category: "Pending", value: pending, fill: "#8B5CF6" },
    ];
  }, [filteredJobs]);

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

  // 6. Priority Distribution
  const priorityDistribution = useMemo(() => {
    const distribution: Record<string, number> = {
      urgent: 0,
      high: 0,
      normal: 0,
      low: 0,
    };

    filteredJobs.forEach((job) => {
      distribution[job.priority]++;
    });

    return Object.entries(distribution)
      .map(([priority, count]) => ({
        priority: priority.charAt(0).toUpperCase() + priority.slice(1),
        count,
      }))
      .filter((item) => item.count > 0);
  }, [filteredJobs]);

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

      {/* Charts Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Transporter Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Transporter Performance</CardTitle>
            <p className="text-xs text-gray-400 mt-0.5">Delivered vs assigned/en-route orders per transporter</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={transporterMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar dataKey="completedJobs" fill={COLORS.success} name="Delivered" />
                <Bar dataKey="inProgress" fill={COLORS.warning} name="Assigned / En Route" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Jobs by Status — donut with legend */}
        <Card>
          <CardHeader>
            <CardTitle>Jobs by Status</CardTitle>
            <p className="text-sm text-gray-500">Distribution of job statuses</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={jobsByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="status"
                >
                  {jobsByStatus.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "8px" }}
                />
                <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pallets Loaded by Transporter */}
        <Card>
          <CardHeader>
            <CardTitle>Pallets Loaded by Transporter</CardTitle>
            <p className="text-xs text-gray-400 mt-0.5">Total pallets handled by each transporter</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={transporterMetrics} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="palletsLoaded" fill={COLORS.primary} name="Pallets Loaded" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pallet Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Pallet Analysis</CardTitle>
            <p className="text-xs text-gray-400 mt-0.5">Pallets by delivery status</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={quantityAnalysis}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="value" name="Pallets">
                  {quantityAnalysis.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Jobs Timeline */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Jobs Frequency Timeline</CardTitle>
            <p className="text-xs text-gray-400 mt-0.5">Daily jobs created vs delivered</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
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
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="created"
                  stroke={COLORS.primary}
                  fillOpacity={1}
                  fill="url(#colorCreated)"
                  name="Jobs Created"
                />
                <Area
                  type="monotone"
                  dataKey="delivered"
                  stroke={COLORS.success}
                  fillOpacity={1}
                  fill="url(#colorDelivered)"
                  name="Jobs Delivered"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Warehouse Distribution — donut with legend */}
        <Card>
          <CardHeader>
            <CardTitle>Warehouse Distribution</CardTitle>
            <p className="text-sm text-gray-500">Jobs by warehouse location</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={warehouseDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  fill="#8884d8"
                  dataKey="count"
                  nameKey="warehouse"
                >
                  {warehouseDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "8px" }}
                />
                <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Priority Distribution</CardTitle>
            <p className="text-xs text-gray-400 mt-0.5">Jobs by priority level</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={priorityDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="priority" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="count" fill={COLORS.danger} name="Jobs" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Capacity Utilization */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Transporter Capacity Utilization</CardTitle>
            <p className="text-xs text-gray-400 mt-0.5">
              Utilization rate by transporter (Pallets Loaded / Capacity)
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={transporterMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} label={{ value: "Utilization %", angle: -90, position: "insideLeft" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                  }}
                  formatter={(value: any) => `${value}%`}
                />
                <Bar dataKey="utilizationRate" fill={COLORS.info} name="Utilization Rate (%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Transporter Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Transporter Metrics</CardTitle>
          <p className="text-sm text-gray-600">Comprehensive performance breakdown by transporter</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Transporter</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Total Jobs</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Completed</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Assigned / En Route</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Pallets Loaded</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Outstanding Qty</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Capacity</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Utilization %</th>
                </tr>
              </thead>
              <tbody>
                {transporterMetrics.map((metric, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{metric.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{metric.totalJobs}</td>
                    <td className="px-4 py-3 text-sm text-green-600 font-semibold">{metric.completedJobs}</td>
                    <td className="px-4 py-3 text-sm text-orange-600">{metric.inProgress}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{metric.palletsLoaded}</td>
                    <td className="px-4 py-3 text-sm text-orange-600">{metric.outstandingQty}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{metric.capacity}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`font-semibold ${
                          metric.utilizationRate >= 80
                            ? "text-red-600"
                            : metric.utilizationRate >= 50
                            ? "text-orange-600"
                            : "text-green-600"
                        }`}
                      >
                        {metric.utilizationRate}%
                      </span>
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
