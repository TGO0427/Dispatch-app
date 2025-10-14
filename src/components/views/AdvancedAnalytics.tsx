// src/components/views/AdvancedAnalytics.tsx
import React, { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
import { Job, Driver } from "../../types";

// Color palette for charts
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
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
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

    let filtered = jobs;

    if (cutoffDate) {
      filtered = filtered.filter((job) => {
        const jobDate = new Date(job.createdAt);
        return jobDate >= cutoffDate;
      });
    }

    if (selectedWarehouse !== "all") {
      filtered = filtered.filter((job) => job.warehouse === selectedWarehouse);
    }

    return filtered;
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

  // 3. Quantity Analysis (Pallets & Outstanding)
  const quantityAnalysis = useMemo(() => {
    const totals = {
      totalPallets: 0,
      totalOutstanding: 0,
      deliveredPallets: 0,
      pendingPallets: 0,
    };

    filteredJobs.forEach((job) => {
      if (job.pallets) {
        totals.totalPallets += job.pallets;
        if (job.status === "delivered") {
          totals.deliveredPallets += job.pallets;
        } else if (job.status === "pending" || job.status === "assigned") {
          totals.pendingPallets += job.pallets;
        }
      }
      if (job.outstandingQty) {
        totals.totalOutstanding += job.outstandingQty;
      }
    });

    return [
      { category: "Total Pallets", value: totals.totalPallets },
      { category: "Delivered", value: totals.deliveredPallets },
      { category: "Pending", value: totals.pendingPallets },
      { category: "Outstanding Qty", value: totals.totalOutstanding },
    ];
  }, [filteredJobs]);

  // 4. Jobs Frequency Timeline (Daily)
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
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-900">Advanced Analytics</h1>
            <p className="text-gray-600">
              Comprehensive insights into transporter performance, quantities, and trends
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)}>
              <option value="all">All Warehouses</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse} value={warehouse}>
                  {warehouse}
                </option>
              ))}
            </Select>
            <Select value={timeRange} onChange={(e) => setTimeRange(e.target.value as any)}>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="all">All Time</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{kpis.totalJobs}</div>
              <div className="text-xs text-gray-600">Total Jobs</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{kpis.deliveredJobs}</div>
              <div className="text-xs text-gray-600">Delivered</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2">
              <BarChart3 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{kpis.deliveryRate}%</div>
              <div className="text-xs text-gray-600">Delivery Rate</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-100 p-2">
              <Calendar className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{kpis.exceptionsCount}</div>
              <div className="text-xs text-gray-600">Exceptions</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2">
              <PieChartIcon className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{kpis.exceptionRate}%</div>
              <div className="text-xs text-gray-600">Exception Rate</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-100 p-2">
              <Truck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{kpis.activeTransporters}</div>
              <div className="text-xs text-gray-600">Active Transporters</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Transporter Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Transporter Performance</CardTitle>
            <p className="text-sm text-gray-600">Jobs completed and capacity utilization by transporter</p>
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
                <Bar dataKey="completedJobs" fill={COLORS.success} name="Completed Jobs" />
                <Bar dataKey="inProgress" fill={COLORS.warning} name="In Progress" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Jobs by Status */}
        <Card>
          <CardHeader>
            <CardTitle>Jobs by Status</CardTitle>
            <p className="text-sm text-gray-600">Distribution of job statuses</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={jobsByStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, count }) => `${status}: ${count}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {jobsByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pallets Loaded by Transporter */}
        <Card>
          <CardHeader>
            <CardTitle>Pallets Loaded by Transporter</CardTitle>
            <p className="text-sm text-gray-600">Total pallets handled by each transporter</p>
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
                <Legend />
                <Bar dataKey="palletsLoaded" fill={COLORS.primary} name="Pallets Loaded" />
                <Bar dataKey="outstandingQty" fill={COLORS.warning} name="Outstanding Qty" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quantity Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Quantity Analysis</CardTitle>
            <p className="text-sm text-gray-600">Breakdown of pallets and outstanding quantities</p>
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
                <Bar dataKey="value" fill={COLORS.secondary} name="Quantity" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Jobs Timeline */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Jobs Frequency Timeline</CardTitle>
            <p className="text-sm text-gray-600">Daily jobs created vs delivered</p>
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

        {/* Warehouse Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Warehouse Distribution</CardTitle>
            <p className="text-sm text-gray-600">Jobs by warehouse location</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={warehouseDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ warehouse, count }) => `${warehouse}: ${count}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {warehouseDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Priority Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Priority Distribution</CardTitle>
            <p className="text-sm text-gray-600">Jobs by priority level</p>
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
            <p className="text-sm text-gray-600">
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
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">In Progress</th>
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
