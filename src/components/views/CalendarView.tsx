import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { useDispatch } from "../../context/DispatchContext";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Button } from "../ui/Button";
import { JobDetailsModal } from "../JobDetailsModal";
import type { Job } from "../../types";

export const CalendarView: React.FC = () => {
  const { jobs, drivers } = useDispatch();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Get the first day of the month and how many days in the month
  const firstDayOfMonth = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  }, [currentDate]);

  const daysInMonth = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  }, [currentDate]);

  const startingDayOfWeek = useMemo(() => {
    return firstDayOfMonth.getDay(); // 0 = Sunday, 1 = Monday, etc.
  }, [firstDayOfMonth]);

  // Helper function to parse various date formats
  const parseDateString = (dateStr: string): Date | null => {
    // If it's already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Date(dateStr + 'T00:00:00');
    }

    // If it's in DD/MM/YYYY format (common in Excel exports)
    const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    // If it's in MM/DD/YYYY format
    const mmddyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mmddyyyyMatch) {
      // Could be either format, try as MM/DD/YYYY
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Try parsing as ISO string or other standard formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }

    return null;
  };

  // Group jobs by date
  const jobsByDate = useMemo(() => {
    const grouped: Record<string, Job[]> = {};

    jobs.forEach((job) => {
      // Use scheduledAt if available, otherwise use eta, otherwise createdAt
      const dateStr = job.scheduledAt || job.eta || job.createdAt;
      if (!dateStr) return;

      // Parse the date
      const date = parseDateString(dateStr);

      if (!date) {
        console.warn(`Invalid date for job ${job.id}:`, dateStr);
        return;
      }

      // Format to YYYY-MM-DD
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(job);
    });

    console.log('Calendar: Grouped jobs by date:', grouped);
    console.log('Calendar: Total jobs:', jobs.length);

    return grouped;
  }, [jobs]);

  // Generate calendar days (including padding days from previous month)
  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];

    // Add empty slots for days before the month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  }, [startingDayOfWeek, daysInMonth]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getJobsForDay = (day: number): Job[] => {
    const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return jobsByDate[dateKey] || [];
  };

  const isToday = (day: number): boolean => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'normal': return 'bg-blue-500';
      case 'low': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getDriverName = (driverId?: string) => {
    if (!driverId) return undefined;
    return drivers.find((d) => d.id === driverId)?.name;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Calendar View</h1>
            <p className="text-gray-600">Schedule and timeline management</p>
            <p className="text-sm text-gray-500 mt-2">Showing {jobs.length} total jobs, {Object.keys(jobsByDate).length} dates with jobs</p>
          </div>
          <CalendarIcon className="h-12 w-12 text-gray-400" />
        </div>
      </Card>

      {/* Calendar Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-4">
              <CardTitle className="text-2xl">{monthName}</CardTitle>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
            </div>

            <Button variant="outline" size="sm" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center font-semibold text-sm text-gray-600 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }

              const dayJobs = getJobsForDay(day);
              const today = isToday(day);

              return (
                <div
                  key={day}
                  className={`
                    aspect-square border rounded-lg p-2 overflow-hidden
                    ${today ? 'border-blue-500 border-2 bg-blue-50' : 'border-gray-200'}
                    hover:border-gray-400 transition-colors
                  `}
                >
                  <div className={`text-sm font-semibold mb-1 ${today ? 'text-blue-600' : 'text-gray-700'}`}>
                    {day}
                  </div>

                  <div className="space-y-1">
                    {dayJobs.slice(0, 3).map((job) => (
                      <button
                        key={job.id}
                        onClick={() => setSelectedJob(job)}
                        className={`
                          w-full text-left px-1 py-0.5 rounded text-xs truncate
                          ${getPriorityColor(job.priority)} text-white
                          hover:opacity-80 transition-opacity
                        `}
                        title={`${job.ref} - ${job.customer}`}
                      >
                        {job.ref}
                      </button>
                    ))}
                    {dayJobs.length > 3 && (
                      <div className="text-xs text-gray-500 px-1">
                        +{dayJobs.length - 3} more
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
