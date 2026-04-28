import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDispatch } from "../../context/DispatchContext";
import { Card, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { JobDetailsModal } from "../JobDetailsModal";
import type { Job } from "../../types";

export const CalendarView: React.FC = () => {
  const { jobs, drivers } = useDispatch();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

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

  const getJobsForDay = (day: number): Job[] => {
    const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return jobsByDate[dateKey] || [];
  };

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

              const dayJobs = getJobsForDay(day);
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
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${
                      today ? "text-resilinc-primary" : isHighVolume ? "text-amber-700" : "text-gray-600"
                    }`}>
                      {day}
                    </span>
                    {uniqueJobs.length > 0 && (
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
                  </div>

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
                      <div className="text-[10px] text-gray-400 px-1">
                        +{uniqueJobs.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
