import { useMemo, useState } from "react";
import { AlertTriangle, Clock, ClipboardList, PackageCheck, Search, ShieldAlert } from "lucide-react";
import { useDispatch } from "../../context/DispatchContext";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Input } from "../ui/Input";
import { JobDetailsModal } from "../JobDetailsModal";
import type { Job } from "../../types";
import { buildExceptionQueues, type ExceptionQueueItem, type ExceptionQueueKey } from "../../utils/exceptionQueues";
import { formatDate, formatNumber } from "../../utils/format";

type QueueFilter = "all" | ExceptionQueueKey;

interface ExceptionsViewProps {
  onNavigate?: (page: string, tab?: string) => void;
}

const QUEUE_META: Record<ExceptionQueueKey, { label: string; icon: typeof AlertTriangle; tone: string }> = {
  exceptions: { label: "Exceptions", icon: ShieldAlert, tone: "text-red-600 bg-red-50 border-red-100" },
  overdue: { label: "Overdue", icon: Clock, tone: "text-amber-700 bg-amber-50 border-amber-100" },
  dispatchDue: { label: "Dispatch Due", icon: PackageCheck, tone: "text-blue-700 bg-blue-50 border-blue-100" },
  priority: { label: "Priority Pending", icon: AlertTriangle, tone: "text-purple-700 bg-purple-50 border-purple-100" },
};

function queueBadge(queue: ExceptionQueueKey) {
  if (queue === "exceptions") return "destructive";
  if (queue === "overdue") return "warning";
  return "new";
}

export const ExceptionsView: React.FC<ExceptionsViewProps> = ({ onNavigate }) => {
  const { jobs, drivers } = useDispatch();
  const [activeQueue, setActiveQueue] = useState<QueueFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const queues = useMemo(() => buildExceptionQueues(jobs), [jobs]);
  const allItems = useMemo(() => Object.values(queues).flat(), [queues]);

  const filteredItems = useMemo(() => {
    const source = activeQueue === "all" ? allItems : queues[activeQueue];
    const needle = query.trim().toLowerCase();
    if (!needle) return source;
    return source.filter((item) => {
      const text = [
        item.title,
        item.description,
        item.job.ref,
        item.job.customer,
        item.job.pickup,
        item.job.dropoff,
        item.job.warehouse || "",
      ].join(" ").toLowerCase();
      return text.includes(needle);
    });
  }, [activeQueue, allItems, query, queues]);

  const selectedDriverName = selectedJob?.driverId
    ? drivers.find((driver) => driver.id === selectedJob.driverId)?.name
    : undefined;

  const totalCritical = allItems.filter((item) => item.severity === "critical").length;

  const renderQueueCard = (queue: ExceptionQueueKey) => {
    const meta = QUEUE_META[queue];
    const Icon = meta.icon;
    const count = queues[queue].length;
    return (
      <button
        key={queue}
        onClick={() => setActiveQueue(queue)}
        className={`rounded-lg border px-4 py-3 text-left transition-all ${meta.tone} ${
          activeQueue === queue ? "ring-2 ring-gray-900/10 shadow-sm" : "hover:shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <Icon className="h-5 w-5" />
          <span className="text-2xl font-bold">{formatNumber(count)}</span>
        </div>
        <p className="mt-2 text-sm font-semibold">{meta.label}</p>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exception Queues</h1>
          <p className="mt-1 text-sm text-gray-500">
            Operational work that needs attention, grouped into actionable queues.
          </p>
        </div>
        <Button className="gap-2" onClick={() => onNavigate?.("clipboard", "open")}>
          <ClipboardList className="h-4 w-4" />
          Open Orders
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <button
          onClick={() => setActiveQueue("all")}
          className={`rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition-all ${
            activeQueue === "all" ? "ring-2 ring-gray-900/10 shadow-sm" : "hover:shadow-sm"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <AlertTriangle className="h-5 w-5 text-gray-600" />
            <span className="text-2xl font-bold text-gray-900">{formatNumber(allItems.length)}</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-gray-800">All Queues</p>
          <p className="mt-0.5 text-xs text-gray-500">{formatNumber(totalCritical)} critical</p>
        </button>
        {(["exceptions", "overdue", "dispatchDue", "priority"] as ExceptionQueueKey[]).map(renderQueueCard)}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{activeQueue === "all" ? "All Exceptions" : QUEUE_META[activeQueue].label}</CardTitle>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search queues..."
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center">
              <p className="text-sm font-medium text-gray-700">No queue items found</p>
              <p className="mt-1 text-xs text-gray-500">Adjust the queue or search filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Queue</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Order</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Customer</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Route</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Due / Updated</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Reason</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item: ExceptionQueueItem) => (
                    <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <Badge variant={queueBadge(item.queue)}>{QUEUE_META[item.queue].label}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          className="font-semibold text-resilinc-primary hover:text-resilinc-primary-dark hover:underline"
                          onClick={() => setSelectedJob(item.job)}
                        >
                          {item.job.ref}
                        </button>
                        <div className="mt-1 text-xs text-gray-400">{item.job.status}</div>
                      </td>
                      <td className="px-3 py-3 text-gray-700">{item.job.customer}</td>
                      <td className="px-3 py-3 text-xs text-gray-600">{item.job.pickup} {"->"} {item.job.dropoff}</td>
                      <td className="px-3 py-3 text-xs text-gray-600">
                        {formatDate(item.date || item.job.updatedAt)}
                        {item.days !== undefined && (
                          <div className={item.days > 0 ? "font-semibold text-red-600" : "text-gray-400"}>
                            {item.days > 0 ? `${item.days}d overdue` : item.days === 0 ? "today" : "tomorrow"}
                          </div>
                        )}
                      </td>
                      <td className="max-w-[280px] px-3 py-3 text-xs text-gray-600">{item.description}</td>
                      <td className="px-3 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedJob(item.job)}>
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          driverName={selectedDriverName}
          onClose={() => setSelectedJob(null)}
          onSelectLineItem={(lineItem) => setSelectedJob(lineItem)}
        />
      )}
    </div>
  );
};
