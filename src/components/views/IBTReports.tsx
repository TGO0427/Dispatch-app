import { useMemo, useState } from "react";
import { FileSpreadsheet, Truck, Warehouse, MapPin, Package, TrendingUp, AlertCircle, Search } from "lucide-react";
import { useDispatch } from "../../context/DispatchContext";
import { Job } from "../../types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Input } from "../ui/Input";
import { JobDetailsModal } from "../JobDetailsModal";
import * as XLSX from "../../lib/spreadsheet";

type ReportType =
  | "ibt-summary"
  | "transfer-routes"
  | "branch-utilization"
  | "transporter-performance"
  | "exception-report"
  | "overdue-report";

type DateRange = "all" | "today" | "week" | "month" | "quarter" | "year";

// Helper to get week info
const getWeekInfo = (dateString: string | undefined) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const daysSinceStart = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((daysSinceStart + startOfYear.getDay() + 1) / 7);
  return {
    week: weekNumber,
    year: date.getFullYear(),
    label: `Week ${weekNumber}, ${date.getFullYear()}`,
    value: `${date.getFullYear()}-W${weekNumber.toString().padStart(2, "0")}`,
  };
};

export const IBTReports: React.FC = () => {
  const { jobs, drivers } = useDispatch();

  const [selectedReport, setSelectedReport] = useState<ReportType>("ibt-summary");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [selectedTransporter, setSelectedTransporter] = useState<string>("all");
  const [customerSearch, setCustomerSearch] = useState<string>("");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Deduplicate IBT jobs by ref and filter to current week + 4
  const dedupedJobs = useMemo(() => {
    const ibtJobs = jobs.filter((j) => j.jobType === "ibt");
    const refMap = new Map<string, (typeof ibtJobs)[0]>();
    ibtJobs.forEach((job) => {
      const existing = refMap.get(job.ref);
      if (!existing) {
        refMap.set(job.ref, { ...job });
      } else {
        if (job.eta && (!existing.eta || job.eta < existing.eta)) existing.eta = job.eta;
        if (job.pallets) existing.pallets = (existing.pallets || 0) + job.pallets;
        if (job.outstandingQty) existing.outstandingQty = (existing.outstandingQty || 0) + job.outstandingQty;
      }
    });

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfRange = new Date(startOfWeek);
    endOfRange.setDate(endOfRange.getDate() + 5 * 7);
    endOfRange.setHours(23, 59, 59, 999);

    return Array.from(refMap.values()).filter((job) => {
      if (!job.eta) return true;
      const etaDate = new Date(job.eta);
      return etaDate >= startOfWeek && etaDate <= endOfRange;
    });
  }, [jobs]);

  // Get unique warehouses (from pickup + dropoff)
  const warehouses = useMemo(() => {
    const wh = new Set<string>();
    dedupedJobs.forEach((j) => {
      if (j.pickup) wh.add(j.pickup);
      if (j.dropoff) wh.add(j.dropoff);
      if (j.warehouse) wh.add(j.warehouse);
    });
    return Array.from(wh).sort();
  }, [dedupedJobs]);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    const now = new Date();
    return dedupedJobs
      .filter((job) => {
        if (selectedStatus !== "all" && job.status !== selectedStatus) return false;
        if (selectedWarehouse !== "all") {
          if (job.pickup !== selectedWarehouse && job.dropoff !== selectedWarehouse && job.warehouse !== selectedWarehouse) return false;
        }
        if (selectedTransporter !== "all" && job.driverId !== selectedTransporter) return false;
        // Date range filter
        if (dateRange !== "all") {
          const jobDate = new Date(job.createdAt);
          const daysMap: Record<string, number> = { today: 0, week: 7, month: 30, quarter: 90, year: 365 };
          const daysBack = daysMap[dateRange] ?? 0;
          const cutoff = new Date(now.getTime() - daysBack * 86400000);
          if (dateRange === "today") { cutoff.setHours(0, 0, 0, 0); }
          if (jobDate < cutoff) return false;
        }
        // Customer search
        if (customerSearch) {
          const q = customerSearch.toLowerCase();
          if (!job.customer.toLowerCase().includes(q) && !job.ref.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aEta = a.eta ? new Date(a.eta).getTime() : Infinity;
        const bEta = b.eta ? new Date(b.eta).getTime() : Infinity;
        return aEta - bEta;
      });
  }, [dedupedJobs, selectedStatus, selectedWarehouse, selectedTransporter, dateRange, customerSearch]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredJobs.length;
    const pending = filteredJobs.filter((j) => j.status === "pending").length;
    const inTransit = filteredJobs.filter((j) => j.status === "en-route").length;
    const delivered = filteredJobs.filter((j) => j.status === "delivered").length;
    const exceptions = filteredJobs.filter((j) => j.status === "exception").length;
    const totalPallets = filteredJobs.reduce((sum, j) => sum + (j.pallets || 0), 0);
    const totalWeight = filteredJobs.reduce((sum, j) => sum + (j.outstandingQty || 0), 0);
    return { total, pending, inTransit, delivered, exceptions, totalPallets, totalWeight };
  }, [filteredJobs]);

  // Transfer routes analysis
  const routeStats = useMemo(() => {
    const routes: { [key: string]: { count: number; pallets: number; weight: number } } = {};
    filteredJobs.forEach((job) => {
      const route = `${job.pickup} → ${job.dropoff}`;
      if (!routes[route]) routes[route] = { count: 0, pallets: 0, weight: 0 };
      routes[route].count++;
      routes[route].pallets += job.pallets || 0;
      routes[route].weight += job.outstandingQty || 0;
    });
    return Object.entries(routes)
      .map(([route, data]) => ({ route, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [filteredJobs]);

  // Branch utilization (how much goes to/from each warehouse)
  const branchStats = useMemo(() => {
    const branches: { [key: string]: { outgoing: number; incoming: number; pallets: number; weight: number } } = {};
    filteredJobs.forEach((job) => {
      if (job.pickup) {
        if (!branches[job.pickup]) branches[job.pickup] = { outgoing: 0, incoming: 0, pallets: 0, weight: 0 };
        branches[job.pickup].outgoing++;
        branches[job.pickup].pallets += job.pallets || 0;
        branches[job.pickup].weight += job.outstandingQty || 0;
      }
      if (job.dropoff && job.dropoff !== "TBD") {
        if (!branches[job.dropoff]) branches[job.dropoff] = { outgoing: 0, incoming: 0, pallets: 0, weight: 0 };
        branches[job.dropoff].incoming++;
      }
    });
    return Object.entries(branches)
      .map(([name, data]) => ({ name, ...data, total: data.outgoing + data.incoming }))
      .sort((a, b) => b.total - a.total);
  }, [filteredJobs]);

  // Transporter performance for IBT
  const transporterStats = useMemo(() => {
    return drivers.map((driver) => {
      const driverJobs = filteredJobs.filter((j) => j.driverId === driver.id);
      const completed = driverJobs.filter((j) => j.status === "delivered").length;
      const exceptions = driverJobs.filter((j) => j.status === "exception").length;
      const pallets = driverJobs.reduce((sum, j) => sum + (j.pallets || 0), 0);
      return {
        driver,
        total: driverJobs.length,
        completed,
        exceptions,
        pallets,
        completionRate: driverJobs.length > 0 ? ((completed / driverJobs.length) * 100).toFixed(1) : "0",
      };
    }).filter((d) => d.total > 0).sort((a, b) => b.total - a.total);
  }, [filteredJobs, drivers]);

  // Export
  const exportToExcel = async () => {
    const data = filteredJobs.map((job) => ({
      Reference: job.ref,
      Pickup: job.pickup,
      Dropoff: job.dropoff,
      Status: job.status,
      Priority: job.priority,
      Pallets: job.pallets || "",
      "Weight (qty)": job.outstandingQty || "",
      Transporter: job.driverId ? drivers.find((d) => d.id === job.driverId)?.name || "" : "Unassigned",
      Created: new Date(job.createdAt).toLocaleDateString(),
      ETA: job.eta || "N/A",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "IBT Report");
    await XLSX.writeFile(wb, `IBT_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const renderReport = () => {
    switch (selectedReport) {
      case "ibt-summary":
        return (
          <Card>
            <CardHeader>
              <CardTitle>IBT Transfer Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-700">Reference</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Status</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Priority</th>
                      <th className="text-right p-3 font-semibold text-gray-700">Pallets</th>
                      <th className="text-right p-3 font-semibold text-gray-700">Weight (qty)</th>
                      <th className="text-left p-3 font-semibold text-gray-700">From → To</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Transporter</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Service</th>
                      <th className="text-left p-3 font-semibold text-gray-700">ETD</th>
                      <th className="text-left p-3 font-semibold text-gray-700">ETA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map((job) => {
                      const etaWeekInfo = getWeekInfo(job.eta);
                      return (
                        <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-3 font-medium"><button className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer" onClick={() => setSelectedJob(job)}>{job.ref}</button></td>
                          <td className="p-3">
                            <Badge variant={
                              job.status === "delivered" ? "success" :
                              job.status === "exception" ? "destructive" :
                              job.status === "pending" ? "new" : "default"
                            }>
                              {job.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <Badge variant={
                              job.priority === "urgent" ? "destructive" :
                              job.priority === "high" ? "past-due" : "outline"
                            }>
                              {job.priority}
                            </Badge>
                          </td>
                          <td className="p-3 text-right font-medium">{job.pallets ?? "—"}</td>
                          <td className="p-3 text-right font-medium">{job.outstandingQty ? job.outstandingQty.toLocaleString() : "—"}</td>
                          <td className="p-3 text-gray-700 text-xs">{job.pickup} → {job.dropoff}</td>
                          <td className="p-3 text-gray-700">
                            {job.driverId ? drivers.find((d) => d.id === job.driverId)?.name : "Unassigned"}
                          </td>
                          <td className="p-3 text-xs">
                            {job.transportService ? (
                              <span className={`font-semibold px-1.5 py-0.5 rounded ${
                                job.transportService === "express" ? "bg-red-100 text-red-700" :
                                job.transportService === "economy" ? "bg-blue-100 text-blue-700" :
                                "bg-gray-100 text-gray-700"
                              }`}>
                                {job.transportService === "express" ? "⚡ Express" :
                                 job.transportService === "economy" ? "🚛 Economy" : "📦 Outline"}
                              </span>
                            ) : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="p-3 text-gray-600 text-xs font-medium">
                            {job.etd || <span className="text-gray-400">—</span>}
                          </td>
                          <td className="p-3 text-gray-600 text-xs">
                            {job.eta || "N/A"}
                            {etaWeekInfo && <div className="text-gray-400 mt-1">{etaWeekInfo.label}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredJobs.length === 0 && (
                  <div className="text-center py-12 text-gray-500">No IBT transfers found</div>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case "transfer-routes":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Transfer Routes Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-700">Route</th>
                      <th className="text-right p-3 font-semibold text-gray-700">Transfers</th>
                      <th className="text-right p-3 font-semibold text-gray-700">Total Pallets</th>
                      <th className="text-right p-3 font-semibold text-gray-700">Total Weight</th>
                      <th className="text-right p-3 font-semibold text-gray-700">% of All</th>
                    </tr>
                  </thead>
                  <tbody>
                    {routeStats.map((route, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-blue-500" />
                            {route.route}
                          </div>
                        </td>
                        <td className="p-3 text-right font-semibold">{route.count}</td>
                        <td className="p-3 text-right">{route.pallets}</td>
                        <td className="p-3 text-right">{route.weight.toLocaleString()}</td>
                        <td className="p-3 text-right text-gray-500">
                          {filteredJobs.length > 0 ? ((route.count / filteredJobs.length) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {routeStats.length === 0 && (
                  <div className="text-center py-12 text-gray-500">No route data available</div>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case "branch-utilization":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Branch / Warehouse Utilization</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-700">Branch / Warehouse</th>
                      <th className="text-right p-3 font-semibold text-gray-700">Outgoing</th>
                      <th className="text-right p-3 font-semibold text-gray-700">Incoming</th>
                      <th className="text-right p-3 font-semibold text-gray-700">Total Moves</th>
                      <th className="text-right p-3 font-semibold text-gray-700">Pallets Out</th>
                      <th className="text-right p-3 font-semibold text-gray-700">Weight Out</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchStats.map((branch, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <Warehouse className="w-4 h-4 text-purple-500" />
                            {branch.name}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <span className="text-orange-600 font-medium">{branch.outgoing}</span>
                        </td>
                        <td className="p-3 text-right">
                          <span className="text-green-600 font-medium">{branch.incoming}</span>
                        </td>
                        <td className="p-3 text-right font-semibold">{branch.total}</td>
                        <td className="p-3 text-right">{branch.pallets}</td>
                        <td className="p-3 text-right">{branch.weight.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {branchStats.length === 0 && (
                  <div className="text-center py-12 text-gray-500">No branch data available</div>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case "transporter-performance":
        return (
          <Card>
            <CardHeader>
              <CardTitle>IBT Transporter Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-700">Transporter</th>
                      <th className="text-right p-3 font-semibold text-gray-700">Total IBTs</th>
                      <th className="text-right p-3 font-semibold text-gray-700">Completed</th>
                      <th className="text-right p-3 font-semibold text-gray-700">Exceptions</th>
                      <th className="text-right p-3 font-semibold text-gray-700">Pallets</th>
                      <th className="text-right p-3 font-semibold text-gray-700">Completion %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transporterStats.map((ts) => (
                      <tr key={ts.driver.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-blue-500" />
                            {ts.driver.name}
                          </div>
                          <div className="text-xs text-gray-500">{ts.driver.callsign}</div>
                        </td>
                        <td className="p-3 text-right font-semibold">{ts.total}</td>
                        <td className="p-3 text-right text-green-600 font-medium">{ts.completed}</td>
                        <td className="p-3 text-right text-red-600 font-medium">{ts.exceptions}</td>
                        <td className="p-3 text-right">{ts.pallets}</td>
                        <td className="p-3 text-right">
                          <span className={`font-semibold ${parseFloat(ts.completionRate) >= 90 ? "text-green-600" : parseFloat(ts.completionRate) >= 70 ? "text-yellow-600" : "text-red-600"}`}>
                            {ts.completionRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {transporterStats.length === 0 && (
                  <div className="text-center py-12 text-gray-500">No transporter data for IBT transfers</div>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case "exception-report":
        const exceptionJobs = filteredJobs.filter((j) => j.status === "exception");
        return (
          <Card>
            <CardHeader>
              <CardTitle>IBT Exception Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-700">Reference</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Route</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Transporter</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Reason</th>
                      <th className="text-left p-3 font-semibold text-gray-700">ETA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exceptionJobs.map((job) => (
                      <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 font-medium"><button className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer" onClick={() => setSelectedJob(job)}>{job.ref}</button></td>
                        <td className="p-3 text-gray-700 text-xs">{job.pickup} → {job.dropoff}</td>
                        <td className="p-3 text-gray-700">
                          {job.driverId ? drivers.find((d) => d.id === job.driverId)?.name : "Unassigned"}
                        </td>
                        <td className="p-3 text-red-600 text-sm">{job.exceptionReason || "No reason provided"}</td>
                        <td className="p-3 text-gray-600 text-xs">{job.eta || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {exceptionJobs.length === 0 && (
                  <div className="text-center py-12 text-gray-500">No IBT exceptions — all transfers running smoothly</div>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case "overdue-report":
        const overdueNow = new Date();
        overdueNow.setHours(0, 0, 0, 0);
        const overdueJobs = filteredJobs
          .filter(job => job.eta && job.status !== "delivered" && job.status !== "cancelled" && new Date(job.eta) < overdueNow)
          .map(job => {
            const eta = new Date(job.eta!); eta.setHours(0, 0, 0, 0);
            return { ...job, daysOverdue: Math.floor((overdueNow.getTime() - eta.getTime()) / 86400000) };
          })
          .sort((a, b) => b.daysOverdue - a.daysOverdue);

        return (
          <Card>
            <CardHeader><CardTitle>Overdue Analysis Report</CardTitle></CardHeader>
            <CardContent>
              {overdueJobs.length === 0 ? (
                <div className="text-center py-12 text-gray-400">No overdue IBT transfers found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left p-3 font-semibold text-gray-700">Reference</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Customer</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Status</th>
                        <th className="text-left p-3 font-semibold text-gray-700">ETA</th>
                        <th className="text-center p-3 font-semibold text-gray-700">Days Overdue</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Overdue Reason</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Route</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Transporter</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdueJobs.map((job) => (
                        <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-3"><button className="font-medium text-blue-600 hover:text-blue-800 hover:underline" onClick={() => setSelectedJob(job)}>{job.ref}</button></td>
                          <td className="p-3 text-gray-700">{job.customer}</td>
                          <td className="p-3"><Badge variant={job.status === "exception" ? "destructive" : "secondary"}>{job.status}</Badge></td>
                          <td className="p-3 text-gray-700 text-xs">{job.eta}</td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${job.daysOverdue > 3 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{job.daysOverdue}d</span>
                          </td>
                          <td className="p-3 text-sm max-w-[250px]">
                            {job.overdueReason ? <span className="text-gray-700">{job.overdueReason}</span> : <span className="text-red-400 italic text-xs">No reason provided</span>}
                          </td>
                          <td className="p-3 text-gray-700 text-xs">{job.pickup} → {job.dropoff}</td>
                          <td className="p-3 text-gray-700 text-xs">{job.driverId ? drivers.find(d => d.id === job.driverId)?.name || "Unknown" : "Unassigned"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        );
    }
  };

  const reportLabels: Record<ReportType, string> = {
    "ibt-summary": "Transfer Summary",
    "transfer-routes": "Transfer Routes",
    "branch-utilization": "Branch Utilization",
    "transporter-performance": "Transporter Performance",
    "exception-report": "Exception Report",
    "overdue-report": "Overdue Analysis",
  };

  return (
    <div className="space-y-4">
      {/* Header — identical to Order Reports */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">IBT Reports</h1>
          <p className="text-sm text-gray-500">
            {reportLabels[selectedReport]} — {filteredJobs.length} records
            {dateRange !== "all" && ` (last ${dateRange === "today" ? "today" : dateRange === "week" ? "7 days" : dateRange === "month" ? "30 days" : dateRange === "quarter" ? "90 days" : "year"})`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={exportToExcel} className="gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      {/* Filters — compact 4-column grid in Card (matches Order Reports) */}
      <Card className="p-4">
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Select value={selectedReport} onChange={(e) => setSelectedReport(e.target.value as ReportType)} className="w-full text-sm">
            <option value="ibt-summary">Transfer Summary</option>
            <option value="transfer-routes">Transfer Routes</option>
            <option value="branch-utilization">Branch Utilization</option>
            <option value="transporter-performance">Transporter Performance</option>
            <option value="exception-report">Exception Report</option>
            <option value="overdue-report">Overdue Analysis</option>
          </Select>

          <Select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRange)} className="w-full text-sm">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="quarter">Last 90 Days</option>
            <option value="year">Last Year</option>
          </Select>

          <Select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full text-sm">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="en-route">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="exception">Exception</option>
          </Select>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input type="text" placeholder="Search customer..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="w-full pl-8 text-sm h-9" />
          </div>
        </div>

        {showMoreFilters && (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mt-3">
            <Select value={selectedWarehouse} onChange={(e) => setSelectedWarehouse(e.target.value)} className="w-full text-sm">
              <option value="all">All Warehouses</option>
              {warehouses.map((wh) => <option key={wh} value={wh}>{wh}</option>)}
            </Select>
            <Select value={selectedTransporter} onChange={(e) => setSelectedTransporter(e.target.value)} className="w-full text-sm">
              <option value="all">All Transporters</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>
        )}

        <div className="mt-2 text-right">
          <button onClick={() => setShowMoreFilters(!showMoreFilters)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
            {showMoreFilters ? "Less filters" : "More filters (warehouse, transporter)"}
          </button>
        </div>
      </Card>

      {/* KPI Strip — with icons, matches Order Reports */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {([
          { icon: Package, label: "Total IBTs", value: String(stats.total), color: "text-gray-900", iconColor: "text-blue-600", bg: "bg-blue-50" },
          { icon: TrendingUp, label: "Delivered", value: String(stats.delivered), color: "text-green-600", iconColor: "text-green-600", bg: "bg-green-50" },
          { icon: Truck, label: "In Transit", value: String(stats.inTransit), color: "text-blue-600", iconColor: "text-blue-600", bg: "bg-blue-50" },
          { icon: AlertCircle, label: "Exceptions", value: String(stats.exceptions), color: "text-red-600", iconColor: "text-red-600", bg: "bg-red-50" },
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

      {/* Report Content */}
      {renderReport()}

      {/* Job Details Modal */}
      {selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          driverName={selectedJob.driverId ? drivers.find((d) => d.id === selectedJob.driverId)?.name : undefined}
        />
      )}
    </div>
  );
};
