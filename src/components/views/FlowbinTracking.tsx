import React, { useState, useEffect, useMemo } from "react";
import { Package, Search, X, RotateCcw, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Card, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { JobDetailsModal } from "../JobDetailsModal";
import { useDispatch } from "../../context/DispatchContext";
import { useAuth } from "../../context/AuthContext";
import { flowbinsAPI } from "../../services/api";
import type { Job, FlowbinBatch, FlowbinStatus } from "../../types";

function getFlowbinStatus(eta: string | undefined, batches: FlowbinBatch[]): FlowbinStatus {
  if (batches.length > 0 && batches.every((b) => b.returnedAt)) return "returned";
  if (!eta) return "on-time";
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const etaDate = new Date(eta); etaDate.setHours(0, 0, 0, 0);
  const daysAtClient = Math.floor((now.getTime() - etaDate.getTime()) / 86400000);
  if (daysAtClient >= 28) return "overdue";
  if (daysAtClient >= 14) return "warning";
  return "on-time";
}

function getDaysAtClient(eta: string | undefined): number {
  if (!eta) return 0;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const etaDate = new Date(eta); etaDate.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((now.getTime() - etaDate.getTime()) / 86400000));
}

const statusConfig: Record<FlowbinStatus, { label: string; color: string; bg: string }> = {
  "on-time": { label: "On Time", color: "text-green-700", bg: "bg-green-100" },
  "warning": { label: "Warning", color: "text-amber-700", bg: "bg-amber-100" },
  "overdue": { label: "Overdue", color: "text-red-700", bg: "bg-red-100" },
  "returned": { label: "Returned", color: "text-blue-700", bg: "bg-blue-100" },
};

