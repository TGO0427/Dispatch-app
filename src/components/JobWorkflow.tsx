import React from "react";
import { CheckCircle2, Circle, Truck, Clock } from "lucide-react";
import { Job, TRANSPORT_SERVICES, TransportService } from "../types";

interface JobWorkflowProps {
  job: Job;
  onUpdate: (jobId: string, updates: Partial<Job>) => void;
  compact?: boolean;
}

// Subtract business days (skip Sat/Sun) from a date
function subtractBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    const dow = result.getDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) {
      remaining--;
    }
  }
  // If result lands on weekend, move to previous Friday
  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() - 1);
  }
  return result;
}

// Calculate ETD from ETA and transport service (business days only, no weekends)
function calculateETD(eta: string | undefined, service: TransportService): string | undefined {
  if (!eta) return undefined;
  const serviceConfig = TRANSPORT_SERVICES.find((s) => s.value === service);
  if (!serviceConfig) return undefined;

  const etaDate = new Date(eta);
  if (isNaN(etaDate.getTime())) return undefined;

  // Convert hours to business days (24h = 1 day, 48h = 2 days, 96h = 4 days)
  const businessDays = Math.ceil(serviceConfig.hours / 24);
  const etdDate = subtractBusinessDays(etaDate, businessDays);

  return `${etdDate.getFullYear()}-${String(etdDate.getMonth() + 1).padStart(2, "0")}-${String(etdDate.getDate()).padStart(2, "0")}`;
}

const serviceIcons: Record<string, string> = {
  express: "⚡",
  economy: "🚛",
  outline: "📦",
};

const serviceColors: Record<string, string> = {
  express: "bg-red-100 text-red-700 border-red-200",
  economy: "bg-blue-100 text-blue-700 border-blue-200",
  outline: "bg-gray-100 text-gray-700 border-gray-200",
};

export const JobWorkflow: React.FC<JobWorkflowProps> = ({ job, onUpdate, compact = false }) => {
  const isLocked = job.status === "en-route" || job.status === "delivered" || job.status === "cancelled";

  const handleToggle = (field: "transporterBooked" | "orderPicked" | "coaAvailable") => {
    if (isLocked) return;
    const updates: Partial<Job> = {
      [field]: !job[field],
    };

    const transporterBooked = field === "transporterBooked" ? !job.transporterBooked : job.transporterBooked;
    const orderPicked = field === "orderPicked" ? !job.orderPicked : job.orderPicked;
    const coaAvailable = field === "coaAvailable" ? !job.coaAvailable : job.coaAvailable;

    updates.readyForDispatch = !!(transporterBooked && orderPicked && coaAvailable);

    onUpdate(job.id, updates);
  };

  const handleTransportServiceChange = (service: TransportService) => {
    const etd = calculateETD(job.eta, service);
    onUpdate(job.id, { transportService: service, etd });
  };

  const workflowItems = [
    { id: "transporterBooked" as const, label: "Transporter Booked", checked: job.transporterBooked || false },
    { id: "orderPicked" as const, label: "Order Picked", checked: job.orderPicked || false },
    { id: "coaAvailable" as const, label: "COA Available", checked: job.coaAvailable || false },
  ];

  const allComplete = job.readyForDispatch || false;
  const currentService = TRANSPORT_SERVICES.find((s) => s.value === job.transportService);
  const computedETD = job.etd || (job.transportService ? calculateETD(job.eta, job.transportService) : undefined);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {workflowItems.map((item) => (
          <button
            key={item.id}
            onClick={(e) => { e.stopPropagation(); handleToggle(item.id); }}
            disabled={isLocked}
            className={`p-1 rounded-full transition-colors ${
              isLocked
                ? item.checked ? "text-green-600 opacity-60 cursor-default" : "text-gray-300 opacity-60 cursor-default"
                : item.checked ? "text-green-600 hover:text-green-700" : "text-gray-300 hover:text-gray-400"
            }`}
            title={isLocked ? `${item.label} (locked)` : item.label}
          >
            {item.checked ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
          </button>
        ))}
        {job.transportService && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${serviceColors[job.transportService] || "bg-gray-100 text-gray-600"}`}>
            {serviceIcons[job.transportService]} {currentService?.label}
          </span>
        )}
        {computedETD && (
          <span className="text-[10px] text-gray-500 font-medium" title="Estimated Departure">
            ETD: {computedETD}
          </span>
        )}
        {allComplete && (
          <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
            <Truck className="w-3 h-3" />
            <span>Ready</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <Truck className="w-4 h-4" />
        Dispatch Workflow
      </h4>

      {/* Workflow Checkboxes */}
      {isLocked && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <span>Workflow steps are locked — shipment is {job.status}.</span>
        </div>
      )}
      <div className="space-y-2">
        {workflowItems.map((item) => (
          <label
            key={item.id}
            className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
              isLocked ? "opacity-70 cursor-default" : "hover:bg-gray-50 cursor-pointer"
            }`}
          >
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => handleToggle(item.id)}
              disabled={isLocked}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <span className={`text-sm ${item.checked ? "text-gray-900 font-medium" : "text-gray-600"}`}>
              {item.label}
            </span>
            {item.checked && <CheckCircle2 className="w-4 h-4 text-green-600 ml-auto" />}
          </label>
        ))}
      </div>

      {/* Transport Service Selection */}
      <div className="pt-3 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4" />
          Transport Lead Time
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {TRANSPORT_SERVICES.map((service) => (
            <button
              key={service.value}
              onClick={() => !isLocked && handleTransportServiceChange(service.value)}
              disabled={isLocked}
              className={`p-3 rounded-lg border-2 text-center transition-all ${
                job.transportService === service.value
                  ? `${serviceColors[service.value]} border-current shadow-sm`
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              } ${isLocked ? "opacity-70 cursor-default" : ""}`}
            >
              <div className="text-lg mb-1">{serviceIcons[service.value]}</div>
              <div className="text-xs font-semibold">{service.label}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{service.businessDays} business day{service.businessDays > 1 ? "s" : ""}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ETD Display */}
      {computedETD && job.eta && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-blue-600 font-medium uppercase tracking-wider">Estimated Departure (ETD)</div>
              <div className="text-lg font-bold text-blue-900 mt-0.5">{computedETD}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-blue-600 font-medium uppercase tracking-wider">Requested Delivery (ETA)</div>
              <div className="text-lg font-bold text-blue-900 mt-0.5">{job.eta.split("T")[0]}</div>
            </div>
          </div>
          {currentService && (
            <div className="mt-2 text-xs text-blue-700">
              {serviceIcons[job.transportService!]} {currentService.label} — {currentService.businessDays} business day{currentService.businessDays > 1 ? "s" : ""} lead time (excl. weekends)
            </div>
          )}
        </div>
      )}

      {/* Ready for Dispatch */}
      {allComplete && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800">
            <Truck className="w-5 h-5" />
            <span className="font-semibold">Ready for Dispatch</span>
          </div>
          <p className="text-xs text-green-700 mt-1">
            All workflow steps completed. This order is ready to be dispatched.
          </p>
        </div>
      )}

      {!allComplete && workflowItems.some((item) => item.checked) && (
        <div className="text-xs text-gray-500">
          {workflowItems.filter((item) => item.checked).length} of {workflowItems.length} steps completed
        </div>
      )}
    </div>
  );
};
