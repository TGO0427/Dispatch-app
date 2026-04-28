import { useEffect, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useDispatch } from "../../context/DispatchContext";
import { Card, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { JobDetailsModal } from "../JobDetailsModal";
import type { Job } from "../../types";

export const CalendarView: React.FC = () => {
  const { jobs, drivers } = useDispatch();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const firstDayOfMonth = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  }, [currentDate]);

  const daysInMonth = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  }, [currentDate]);

  const startingDayOfWeek = useMemo(() => {
    return firstDayOfMonth.getDay();
  }, [firstDayOfMonth]);

  const parseDateString = (dateStr: string): Date | null => {
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return new Date(dateStr.slice(0, 10) + "T00:00:00");
    const ddmm = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmm) return new Date(parseInt(ddmm[3]), parseInt(ddmm[2]) - 1, parseInt(ddmm[1]));
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const jobsByDate = useMemo(() => {
    const grouped: Record<string, Job[]> = {};
    jobs.forEach((job) => {
      const dateStr = job.scheduledAt || job.eta || job.createdAt;
      if (!dateStr) return;
      const date = parseDateString(dateStr);
      if (!date) return;
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(job);
    });
    return grouped;
  }, [jobs]);

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(day);
    return days;
  }, [startingDayOfWeek, daysInMonth]);

  const goToPreviousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const isToday = (day: number): boolean => {
    const today = new Date();
    return day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
  };

  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Monthly summary — counts distinct order refs (not lines) per type per day,
  // plus total line count for context. Same ref on same day counts once.
  const monthStats = useMemo(() => {
    let orders = 0, ibts = 0, totalLines = 0, datesWithJobs = 0;
    Object.entries(jobsByDate).forEach(([dateKey, dayJobs]) => {
      // Local-midnight parse; `new Date("YYYY-MM-DD")` is UTC and shifts west of UTC.
      const d = new Date(`${dateKey}T00:00:00`);
      if (d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear()) {
        datesWithJobs++;
        const orderRefs = new Set<string>();
        const ibtRefs = new Set<string>();
        dayJobs.forEach((j) => {
          totalLines++;
          if (j.jobType === "ibt") ibtRefs.add(j.ref || j.id);
          else orderRefs.add(j.ref || j.id);
        });
        orders += orderRefs.size;
        ibts += ibtRefs.size;
      }
    });
    return { orders, ibts, totalLines, datesWithJobs };
  }, [jobsByDate, currentDate]);

  // Orders for the day clicked in the day-detail modal — grouped by ref.
  const selectedDayOrders = useMemo(() => {
    if (!selectedDayKey) return [];
    const dayJobs = jobsByDate[selectedDayKey] || [];
    const groups = new Map<string, { ref: string; primary: Job; lineCount: number; totalPallets: number; hasPalletData: boolean }>();
    dayJobs.forEach((job) => {
      const key = job.ref || job.id;
      const existing = groups.get(key);
      if (existing) {
        existing.lineCount += 1;
        existing.totalPallets += job.pallets ?? 0;
        if (job.pallets != null) existing.hasPalletData = true;
      } else {
        groups.set(key, {
          ref: key,
          primary: job,
          lineCount: 1,
          totalPallets: job.pallets ?? 0,
          hasPalletData: job.pallets != null,
        });
      }
    });
    return Array.from(groups.values()).sort((a, b) => a.ref.localeCompare(b.ref));
  }, [selectedDayKey, jobsByDate]);

  const selectedDayLineCount = useMemo(
    () => selectedDayOrders.reduce((sum, o) => sum + o.lineCount, 0),
    [selectedDayOrders],
  );

  // Esc closes the day-detail modal.
  useEffect(() => {
    if (!selectedDayKey) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedDayKey(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedDayKey]);

  const getChipStyle = (job: Job): { bg: string; text: string; dot: string } => {
    // IBT = purple, Customer orders by status
    if (job.jobType === "ibt") return { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" };
    if (job.status === "delivered") return { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" };
    if (job.status === "en-route") return { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500" };
    if (job.status === "exception") return { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" };
    if (job.priority === "urgent") return { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-400" };
    if (job.priority === "high") return { bg: "bg-orange-50", text: "text-orange-600", dot: "bg-orange-400" };
    return { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" };
  };

  const getDriverName = (driverId?: string) => {
    if (!driverId) return undefined;
    return drivers.find((d) => d.id === driverId)?.name;
  };

  return (
    <div className="space-y-3">
      {/* Header — compact with nav */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scheduling</h1>
          <p className="text-sm text-gray-500">
            {monthStats.orders} orders, {monthStats.ibts} IBT this month across {monthStats.datesWithJobs} dates
            {monthStats.totalLines !== monthStats.orders + monthStats.ibts && ` (${monthStats.totalLines} lines total)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="hidden lg:flex items-center gap-3 mr-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> Customer Order</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> IBT</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> En Route</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Delivered</span>
          </div>
          <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
          <Button variant="outline" size="sm" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Month title */}
      <div className="text-center">
        <h2 className="text-lg font-bold text-gray-900">{monthName}</h2>
      </div>

      {/* Calendar */}
      <Card>
        <CardContent className="p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="text-center font-semibold text-xs text-gray-500 py-1.5">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid — denser cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="min-h-[80px]" />;
              }

              const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayJobs = jobsByDate[dateKey] || [];
              const today = isToday(day);

              // Deduplicate by ref for display + counting; same ref = same order regardless of line count.
              const refMap = new Map<string, { job: Job; count: number }>();
              dayJobs.forEach((j) => {
                const existing = refMap.get(j.ref);
                if (!existing) refMap.set(j.ref, { job: j, count: 1 });
                else existing.count++;
              });
              const uniqueJobs = Array.from(refMap.values());
              const isHighVolume = uniqueJobs.length >= 5;
              const hasJobs = uniqueJobs.length > 0;

              return (
                <div
                  key={day}
                  className={`min-h-[80px] border rounded-lg p-1.5 overflow-hidden transition-colors ${
                    isHighVolume
                      ? "border-amber-300 bg-amber-50/50"
                      : today
                        ? "border-blue-400 bg-blue-50/50"
                        : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => hasJobs && setSelectedDayKey(dateKey)}
                    disabled={!hasJobs}
                    className={`flex items-center justify-between w-full mb-1 ${hasJobs ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                    title={hasJobs ? "View all orders for this day" : undefined}
                  >
                    <span className={`text-xs font-bold ${
                      today ? "text-resilinc-primary" : isHighVolume ? "text-amber-700" : "text-gray-600"
                    }`}>
                      {day}
                    </span>
                    {hasJobs && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          isHighVolume
                            ? "bg-amber-200 text-amber-800"
                            : "bg-gray-100 text-gray-500"
                        }`}
                        title={dayJobs.length !== uniqueJobs.length ? `${uniqueJobs.length} orders (${dayJobs.length} lines)` : `${uniqueJobs.length} orders`}
                      >
                        {uniqueJobs.length}
                      </span>
                    )}
                  </button>

                  <div className="space-y-0.5">
                    {uniqueJobs.slice(0, 3).map(({ job, count }) => {
                      const style = getChipStyle(job);
                      return (
                        <button
                          key={job.id}
                          onClick={() => setSelectedJob(job)}
                          className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] truncate flex items-center gap-1 ${style.bg} ${style.text} hover:opacity-80 transition-opacity`}
                          title={`${job.ref} — ${job.customer}${count > 1 ? ` (${count} items)` : ""}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
                          <span className="truncate font-medium">{job.ref}</span>
                          {count > 1 && <span className="text-[8px] opacity-70 flex-shrink-0">×{count}</span>}
                        </button>
                      );
                    })}
                    {uniqueJobs.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setSelectedDayKey(dateKey)}
                        className="text-[10px] text-resilinc-primary hover:text-resilinc-primary-dark hover:underline px-1 font-medium cursor-pointer"
                      >
                        +{uniqueJobs.length - 3} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day-detail modal — full list of orders for the selected day */}
      {selectedDayKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedDayKey(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Orders on {new Date(`${selectedDayKey}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  {selectedDayOrders.length} {selectedDayOrders.length === 1 ? "order" : "orders"}
                  {selectedDayLineCount !== selectedDayOrders.length && ` (${selectedDayLineCount} lines)`}
                </p>
              </div>
              <button
                onClick={() => setSelectedDayKey(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(85vh-80px)]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-semibold text-gray-700">Reference</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Type</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Lines</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Customer</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Status</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Route</th>
                    <th className="text-right p-3 font-semibold text-gray-700">Pallets</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Transporter</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDayOrders.map(({ ref, primary, lineCount, totalPallets, hasPalletData }) => (
                    <tr
                      key={ref}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => { setSelectedDayKey(null); setSelectedJob(primary); }}
                    >
                      <td className="p-3 font-medium">
                        <span className="text-resilinc-primary hover:text-resilinc-primary-dark hover:underline">{ref}</span>
                      </td>
                      <td className="p-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                          primary.jobType === "ibt" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {primary.jobType === "ibt" ? "IBT" : "ORDER"}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                          {lineCount} {lineCount === 1 ? "line" : "lines"}
                        </span>
                      </td>
                      <td className="p-3 text-gray-700">{primary.customer}</td>
                      <td className="p-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          primary.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                          primary.status === "assigned" ? "bg-blue-100 text-blue-700" :
                          primary.status === "en-route" ? "bg-indigo-100 text-indigo-700" :
                          primary.status === "delivered" ? "bg-green-100 text-green-700" :
                          primary.status === "exception" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {primary.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-700 text-xs">{primary.pickup} → {primary.dropoff}</td>
                      <td className="p-3 text-right font-medium">{hasPalletData ? totalPallets : "—"}</td>
                      <td className="p-3 text-gray-700">
                        {primary.driverId ? drivers.find((d) => d.id === primary.driverId)?.name ?? "Unassigned" : "Unassigned"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Job Details Modal */}
      {selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          driverName={getDriverName(selectedJob.driverId)}
        />
      )}
    </div>
  );
};
