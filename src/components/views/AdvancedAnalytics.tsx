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
import { TrendingUp, Package, Truck, Calendar, BarChart3, PieChart as PieChartIcon, FileSpreadsheet, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useDispatch } from "../../context/DispatchContext";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { JobDetailsModal } from "../JobDetailsModal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import * as XLSX from "../../lib/spreadsheet";
import { formatDate, formatDateTime } from "../../utils/format";
import type { Job } from "../../types";

type TimeRange = "7d" | "30d" | "90d" | "current-month" | "previous-month" | "all";

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
  const { jobs, drivers, updateJobs } = useDispatch();
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [palletDrafts, setPalletDrafts] = useState<Record<string, string>>({});
  const [savingPalletRef, setSavingPalletRef] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedTransporterId, setSelectedTransporterId] = useState<string | null>(null);

  const getTimeRangeLabel = (range: TimeRange) => {
    const now = new Date();
    if (range === "7d") return "Last 7 days";
    if (range === "30d") return "Last 30 days";
    if (range === "90d") return "Last 90 days";
    if (range === "current-month") {
      return `Current month (${now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })})`;
    }
    if (range === "previous-month") {
      const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `Previous month (${previousMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" })})`;
    }
    return "All time";
  };

  const getTimeRangeBounds = (range: TimeRange) => {
    const now = new Date();
    if (range === "7d") return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: null };
    if (range === "30d") return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: null };
    if (range === "90d") return { start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), end: null };
    if (range === "current-month") {
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999),
      };
    }
    if (range === "previous-month") {
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      };
    }
    return { start: null, end: null };
  };

  // Get unique warehouses
  const warehouses = useMemo(() => {
    const uniqueWarehouses = new Set<string>();
    jobs.forEach((job) => {
      if (job.warehouse) uniqueWarehouses.add(job.warehouse);
    });
    return Array.from(uniqueWarehouses).sort();
  }, [jobs]);

  // Filter jobs by time range
  const scopedOrderJobs = useMemo(() => {
    const { start, end } = getTimeRangeBounds(timeRange);

    // Filter by customer orders only (exclude IBT)
    let filtered = jobs.filter((j) => j.jobType === "order" || j.jobType === undefined);

    if (start || end) {
      filtered = filtered.filter((job) => {
        const jobDate = new Date(job.createdAt);
        if (start && jobDate < start) return false;
        if (end && jobDate > end) return false;
        return true;
      });
    }

    if (selectedWarehouse !== "all") {
      filtered = filtered.filter((job) => job.warehouse === selectedWarehouse);
    }

    // Deduplicate by ref — 1 order = 1 ASO number
    return filtered;
  }, [jobs, timeRange, selectedWarehouse]);

  const filteredJobs = useMemo(() => {
    const refMap = new Map<string, typeof scopedOrderJobs[0]>();
    scopedOrderJobs.forEach((job) => {
      const existing = refMap.get(job.ref);
      if (!existing) {
        refMap.set(job.ref, { ...job });
      } else {
        // Pallets are order-level on imports, so duplicate line items should not multiply load.
        if (job.pallets) existing.pallets = Math.max(existing.pallets || 0, job.pallets);
        if (job.outstandingQty) existing.outstandingQty = (existing.outstandingQty || 0) + job.outstandingQty;
      }
    });

    return Array.from(refMap.values());
  }, [scopedOrderJobs]);

  const reportPeriodLabel = getTimeRangeLabel(timeRange);
  const pulledAtLabel = formatDateTime(new Date());

  // 1. Transporter Performance Metrics
  const transporterMetrics = useMemo(() => {
    const metrics: Record<
      string,
      {
        driverId: string;
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
        driverId: driver.id,
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

  const missingPalletAssignments = useMemo(() => {
    const grouped = new Map<
      string,
      {
        ref: string;
        customer: string;
        driverName: string;
        status: string;
        eta?: string;
        etd?: string;
        ids: string[];
        lineItems: number;
        maxPallets: number;
      }
    >();

    scopedOrderJobs.forEach((job) => {
      if (!job.driverId) return;
      const key = `${job.ref}::${job.driverId}`;
      const pallets = job.pallets && job.pallets > 0 ? job.pallets : 0;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          ref: job.ref,
          customer: job.customer,
          driverName: drivers.find((driver) => driver.id === job.driverId)?.name || "Unknown",
          status: job.status,
          eta: job.eta,
          etd: job.etd,
          ids: [job.id],
          lineItems: 1,
          maxPallets: pallets,
        });
      } else {
        existing.ids.push(job.id);
        existing.lineItems += 1;
        existing.maxPallets = Math.max(existing.maxPallets, pallets);
        if (!existing.etd && job.etd) existing.etd = job.etd;
        if (!existing.eta && job.eta) existing.eta = job.eta;
      }
    });

    return Array.from(grouped.values())
      .filter((item) => item.maxPallets <= 0)
      .sort((a, b) => (a.etd || a.eta || "").localeCompare(b.etd || b.eta || ""));
  }, [scopedOrderJobs, drivers]);

  const saveMissingPalletQty = async (ref: string, ids: string[]) => {
    const value = Number(palletDrafts[ref]);
    if (!Number.isFinite(value) || value <= 0) return;

    setSavingPalletRef(ref);
    try {
      await updateJobs(ids, { pallets: Math.round(value) });
      setPalletDrafts((prev) => {
        const next = { ...prev };
        delete next[ref];
        return next;
      });
    } finally {
      setSavingPalletRef(null);
    }
  };

  const openMissingPalletOrder = (ids: string[]) => {
    const job = scopedOrderJobs.find((item) => ids.includes(item.id));
    if (job) setSelectedJob(job);
  };

  const selectedTransporterJobs = useMemo(() => {
    if (!selectedTransporterId) return [];
    return filteredJobs
      .filter((job) => job.driverId === selectedTransporterId)
      .sort((a, b) => (a.etd || a.eta || a.createdAt).localeCompare(b.etd || b.eta || b.createdAt));
  }, [filteredJobs, selectedTransporterId]);

  const selectedTransporterName = selectedTransporterId
    ? drivers.find((driver) => driver.id === selectedTransporterId)?.name || "Unknown"
    : "";

  const transporterMetricRows = useMemo(() => {
    return transporterMetrics.map((metric) => ({
      Transporter: metric.name,
      Orders: metric.totalJobs,
      Delivered: metric.completedJobs,
      "In Transit": metric.inProgress,
      "Total Pallets": metric.palletsLoaded,
      "Daily Capacity": `${metric.capacity} plt/day`,
      "Peak Day Pallets": metric.peakDayPallets,
      "Peak Day Date": metric.peakDayDate ? formatDate(metric.peakDayDate) : "-",
      "Peak Utilization": `${metric.peakUtilization}%`,
      "Capacity Status": metric.peakUtilization > 100 ? "Over capacity" : metric.peakUtilization >= 80 ? "High utilization" : "Within capacity",
    }));
  }, [transporterMetrics]);

  const exportTransporterMetricsExcel = async () => {
    const metadata = XLSX.utils.aoa_to_sheet([
      ["Detailed Transporter Metrics"],
      ["Report Period", reportPeriodLabel],
      ["Pulled At", pulledAtLabel],
      ["Warehouse", selectedWarehouse === "all" ? "All Warehouses" : selectedWarehouse],
      ["Records", transporterMetrics.length],
    ]);
    const metricsSheet = XLSX.utils.json_to_sheet(transporterMetricRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, metadata, "Report Info");
    XLSX.utils.book_append_sheet(workbook, metricsSheet, "Transporter Metrics");
    const fileDate = new Date().toISOString().split("T")[0];
    await XLSX.writeFile(workbook, `detailed-transporter-metrics-${timeRange}-${fileDate}.xlsx`);
  };

  const exportTransporterMetricsPdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const generatedDate = formatDate(new Date());

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Detailed Transporter Metrics", 14, 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(`Period: ${reportPeriodLabel}`, 14, 17);
    doc.text(`Pulled at: ${pulledAtLabel}`, pageWidth - 14, 10, { align: "right" });
    doc.text(`Warehouse: ${selectedWarehouse === "all" ? "All Warehouses" : selectedWarehouse}`, pageWidth - 14, 17, { align: "right" });

    autoTable(doc, {
      startY: 30,
      head: [["Transporter", "Orders", "Delivered", "In Transit", "Total Pallets", "Daily Capacity", "Peak Day", "Peak Utilization", "Status"]],
      body: transporterMetrics.map((metric) => [
        metric.name,
        String(metric.totalJobs),
        String(metric.completedJobs),
        String(metric.inProgress),
        String(metric.palletsLoaded),
        `${metric.capacity} plt/day`,
        metric.peakDayDate ? `${metric.peakDayPallets} plt (${formatDate(metric.peakDayDate)})` : "-",
        `${metric.peakUtilization}%`,
        metric.peakUtilization > 100 ? "Over capacity" : metric.peakUtilization >= 80 ? "High utilization" : "Within capacity",
      ]),
      theme: "grid",
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      bodyStyles: { fontSize: 7, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { lineColor: [226, 232, 240], lineWidth: 0.15, overflow: "linebreak" },
      columnStyles: {
        0: { cellWidth: 48 },
        1: { halign: "center" },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center" },
        5: { halign: "center" },
        7: { halign: "center" },
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 7) {
          const value = Number.parseInt(String(data.cell.raw), 10);
          data.cell.styles.fontStyle = "bold";
          if (value > 100) data.cell.styles.textColor = [220, 38, 38];
          else if (value >= 80) data.cell.styles.textColor = [217, 119, 6];
          else data.cell.styles.textColor = [22, 163, 74];
        }
      },
      didDrawPage: () => {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setDrawColor(226, 232, 240);
        doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(6.5);
        doc.text("K58 Dispatch", 14, pageHeight - 5);
        doc.text(`Generated ${generatedDate}`, pageWidth / 2, pageHeight - 5, { align: "center" });
        doc.text(`Page ${(doc as any).internal.getCurrentPageInfo().pageNumber}`, pageWidth - 14, pageHeight - 5, { align: "right" });
      },
    });

    const fileDate = new Date().toISOString().split("T")[0];
    doc.save(`detailed-transporter-metrics-${timeRange}-${fileDate}.pdf`);
  };

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
  // Picking Required vs Actually Picked per ETD/ETA date this week
  const itemsPickedThisWeek = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const days: { day: string; required: number; picked: number }[] = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const orderJobs = jobs.filter((j) => j.jobType === "order" || j.jobType === undefined);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      let required = 0;
      let picked = 0;
      orderJobs.forEach((j) => {
        const jobDate = (j.etd || j.eta || "").split("T")[0];
        if (jobDate === dateKey && j.status !== "cancelled") {
          required++;
          if (j.orderPicked) picked++;
        }
      });

      days.push({ day: `${dayNames[i]} ${d.getDate()}`, required, picked });
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
      missingPalletQty: missingPalletAssignments.length,
    };
  }, [filteredJobs, drivers, missingPalletAssignments]);

  return (
    <div className="space-y-4">
      {/* Header — compact with filters inline */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500">
            Performance insights • {kpis.totalJobs} jobs • {reportPeriodLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)} className="w-auto text-sm">
            <option value="all">All Warehouses</option>
            {warehouses.map((wh) => <option key={wh} value={wh}>{wh}</option>)}
          </Select>
          <Select value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)} className="w-auto text-sm">
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
            <option value="90d">90 Days</option>
            <option value="current-month">Current Month</option>
            <option value="previous-month">Previous Month</option>
            <option value="all">All Time</option>
          </Select>
        </div>
      </div>

      {/* KPI Strip — tighter, stronger hierarchy */}
      <div className="grid gap-3 grid-cols-3 lg:grid-cols-7">
        {([
          { icon: Package, label: "Total Jobs", value: String(kpis.totalJobs), color: "text-gray-900", iconColor: "text-resilinc-primary", bg: "bg-green-50" },
          { icon: TrendingUp, label: "Delivered", value: String(kpis.deliveredJobs), color: "text-green-600", iconColor: "text-green-600", bg: "bg-green-50" },
          { icon: BarChart3, label: "Delivery Rate", value: `${kpis.deliveryRate}%`, color: "text-green-600", iconColor: "text-green-600", bg: "bg-green-50" },
          { icon: Calendar, label: "Exceptions", value: String(kpis.exceptionsCount), color: "text-red-600", iconColor: "text-red-600", bg: "bg-red-50" },
          { icon: PieChartIcon, label: "Exception Rate", value: `${kpis.exceptionRate}%`, color: "text-amber-600", iconColor: "text-amber-600", bg: "bg-amber-50" },
          { icon: Truck, label: "Transporters", value: String(kpis.activeTransporters), color: "text-gray-900", iconColor: "text-gray-600", bg: "bg-gray-100" },
          { icon: Package, label: "Missing Pallets", value: String(kpis.missingPalletQty), color: kpis.missingPalletQty > 0 ? "text-red-600" : "text-gray-900", iconColor: kpis.missingPalletQty > 0 ? "text-red-600" : "text-gray-600", bg: kpis.missingPalletQty > 0 ? "bg-red-50" : "bg-gray-100" },
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
        {/* Picking Progress This Week */}
        <Card>
          <CardHeader>
            <CardTitle>Picking Progress This Week</CardTitle>
            <p className="text-xs text-gray-400 mt-0.5">Picking required vs actually picked per ETD/ETA date</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={itemsPickedThisWeek}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "8px" }} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="required" fill="#94A3B8" name="Required" radius={[3, 3, 0, 0]} />
                <Bar dataKey="picked" fill={COLORS.success} name="Picked" radius={[3, 3, 0, 0]} />
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
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
            {(() => {
              const now = new Date(); now.setHours(0, 0, 0, 0);
              const overdue = filteredJobs.filter(j => j.eta && j.status !== "delivered" && j.status !== "cancelled" && new Date(j.eta) < now).length;
              const unassigned = filteredJobs.filter(j => !j.driverId && j.status === "pending").length;
              const missingCoa = filteredJobs.filter(j => j.orderPicked && !j.coaAvailable && j.status !== "delivered" && j.status !== "cancelled").length;
              const noTransporter = filteredJobs.filter(j => !j.transporterBooked && j.status !== "delivered" && j.status !== "cancelled" && j.status !== "pending").length;
              const overCapacity = transporterMetrics.filter(m => m.peakUtilization > 100).length;
              const missingPallets = missingPalletAssignments.length;
              return [
                { label: "Overdue Orders", value: overdue, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
                { label: "Unassigned Orders", value: unassigned, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
                { label: "Missing COA", value: missingCoa, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
                { label: "No Transporter Booked", value: noTransporter, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
                { label: "Over Capacity", value: overCapacity, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
                { label: "Missing Pallets", value: missingPallets, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
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

      {/* Missing Pallet Qty Fixes */}
      {missingPalletAssignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Assigned Orders Missing Pallet Qty</CardTitle>
            <p className="text-xs text-gray-400 mt-0.5">
              Transporter is assigned, but no pallet quantity is captured for the order
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Reference</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Customer</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Transporter</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Line Items</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Pallet Qty</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {missingPalletAssignments.map((item) => {
                    const draft = palletDrafts[item.ref] || "";
                    const canSave = Number(draft) > 0 && savingPalletRef !== item.ref;
                    return (
                      <tr key={`${item.ref}-${item.driverName}`} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => openMissingPalletOrder(item.ids)}
                            className="font-medium text-resilinc-primary hover:text-resilinc-primary-dark hover:underline"
                            title="View order details"
                          >
                            {item.ref}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{item.customer}</td>
                        <td className="px-4 py-3 text-gray-700">{item.driverName}</td>
                        <td className="px-4 py-3 text-gray-700">{formatDate(item.etd || item.eta)}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{item.lineItems}</td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={draft}
                            onChange={(event) => setPalletDrafts((prev) => ({ ...prev, [item.ref]: event.target.value }))}
                            className="ml-auto h-9 w-24 text-right text-sm"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            onClick={() => saveMissingPalletQty(item.ref, item.ids)}
                            disabled={!canSave}
                          >
                            {savingPalletRef === item.ref ? "Saving" : "Save"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Detailed Transporter Metrics</CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">
                Performance and daily capacity utilization by transporter • {reportPeriodLabel} • Pulled at {pulledAtLabel}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={exportTransporterMetricsPdf}
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={transporterMetrics.length === 0}
              >
                <FileText className="h-4 w-4" />
                PDF
              </Button>
              <Button
                onClick={exportTransporterMetricsExcel}
                size="sm"
                className="gap-2"
                disabled={transporterMetrics.length === 0}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
            </div>
          </div>
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
                {transporterMetrics.map((metric) => (
                  <tr key={metric.driverId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedTransporterId(metric.driverId)}
                        className="font-medium text-resilinc-primary hover:text-resilinc-primary-dark hover:underline"
                        title="View transporter jobs for this filter"
                      >
                        {metric.name}
                      </button>
                    </td>
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

      {selectedTransporterId && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{selectedTransporterName} Jobs</CardTitle>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedTransporterJobs.length} orders for {reportPeriodLabel}
                  {selectedWarehouse !== "all" ? ` • ${selectedWarehouse}` : ""}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedTransporterId(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Reference</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Customer</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Pallets</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Warehouse</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedTransporterJobs.map((job) => (
                    <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedJob(job)}
                          className="font-medium text-resilinc-primary hover:text-resilinc-primary-dark hover:underline"
                          title="View order details"
                        >
                          {job.ref}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{job.customer}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          job.status === "delivered" ? "bg-green-50 text-green-700" :
                          job.status === "exception" ? "bg-red-50 text-red-700" :
                          job.status === "pending" ? "bg-amber-50 text-amber-700" :
                          "bg-blue-50 text-blue-700"
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{formatDate(job.etd || job.eta || job.createdAt)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{job.pallets ?? "-"}</td>
                      <td className="px-4 py-3 text-gray-700">{job.warehouse || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedTransporterJobs.length === 0 && (
                <div className="py-10 text-center text-sm text-gray-400">
                  No jobs found for this transporter in the selected filter.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          driverName={selectedJob.driverId ? drivers.find((driver) => driver.id === selectedJob.driverId)?.name : undefined}
        />
      )}
    </div>
  );
};
