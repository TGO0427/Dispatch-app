import { useMemo, useState } from "react";
import { FileText, Filter, BarChart3, FileSpreadsheet, FileDown, TrendingUp, Package, Truck, AlertCircle } from "lucide-react";
import { useDispatch } from "../../context/DispatchContext";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Input } from "../ui/Input";
import * as XLSX from "xlsx";

type ReportType =
  | "job-summary"
  | "driver-performance"
  | "customer-analysis"
  | "exception-report"
  | "delivery-performance"
  | "warehouse-utilization";

type DateRange = "today" | "week" | "month" | "quarter" | "year" | "custom";

export const AnalyticsView: React.FC = () => {
  const { jobs, drivers } = useDispatch();

  // State for filters
  const [selectedReport, setSelectedReport] = useState<ReportType>("job-summary");
  const [dateRange, setDateRange] = useState<DateRange>("month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [selectedTransporter, setSelectedTransporter] = useState<string>("all");
  const [etaWeekFilter, setEtaWeekFilter] = useState<string>("all");

  // Helper function to get week number and year from date
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
      value: `${date.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`
    };
  };

  // Get unique warehouses
  const warehouses = useMemo(() => {
    const uniqueWarehouses = Array.from(new Set(jobs.map(j => j.warehouse).filter(Boolean)));
    return uniqueWarehouses.sort();
  }, [jobs]);

  // Get unique ETA weeks
  const etaWeeks = useMemo(() => {
    const weeks = new Set<string>();
    jobs.forEach(job => {
      const weekInfo = getWeekInfo(job.eta);
      if (weekInfo) {
        weeks.add(weekInfo.value);
      }
    });
    return Array.from(weeks).sort().reverse(); // Most recent first
  }, [jobs]);

  // Get unique transporters
  const transporters = useMemo(() => {
    return drivers.map(d => ({ id: d.id, name: d.name }));
  }, [drivers]);

  // Filter jobs based on criteria
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Status filter
      if (selectedStatus !== "all" && job.status !== selectedStatus) return false;

      // Priority filter
      if (selectedPriority !== "all" && job.priority !== selectedPriority) return false;

      // Warehouse filter
      if (selectedWarehouse !== "all" && job.warehouse !== selectedWarehouse) return false;

      // Transporter filter
      if (selectedTransporter !== "all" && job.driverId !== selectedTransporter) return false;

      // ETA Week filter
      if (etaWeekFilter !== "all") {
        const weekInfo = getWeekInfo(job.eta);
        if (!weekInfo || weekInfo.value !== etaWeekFilter) return false;
      }

      // Date range filter (based on created date)
      const jobDate = new Date(job.createdAt);
      const now = new Date();

      if (dateRange === "custom" && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (jobDate < start || jobDate > end) return false;
      } else if (dateRange === "today") {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (jobDate < today) return false;
      } else if (dateRange === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (jobDate < weekAgo) return false;
      } else if (dateRange === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (jobDate < monthAgo) return false;
      } else if (dateRange === "quarter") {
        const quarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        if (jobDate < quarterAgo) return false;
      } else if (dateRange === "year") {
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        if (jobDate < yearAgo) return false;
      }

      return true;
    });
  }, [jobs, selectedStatus, selectedPriority, selectedWarehouse, selectedTransporter, etaWeekFilter, dateRange, startDate, endDate]);

  // Export functions
  const exportToExcel = () => {
    let data: any[] = [];
    let filename = "";

    switch (selectedReport) {
      case "job-summary":
        data = filteredJobs.map(job => {
          const etaWeekInfo = getWeekInfo(job.eta);
          return {
            Reference: job.ref,
            Customer: job.customer,
            Status: job.status,
            Priority: job.priority,
            Pickup: job.pickup,
            Dropoff: job.dropoff,
            Warehouse: job.warehouse || "N/A",
            Transporter: job.driverId ? drivers.find(d => d.id === job.driverId)?.name : "Unassigned",
            "Created Date": new Date(job.createdAt).toLocaleString(),
            "ETA Date": job.eta || "N/A",
            "ETA Week": etaWeekInfo ? etaWeekInfo.label : "N/A",
          };
        });
        filename = "job-summary-report.xlsx";
        break;

      case "driver-performance":
        const driverPerf = drivers.map(driver => {
          const driverJobs = filteredJobs.filter(j => j.driverId === driver.id);
          const completed = driverJobs.filter(j => j.status === "delivered").length;
          return {
            Driver: driver.name,
            Callsign: driver.callsign,
            Status: driver.status,
            "Total Jobs": driverJobs.length,
            "Completed": completed,
            "In Progress": driverJobs.filter(j => j.status === "en-route" || j.status === "assigned").length,
            "Completion Rate": driverJobs.length > 0 ? `${((completed / driverJobs.length) * 100).toFixed(1)}%` : "0%",
            Location: driver.location,
          };
        });
        data = driverPerf;
        filename = "driver-performance-report.xlsx";
        break;

      case "customer-analysis":
        const customerData: Record<string, any> = {};
        filteredJobs.forEach(job => {
          if (!customerData[job.customer]) {
            customerData[job.customer] = {
              Customer: job.customer,
              "Total Jobs": 0,
              "Delivered": 0,
              "Pending": 0,
              "Exceptions": 0,
              "Avg Priority Score": 0,
            };
          }
          customerData[job.customer]["Total Jobs"]++;
          if (job.status === "delivered") customerData[job.customer]["Delivered"]++;
          if (job.status === "pending") customerData[job.customer]["Pending"]++;
          if (job.status === "exception") customerData[job.customer]["Exceptions"]++;
        });
        data = Object.values(customerData);
        filename = "customer-analysis-report.xlsx";
        break;

      case "exception-report":
        data = filteredJobs
          .filter(j => j.status === "exception")
          .map(job => {
            const etaWeekInfo = getWeekInfo(job.eta);
            return {
              Reference: job.ref,
              Customer: job.customer,
              Priority: job.priority,
              Pickup: job.pickup,
              Dropoff: job.dropoff,
              Transporter: job.driverId ? drivers.find(d => d.id === job.driverId)?.name : "Unassigned",
              Notes: job.notes || "No notes",
              "Created Date": new Date(job.createdAt).toLocaleString(),
              "ETA Date": job.eta || "N/A",
              "ETA Week": etaWeekInfo ? etaWeekInfo.label : "N/A",
            };
          });
        filename = "exception-report.xlsx";
        break;

      case "delivery-performance":
        const statusBreakdown = filteredJobs.reduce((acc, job) => {
          acc[job.status] = (acc[job.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        data = Object.entries(statusBreakdown).map(([status, count]) => ({
          Status: status,
          Count: count,
          Percentage: `${((count / filteredJobs.length) * 100).toFixed(1)}%`,
        }));
        filename = "delivery-performance-report.xlsx";
        break;

      case "warehouse-utilization":
        const warehouseData: Record<string, any> = {};
        filteredJobs.forEach(job => {
          const wh = job.warehouse || "Unassigned";
          if (!warehouseData[wh]) {
            warehouseData[wh] = {
              Warehouse: wh,
              "Total Jobs": 0,
              "Delivered": 0,
              "In Progress": 0,
              "Pending": 0,
              "Exceptions": 0,
            };
          }
          warehouseData[wh]["Total Jobs"]++;
          if (job.status === "delivered") warehouseData[wh]["Delivered"]++;
          if (job.status === "en-route" || job.status === "assigned") warehouseData[wh]["In Progress"]++;
          if (job.status === "pending") warehouseData[wh]["Pending"]++;
          if (job.status === "exception") warehouseData[wh]["Exceptions"]++;
        });
        data = Object.values(warehouseData);
        filename = "warehouse-utilization-report.xlsx";
        break;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, filename);
  };

  const exportToCSV = () => {
    let data: any[] = [];
    let filename = "";

    switch (selectedReport) {
      case "job-summary":
        data = filteredJobs.map(job => {
          const etaWeekInfo = getWeekInfo(job.eta);
          return {
            Reference: job.ref,
            Customer: job.customer,
            Status: job.status,
            Priority: job.priority,
            Pickup: job.pickup,
            Dropoff: job.dropoff,
            Warehouse: job.warehouse || "N/A",
            Transporter: job.driverId ? drivers.find(d => d.id === job.driverId)?.name : "Unassigned",
            "Created Date": new Date(job.createdAt).toLocaleString(),
            "ETA Date": job.eta || "N/A",
            "ETA Week": etaWeekInfo ? etaWeekInfo.label : "N/A",
          };
        });
        filename = "job-summary-report.csv";
        break;

      default:
        exportToExcel();
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Calculate key metrics
  const metrics = useMemo(() => {
    const total = filteredJobs.length;
    const delivered = filteredJobs.filter(j => j.status === "delivered").length;
    const exceptions = filteredJobs.filter(j => j.status === "exception").length;
    const inProgress = filteredJobs.filter(j => j.status === "en-route" || j.status === "assigned").length;
    const pending = filteredJobs.filter(j => j.status === "pending").length;

    const completionRate = total > 0 ? ((delivered / total) * 100).toFixed(1) : "0";
    const exceptionRate = total > 0 ? ((exceptions / total) * 100).toFixed(1) : "0";

    return {
      total,
      delivered,
      exceptions,
      inProgress,
      pending,
      completionRate,
      exceptionRate,
    };
  }, [filteredJobs]);

  // Render report content based on selected type
  const renderReportContent = () => {
    switch (selectedReport) {
      case "job-summary":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Job Summary Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-700">Reference</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Customer</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Status</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Priority</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Route</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Transporter</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Created</th>
                      <th className="text-left p-3 font-semibold text-gray-700">ETA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map((job) => {
                      const etaWeekInfo = getWeekInfo(job.eta);
                      return (
                        <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-3 font-medium text-gray-900">{job.ref}</td>
                          <td className="p-3 text-gray-700">{job.customer}</td>
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
                              job.priority === "high" ? "past-due" :
                              job.priority === "normal" ? "new" : "outline"
                            }>
                              {job.priority}
                            </Badge>
                          </td>
                          <td className="p-3 text-gray-700 text-xs">{job.pickup} → {job.dropoff}</td>
                          <td className="p-3 text-gray-700">
                            {job.driverId ? drivers.find(d => d.id === job.driverId)?.name : "Unassigned"}
                          </td>
                          <td className="p-3 text-gray-600 text-xs">
                            {new Date(job.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-gray-600 text-xs">
                            {job.eta || "N/A"}
                            {etaWeekInfo && (
                              <div className="text-gray-400 text-xs mt-1">{etaWeekInfo.label}</div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredJobs.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No jobs found matching the selected filters
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case "driver-performance":
        const driverStats = drivers.map(driver => {
          const driverJobs = filteredJobs.filter(j => j.driverId === driver.id);
          const completed = driverJobs.filter(j => j.status === "delivered").length;
          const completionRate = driverJobs.length > 0 ? ((completed / driverJobs.length) * 100).toFixed(1) : "0";

          return {
            driver,
            totalJobs: driverJobs.length,
            completed,
            inProgress: driverJobs.filter(j => j.status === "en-route" || j.status === "assigned").length,
            completionRate,
          };
        });

        return (
          <Card>
            <CardHeader>
              <CardTitle>Driver Performance Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-700">Driver</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Status</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Total Jobs</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Completed</th>
                      <th className="text-left p-3 font-semibold text-gray-700">In Progress</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Completion Rate</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverStats.map(({ driver, totalJobs, completed, inProgress, completionRate }) => (
                      <tr key={driver.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3">
                          <div>
                            <div className="font-medium text-gray-900">{driver.name}</div>
                            <div className="text-xs text-gray-500">{driver.callsign}</div>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant={
                            driver.status === "available" ? "success" :
                            driver.status === "busy" ? "past-due" :
                            driver.status === "break" ? "new" : "outline"
                          }>
                            {driver.status}
                          </Badge>
                        </td>
                        <td className="p-3 font-semibold text-gray-900">{totalJobs}</td>
                        <td className="p-3 text-green-600 font-medium">{completed}</td>
                        <td className="p-3 text-blue-600 font-medium">{inProgress}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-600"
                                style={{ width: `${completionRate}%` }}
                              />
                            </div>
                            <span className="text-gray-700 font-medium">{completionRate}%</span>
                          </div>
                        </td>
                        <td className="p-3 text-gray-600 text-xs">{driver.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );

      case "customer-analysis":
        const customerStats: Record<string, any> = {};
        filteredJobs.forEach(job => {
          if (!customerStats[job.customer]) {
            customerStats[job.customer] = {
              total: 0,
              delivered: 0,
              pending: 0,
              exceptions: 0,
            };
          }
          customerStats[job.customer].total++;
          if (job.status === "delivered") customerStats[job.customer].delivered++;
          if (job.status === "pending") customerStats[job.customer].pending++;
          if (job.status === "exception") customerStats[job.customer].exceptions++;
        });

        const customerData = Object.entries(customerStats)
          .map(([customer, stats]) => ({
            customer,
            ...stats,
            completionRate: stats.total > 0 ? ((stats.delivered / stats.total) * 100).toFixed(1) : "0",
          }))
          .sort((a, b) => b.total - a.total);

        return (
          <Card>
            <CardHeader>
              <CardTitle>Customer Analysis Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-700">Customer</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Total Jobs</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Delivered</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Pending</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Exceptions</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Success Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerData.map(({ customer, total, delivered, pending, exceptions, completionRate }) => (
                      <tr key={customer} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">{customer}</td>
                        <td className="p-3 font-semibold text-gray-900">{total}</td>
                        <td className="p-3 text-green-600 font-medium">{delivered}</td>
                        <td className="p-3 text-orange-600 font-medium">{pending}</td>
                        <td className="p-3 text-red-600 font-medium">{exceptions}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-600"
                                style={{ width: `${completionRate}%` }}
                              />
                            </div>
                            <span className="text-gray-700 font-medium">{completionRate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );

      case "exception-report":
        const exceptionJobs = filteredJobs.filter(j => j.status === "exception");

        return (
          <Card>
            <CardHeader>
              <CardTitle>Exception Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-700">Reference</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Customer</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Priority</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Route</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Transporter</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Notes</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Created</th>
                      <th className="text-left p-3 font-semibold text-gray-700">ETA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exceptionJobs.map((job) => {
                      const etaWeekInfo = getWeekInfo(job.eta);
                      return (
                        <tr key={job.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-3 font-medium text-gray-900">{job.ref}</td>
                          <td className="p-3 text-gray-700">{job.customer}</td>
                          <td className="p-3">
                            <Badge variant={
                              job.priority === "urgent" ? "destructive" :
                              job.priority === "high" ? "past-due" : "new"
                            }>
                              {job.priority}
                            </Badge>
                          </td>
                          <td className="p-3 text-gray-700 text-xs">{job.pickup} → {job.dropoff}</td>
                          <td className="p-3 text-gray-700">
                            {job.driverId ? drivers.find(d => d.id === job.driverId)?.name : "Unassigned"}
                          </td>
                          <td className="p-3 text-gray-600 text-xs max-w-xs truncate">
                            {job.notes || "No notes"}
                          </td>
                          <td className="p-3 text-gray-600 text-xs">
                            {new Date(job.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-gray-600 text-xs">
                            {job.eta || "N/A"}
                            {etaWeekInfo && (
                              <div className="text-gray-400 text-xs mt-1">{etaWeekInfo.label}</div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {exceptionJobs.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No exceptions found in the selected period
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );

      case "delivery-performance":
        const statusCounts = filteredJobs.reduce((acc, job) => {
          acc[job.status] = (acc[job.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const statusData = Object.entries(statusCounts).map(([status, count]) => ({
          status,
          count,
          percentage: ((count / filteredJobs.length) * 100).toFixed(1),
        }));

        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Delivery Performance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-3xl font-bold text-green-600">{metrics.delivered}</div>
                    <div className="text-sm text-gray-600 mt-1">Delivered</div>
                    <div className="text-xs text-gray-500 mt-1">{metrics.completionRate}% completion rate</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600">{metrics.inProgress}</div>
                    <div className="text-sm text-gray-600 mt-1">In Progress</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="text-3xl font-bold text-red-600">{metrics.exceptions}</div>
                    <div className="text-sm text-gray-600 mt-1">Exceptions</div>
                    <div className="text-xs text-gray-500 mt-1">{metrics.exceptionRate}% exception rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {statusData.map(({ status, count, percentage }) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 capitalize w-32">{status}</span>
                      <div className="flex items-center gap-3 flex-1">
                        <div className="h-3 flex-1 bg-gray-200 rounded-full overflow-hidden max-w-md">
                          <div
                            className="h-full bg-resilinc-primary"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-gray-900 w-12 text-right">{count}</span>
                        <span className="text-xs text-gray-500 w-14 text-right">({percentage}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "warehouse-utilization":
        const warehouseStats: Record<string, any> = {};
        filteredJobs.forEach(job => {
          const wh = job.warehouse || "Unassigned";
          if (!warehouseStats[wh]) {
            warehouseStats[wh] = {
              total: 0,
              delivered: 0,
              inProgress: 0,
              pending: 0,
              exceptions: 0,
            };
          }
          warehouseStats[wh].total++;
          if (job.status === "delivered") warehouseStats[wh].delivered++;
          if (job.status === "en-route" || job.status === "assigned") warehouseStats[wh].inProgress++;
          if (job.status === "pending") warehouseStats[wh].pending++;
          if (job.status === "exception") warehouseStats[wh].exceptions++;
        });

        const warehouseData = Object.entries(warehouseStats)
          .map(([warehouse, stats]) => ({
            warehouse,
            ...stats,
            completionRate: stats.total > 0 ? ((stats.delivered / stats.total) * 100).toFixed(1) : "0",
          }))
          .sort((a, b) => b.total - a.total);

        return (
          <Card>
            <CardHeader>
              <CardTitle>Warehouse Utilization Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-700">Warehouse</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Total Jobs</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Delivered</th>
                      <th className="text-left p-3 font-semibold text-gray-700">In Progress</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Pending</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Exceptions</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouseData.map(({ warehouse, total, delivered, inProgress, pending, exceptions, completionRate }) => (
                      <tr key={warehouse} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">{warehouse}</td>
                        <td className="p-3 font-semibold text-gray-900">{total}</td>
                        <td className="p-3 text-green-600 font-medium">{delivered}</td>
                        <td className="p-3 text-blue-600 font-medium">{inProgress}</td>
                        <td className="p-3 text-orange-600 font-medium">{pending}</td>
                        <td className="p-3 text-red-600 font-medium">{exceptions}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-600"
                                style={{ width: `${completionRate}%` }}
                              />
                            </div>
                            <span className="text-gray-700 font-medium">{completionRate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-r from-resilinc-primary to-blue-600">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Advanced Reports</h1>
            <p className="text-blue-100">Generate detailed analytics and export data reports</p>
          </div>
          <BarChart3 className="h-12 w-12 text-white opacity-80" />
        </div>
      </Card>

      {/* Filters Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-resilinc-primary" />
            <CardTitle>Report Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Report Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Report Type
              </label>
              <Select
                value={selectedReport}
                onChange={(e) => setSelectedReport(e.target.value as ReportType)}
                className="w-full"
              >
                <option value="job-summary">Job Summary</option>
                <option value="driver-performance">Driver Performance</option>
                <option value="customer-analysis">Customer Analysis</option>
                <option value="exception-report">Exception Report</option>
                <option value="delivery-performance">Delivery Performance</option>
                <option value="warehouse-utilization">Warehouse Utilization</option>
              </Select>
            </div>

            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date Range
              </label>
              <Select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRange)}
                className="w-full"
              >
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="quarter">Last 90 Days</option>
                <option value="year">Last Year</option>
                <option value="custom">Custom Range</option>
              </Select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status Filter
              </label>
              <Select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="en-route">En Route</option>
                <option value="delivered">Delivered</option>
                <option value="exception">Exception</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority Filter
              </label>
              <Select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                className="w-full"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </Select>
            </div>

            {/* Warehouse Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Warehouse Filter
              </label>
              <Select
                value={selectedWarehouse}
                onChange={(e) => setSelectedWarehouse(e.target.value)}
                className="w-full"
              >
                <option value="all">All Warehouses</option>
                {warehouses.map(wh => (
                  <option key={wh} value={wh}>{wh}</option>
                ))}
              </Select>
            </div>

            {/* Transporter Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transporter Filter
              </label>
              <Select
                value={selectedTransporter}
                onChange={(e) => setSelectedTransporter(e.target.value)}
                className="w-full"
              >
                <option value="all">All Transporters</option>
                {transporters.map(transporter => (
                  <option key={transporter.id} value={transporter.id}>
                    {transporter.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* ETA Week Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ETA Week Filter
              </label>
              <Select
                value={etaWeekFilter}
                onChange={(e) => setEtaWeekFilter(e.target.value)}
                className="w-full"
              >
                <option value="all">All Weeks</option>
                {etaWeeks.map(week => {
                  const [year, weekNum] = week.split('-W');
                  return (
                    <option key={week} value={week}>
                      Week {weekNum}, {year}
                    </option>
                  );
                })}
              </Select>
            </div>
          </div>

          {/* Custom Date Range */}
          {dateRange === "custom" && (
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-white">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-resilinc-primary" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{metrics.total}</div>
              <div className="text-xs uppercase tracking-wide text-gray-600">Total Jobs</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-50 to-white">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div>
              <div className="text-2xl font-bold text-green-600">{metrics.completionRate}%</div>
              <div className="text-xs uppercase tracking-wide text-gray-600">Completion Rate</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-orange-50 to-white">
          <div className="flex items-center gap-3">
            <Truck className="h-8 w-8 text-orange-600" />
            <div>
              <div className="text-2xl font-bold text-orange-600">{metrics.inProgress}</div>
              <div className="text-xs uppercase tracking-wide text-gray-600">In Progress</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-red-50 to-white">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-red-600" />
            <div>
              <div className="text-2xl font-bold text-red-600">{metrics.exceptions}</div>
              <div className="text-xs uppercase tracking-wide text-gray-600">Exceptions</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Export Actions */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FileText className="h-4 w-4" />
            <span>
              Showing <span className="font-semibold text-gray-900">{filteredJobs.length}</span> records
            </span>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportToCSV} variant="outline" className="gap-2">
              <FileDown className="h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={exportToExcel} className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </div>
      </Card>

      {/* Report Content */}
      {renderReportContent()}
    </div>
  );
};