export const FlowbinTracking: React.FC = () => {
  const { drivers } = useDispatch();
  const { isViewer } = useAuth();
  const [flowbinJobs, setFlowbinJobs] = useState<(Job & { flowbinBatches: FlowbinBatch[] })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const data = await flowbinsAPI.getAll();
      setFlowbinJobs(data);
    } catch (err) {
      console.error("Failed to fetch flowbin data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    return flowbinJobs
      .map((j) => ({
        ...j,
        status_fb: getFlowbinStatus(j.eta, j.flowbinBatches || []),
        daysAtClient: getDaysAtClient(j.eta),
      }))
      .filter((j) => {
        if (statusFilter !== "all" && j.status_fb !== statusFilter) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (!j.ref.toLowerCase().includes(q) && !j.customer.toLowerCase().includes(q) && !j.dropoff.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.daysAtClient - a.daysAtClient);
  }, [flowbinJobs, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const all = flowbinJobs.map((j) => getFlowbinStatus(j.eta, j.flowbinBatches || []));
    return {
      total: all.length,
      onTime: all.filter((s) => s === "on-time").length,
      warning: all.filter((s) => s === "warning").length,
      overdue: all.filter((s) => s === "overdue").length,
      returned: all.filter((s) => s === "returned").length,
      totalSent: flowbinJobs.reduce((sum, j) => sum + (j.flowbinBatches || []).reduce((s, b) => s + b.quantity, 0), 0),
      totalOutstanding: flowbinJobs.reduce((sum, j) => sum + (j.flowbinBatches || []).reduce((s, b) => s + b.quantity - (b.quantityReturned || 0), 0), 0),
    };
  }, [flowbinJobs]);

  // Aging buckets (exclude fully returned jobs)
  const agingBuckets = useMemo(() => {
    const active = flowbinJobs.filter((j) => {
      const batches = j.flowbinBatches || [];
      return batches.length === 0 || !batches.every((b) => b.returnedAt);
    });
    const buckets = { safe: 0, warning: 0, overdue: 0 };
    active.forEach((j) => {
      const days = getDaysAtClient(j.eta);
      if (days >= 28) buckets.overdue++;
      else if (days >= 14) buckets.warning++;
      else buckets.safe++;
    });
    return buckets;
  }, [flowbinJobs]);

  // Customer exposure (top 5 by outstanding flowbins)
  const customerExposure = useMemo(() => {
    const map = new Map<string, number>();
    flowbinJobs.forEach((j) => {
      const batches = j.flowbinBatches || [];
      const outstanding = batches.reduce((s, b) => s + b.quantity - (b.quantityReturned || 0), 0);
      if (outstanding > 0) {
        map.set(j.customer, (map.get(j.customer) || 0) + outstanding);
      }
    });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [flowbinJobs]);

  // Return modal state
  const [returnModal, setReturnModal] = useState<{ batch: FlowbinBatch; jobRef: string } | null>(null);
  const [returnQty, setReturnQty] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [returnNotes, setReturnNotes] = useState("");

  const openReturnModal = (batch: FlowbinBatch, jobRef: string) => {
    setReturnModal({ batch, jobRef });
    setReturnQty(String(batch.quantity));
    setReturnDate(new Date().toISOString().slice(0, 10));
    setReturnNotes("");
  };

  const handleSubmitReturn = async () => {
    if (!returnModal || !returnQty) return;
    await flowbinsAPI.markReturned(returnModal.batch.id, {
      quantityReturned: Number(returnQty),
      returnedAt: new Date(returnDate + "T00:00:00").toISOString(),
      returnNotes: returnNotes.trim() || undefined,
    });
    setReturnModal(null);
    fetchData();
  };

  const handleUnmarkReturned = async (batchId: string) => {
    await flowbinsAPI.update(batchId, { returnedAt: null, quantityReturned: null, returnNotes: null });
    fetchData();
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Flowbin Tracking</h1>
        <p className="text-xs text-gray-400 mt-0.5">2 week warning, 4 week cutoff</p>
      </div>

      {/* KPI Filter Strip + Totals */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5 flex-1">
          {([
            { label: "All", value: stats.total, color: "text-gray-900", dotColor: "bg-gray-400", filterValue: "all" },
            { label: "On Time", value: stats.onTime, color: "text-green-600", dotColor: "bg-green-500", filterValue: "on-time" },
            { label: "Warning", value: stats.warning, color: "text-amber-600", dotColor: "bg-amber-500", filterValue: "warning" },
            { label: "Overdue", value: stats.overdue, color: "text-red-600", dotColor: "bg-red-500", filterValue: "overdue" },
            { label: "Returned", value: stats.returned, color: "text-blue-600", dotColor: "bg-blue-500", filterValue: "returned" },
          ]).map((kpi) => {
            const isActive = statusFilter === kpi.filterValue;
            return (
              <button
                key={kpi.label}
                onClick={() => setStatusFilter(isActive ? "all" : kpi.filterValue)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-left transition-all ${
                  isActive
                    ? "border-gray-900 bg-gray-900 text-white shadow-sm"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-white" : kpi.dotColor}`} />
                <div className={`text-sm font-bold leading-tight ${isActive ? "text-white" : kpi.color}`}>{kpi.value}</div>
                <div className={`text-[10px] uppercase tracking-wider font-medium ${isActive ? "text-gray-300" : "text-gray-400"}`}>{kpi.label}</div>
              </button>
            );
          })}
        </div>
        {stats.total > 0 && (
          <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
            <div className="text-right">
              <div className="text-sm font-bold text-gray-900">{stats.totalSent}</div>
              <div className="text-[9px] text-gray-400 uppercase tracking-wider">Sent</div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-bold ${stats.totalOutstanding > 0 ? "text-red-600" : "text-green-600"}`}>{stats.totalOutstanding}</div>
              <div className="text-[9px] text-gray-400 uppercase tracking-wider">Out</div>
            </div>
          </div>
        )}
      </div>

      {/* Mini Charts — only shown when there's data */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {/* Aging Buckets */}
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Aging Pipeline</div>
            <div className="space-y-1.5">
              {([
                { label: "0–14 days", value: agingBuckets.safe, color: "bg-green-500", textColor: "text-green-700" },
                { label: "15–28 days", value: agingBuckets.warning, color: "bg-amber-500", textColor: "text-amber-700" },
                { label: "29+ days", value: agingBuckets.overdue, color: "bg-red-500", textColor: "text-red-700" },
              ]).map((bucket) => {
                const total = agingBuckets.safe + agingBuckets.warning + agingBuckets.overdue;
                const pct = total > 0 ? (bucket.value / total) * 100 : 0;
                return (
                  <div key={bucket.label} className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 w-16 flex-shrink-0">{bucket.label}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${bucket.color} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`text-xs font-bold w-5 text-right ${bucket.value > 0 ? bucket.textColor : "text-gray-300"}`}>{bucket.value}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Customer Exposure */}
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Top Exposure by Customer</div>
            {customerExposure.length === 0 ? (
              <p className="text-[10px] text-gray-300">No outstanding flowbins</p>
            ) : (
              <div className="space-y-1.5">
                {customerExposure.map(([name, count]) => {
                  const maxCount = customerExposure[0][1];
                  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                  return (
                    <div key={name} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-600 w-24 truncate flex-shrink-0" title={name}>{name}</span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-700 w-5 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          type="text" placeholder="Search by reference, customer, or destination..."
          value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 h-9 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
        />
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-10 text-gray-400 text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 px-6">
              {flowbinJobs.length === 0 ? (
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <Package className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-600">No flowbins tracked yet</p>
                  <p className="text-xs text-gray-400 mt-1">Open a job and toggle the Flowbin switch to start tracking</p>
                </div>
              ) : (
                <p className="text-center text-sm text-gray-400">No flowbins matching your filters</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">Reference</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">Customer</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs hidden lg:table-cell">Destination</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-gray-600 text-xs">ETA</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-600 text-xs">Days</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-600 text-xs">Status</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-600 text-xs">Sent</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-600 text-xs">Out</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-gray-600 text-xs w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((job) => {
                    const cfg = statusConfig[job.status_fb];
                    const batches = job.flowbinBatches || [];
                    const isExpanded = expandedJob === job.id;
                    const totalSent = batches.reduce((sum, b) => sum + b.quantity, 0);
                    const totalReturned = batches.reduce((sum, b) => sum + (b.quantityReturned || 0), 0);
                    const outstanding = totalSent - totalReturned;
                    return (
                      <React.Fragment key={job.id}>
                        <tr
                          className={`border-b border-gray-100 cursor-pointer transition-colors group ${isExpanded ? "bg-gray-50" : "hover:bg-blue-50/40"}`}
                          onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                        >
                          <td className="px-3 py-2.5">
                            <button
                              className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                              onClick={(e) => { e.stopPropagation(); setSelectedJob(job); }}
                            >
                              {job.ref}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 text-gray-700 text-xs">{job.customer}</td>
                          <td className="px-3 py-2.5 text-gray-500 text-xs hidden lg:table-cell truncate max-w-[160px]">{job.dropoff}</td>
                          <td className="px-3 py-2.5 text-gray-500 text-xs">{job.eta ? new Date(job.eta).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`text-xs font-bold ${job.daysAtClient >= 28 ? "text-red-600" : job.daysAtClient >= 14 ? "text-amber-600" : "text-green-600"}`}>
                              {job.daysAtClient}d
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-xs text-gray-600">{totalSent}</td>
                          <td className="px-3 py-2.5 text-center">
                            {outstanding > 0 ? (
                              <span className="text-xs font-bold text-red-600">{outstanding}</span>
                            ) : (
                              <span className="text-xs font-bold text-green-600">0</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-gray-900 mx-auto" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-300 group-hover:text-gray-600 transition-colors mx-auto" />
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="px-3 py-2.5 bg-gray-50/50 border-b border-gray-100">
                              {batches.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-2">No batches added yet</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {batches.map((b) => {
                                    const batchOutstanding = b.quantity - (b.quantityReturned || 0);
                                    return (
                                      <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-gray-100">
                                        <div className="flex items-center gap-3 flex-wrap">
                                          <span className="text-sm font-medium text-gray-900">{b.batchNumber}</span>
                                          <span className="text-xs text-gray-500">Sent: {b.quantity}</span>
                                          {b.returnedAt ? (
                                            <>
                                              <span className="text-xs text-green-600">Returned: {b.quantityReturned ?? b.quantity}</span>
                                              {batchOutstanding > 0 && (
                                                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                                  {batchOutstanding} outstanding
                                                </span>
                                              )}
                                              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                                {new Date(b.returnedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                                              </span>
                                              {b.returnNotes && (
                                                <span className="text-[10px] text-gray-500 italic">"{b.returnNotes}"</span>
                                              )}
                                            </>
                                          ) : (
                                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                              {b.quantity} outstanding
                                            </span>
                                          )}
                                        </div>
                                        {!isViewer && (
                                          b.returnedAt ? (
                                            <button onClick={(e) => { e.stopPropagation(); handleUnmarkReturned(b.id); }} className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1 flex-shrink-0">
                                              <RotateCcw className="h-3 w-3" /> Undo
                                            </button>
                                          ) : (
                                            <Button size="sm" onClick={(e) => { e.stopPropagation(); openReturnModal(b, job.ref); }} className="text-xs h-7 bg-green-600 hover:bg-green-700 flex-shrink-0">
                                              Receive Return
                                            </Button>
                                          )
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary footer — shown when data exists but keeps page from feeling empty */}
      {!isLoading && flowbinJobs.length > 0 && (
        <div className="flex items-start gap-2 px-1 text-[11px] text-gray-400">
          <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            Flowbins at customer sites for 14+ days trigger a warning. After 28 days they are marked overdue.
            Click any row to view batches and process returns.
          </span>
        </div>
      )}

      {/* Return Modal */}
      {returnModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setReturnModal(null)}
        >
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Receive Flowbin Return</h3>
                <p className="text-xs text-gray-500">{returnModal.jobRef} — {returnModal.batch.batchNumber}</p>
              </div>
              <button onClick={() => setReturnModal(null)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-sm text-gray-600">Quantity Dispatched</span>
                <span className="text-sm font-bold text-gray-900">{returnModal.batch.quantity}</span>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Quantity Returned</label>
                <input
                  type="number"
                  value={returnQty}
                  onChange={(e) => setReturnQty(e.target.value)}
                  min="0"
                  max={returnModal.batch.quantity}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                />
                {Number(returnQty) < returnModal.batch.quantity && Number(returnQty) >= 0 && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    {returnModal.batch.quantity - Number(returnQty)} flowbin(s) will be recorded as outstanding
                  </p>
                )}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Return Date</label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Notes (optional)</label>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  placeholder="Damage, missing units, condition..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button variant="ghost" onClick={() => setReturnModal(null)} className="flex-1 text-sm">
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitReturn}
                  disabled={!returnQty || Number(returnQty) < 0}
                  className="flex-1 text-sm bg-green-600 hover:bg-green-700"
                >
                  Confirm Return
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Job Details Modal */}
      {selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          onClose={() => { setSelectedJob(null); fetchData(); }}
          driverName={selectedJob.driverId ? drivers.find((d) => d.id === selectedJob.driverId)?.name : undefined}
        />
      )}
    </div>
  );
};
