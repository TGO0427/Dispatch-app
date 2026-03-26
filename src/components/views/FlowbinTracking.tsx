import React, { useState, useEffect, useMemo } from "react";
import { Package, Search, CheckCircle2, AlertTriangle, XCircle, X, RotateCcw } from "lucide-react";
import { Card, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
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
  "warning": { label: "Warning (2+ weeks)", color: "text-amber-700", bg: "bg-amber-100" },
  "overdue": { label: "Overdue (4+ weeks)", color: "text-red-700", bg: "bg-red-100" },
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
    };
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flowbin Tracking</h1>
          <p className="text-sm text-gray-500">Track flowbins at customer sites — 2 week warning, 4 week cutoff</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {([
          { icon: Package, label: "Total", value: stats.total, color: "text-gray-900", iconColor: "text-blue-600", bg: "bg-blue-50" },
          { icon: CheckCircle2, label: "On Time", value: stats.onTime, color: "text-green-600", iconColor: "text-green-600", bg: "bg-green-50" },
          { icon: AlertTriangle, label: "Warning", value: stats.warning, color: "text-amber-600", iconColor: "text-amber-600", bg: "bg-amber-50" },
          { icon: XCircle, label: "Overdue", value: stats.overdue, color: "text-red-600", iconColor: "text-red-600", bg: "bg-red-50" },
          { icon: CheckCircle2, label: "Returned", value: stats.returned, color: "text-blue-600", iconColor: "text-blue-600", bg: "bg-blue-50" },
        ] as const).map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label} className="p-3">
              <div className="flex items-center gap-2.5">
                <div className={`rounded-lg p-1.5 ${kpi.bg}`}><Icon className={`h-4 w-4 ${kpi.iconColor}`} /></div>
                <div>
                  <div className={`text-xl font-bold leading-tight ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">{kpi.label}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text" placeholder="Search ref, customer, destination..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 h-8 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 text-xs">
          <option value="all">All Status</option>
          <option value="on-time">On Time</option>
          <option value="warning">Warning (2+ wks)</option>
          <option value="overdue">Overdue (4+ wks)</option>
          <option value="returned">Returned</option>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              {flowbinJobs.length === 0 ? "No flowbins tracked yet — enable flowbin on a job to start" : "No flowbins matching your filters"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left p-3 font-semibold text-gray-700">Reference</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Customer</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Destination</th>
                    <th className="text-left p-3 font-semibold text-gray-700">ETA</th>
                    <th className="text-center p-3 font-semibold text-gray-700">Days at Client</th>
                    <th className="text-center p-3 font-semibold text-gray-700">Status</th>
                    <th className="text-center p-3 font-semibold text-gray-700">Sent</th>
                    <th className="text-center p-3 font-semibold text-gray-700">Outstanding</th>
                    <th className="text-left p-3 font-semibold text-gray-700"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((job) => {
                    const cfg = statusConfig[job.status_fb];
                    const batches = job.flowbinBatches || [];
                    const isExpanded = expandedJob === job.id;
                    return (
                      <React.Fragment key={job.id}>
                        <tr className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-3">
                            <button className="font-medium text-blue-600 hover:text-blue-800 hover:underline" onClick={() => setSelectedJob(job)}>{job.ref}</button>
                          </td>
                          <td className="p-3 text-gray-700">{job.customer}</td>
                          <td className="p-3 text-gray-700 text-xs">{job.dropoff}</td>
                          <td className="p-3 text-gray-700 text-xs">{job.eta || "—"}</td>
                          <td className="p-3 text-center">
                            <span className={`font-bold ${job.daysAtClient >= 28 ? "text-red-600" : job.daysAtClient >= 14 ? "text-amber-600" : "text-green-600"}`}>
                              {job.daysAtClient}d
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="p-3 text-center text-gray-600">
                            {batches.reduce((sum, b) => sum + b.quantity, 0)}
                          </td>
                          <td className="p-3 text-center">
                            {(() => {
                              const totalSent = batches.reduce((sum, b) => sum + b.quantity, 0);
                              const totalReturned = batches.reduce((sum, b) => sum + (b.quantityReturned || 0), 0);
                              const outstanding = totalSent - totalReturned;
                              return outstanding > 0 ? (
                                <span className="font-bold text-red-600">{outstanding}</span>
                              ) : (
                                <span className="font-bold text-green-600">0</span>
                              );
                            })()}
                          </td>
                          <td className="p-3">
                            <button onClick={() => setExpandedJob(isExpanded ? null : job.id)} className="text-xs text-blue-600 hover:text-blue-800">
                              {isExpanded ? "Hide" : "View"} batches
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="p-3 bg-gray-50">
                              {batches.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center">No batches added yet</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {batches.map((b) => {
                                    const outstanding = b.quantity - (b.quantityReturned || 0);
                                    return (
                                      <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-gray-100">
                                        <div className="flex items-center gap-3">
                                          <span className="text-sm font-medium text-gray-900">{b.batchNumber}</span>
                                          <span className="text-xs text-gray-500">Sent: {b.quantity}</span>
                                          {b.returnedAt ? (
                                            <>
                                              <span className="text-xs text-green-600">Returned: {b.quantityReturned ?? b.quantity}</span>
                                              {outstanding > 0 && (
                                                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                                  {outstanding} outstanding
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
                                            <button onClick={() => handleUnmarkReturned(b.id)} className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1">
                                              <RotateCcw className="h-3 w-3" /> Undo
                                            </button>
                                          ) : (
                                            <Button size="sm" onClick={() => openReturnModal(b, job.ref)} className="text-xs h-7 bg-green-600 hover:bg-green-700">
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
