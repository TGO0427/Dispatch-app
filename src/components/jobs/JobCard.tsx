// src/components/jobs/JobCard.tsx
import type { Job, JobStatus, JobPriority } from "../../types";
import { useDispatch } from "../../context/DispatchContext";

const toIsoDate = (v: string) => (v.length <= 10 ? v : new Date(v).toISOString());

export default function JobCard({ job }: { job: Job }) {
  const { updateJob } = useDispatch();

  const setStatus = (status: JobStatus) => {
    const patch: Partial<Job> = { status };
    if (status === "delivered" && !job.actualDeliveryAt) {
      patch.actualDeliveryAt = new Date().toISOString();
    }
    updateJob(job.id, patch);
  };

  const setActualDelivery = (value: string) =>
    updateJob(job.id, { actualDeliveryAt: toIsoDate(value) });

  const setPriority = (priority: JobPriority) => updateJob(job.id, { priority });
  const setNotes = (notes: string) => updateJob(job.id, { notes });

  return (
    <div className="rounded-xl border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-zinc-500 truncate">{job.ref}</div>
          <div className="text-base font-semibold truncate">{job.customer}</div>
          <div className="text-sm text-zinc-600 truncate">
            {job.pickup} → {job.dropoff}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Priority */}
          <select
            className="text-sm border rounded-md px-2 py-1"
            value={job.priority}
            onChange={(e) => setPriority(e.target.value as JobPriority)}
            title="Priority"
          >
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          {/* Status */}
          <select
            className="text-sm border rounded-md px-2 py-1"
            value={job.status}
            onChange={(e) => setStatus(e.target.value as JobStatus)}
            title="Status"
          >
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="en-route">En route</option>
            <option value="delivered">Delivered</option>
            <option value="exception">Exception</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Dates & notes */}
      <div className="mt-3 grid gap-3 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-500">ETA</span>
          <span className="font-medium">{job.eta ?? "—"}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <label className="text-zinc-500">Actual delivery</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="text-sm border rounded-md px-2 py-1"
              value={job.actualDeliveryAt ? job.actualDeliveryAt.slice(0, 10) : ""}
              onChange={(e) => setActualDelivery(e.target.value)}
            />
            {job.status !== "delivered" && (
              <button
                type="button"
                className="text-xs rounded-md px-2 py-1 border hover:bg-zinc-50"
                onClick={() => setStatus("delivered")}
                title="Mark delivered now"
              >
                Mark delivered (now)
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-zinc-500 min-w-16">Notes</label>
          <input
            type="text"
            className="flex-1 text-sm border rounded-md px-2 py-1"
            placeholder="Add note…"
            defaultValue={job.notes ?? ""}
            onBlur={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
