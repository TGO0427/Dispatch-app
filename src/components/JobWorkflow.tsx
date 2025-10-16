import React from "react";
import { CheckCircle2, Circle, Truck } from "lucide-react";
import { Job } from "../types";

interface JobWorkflowProps {
  job: Job;
  onUpdate: (jobId: string, updates: Partial<Job>) => void;
  compact?: boolean;
}

export const JobWorkflow: React.FC<JobWorkflowProps> = ({ job, onUpdate, compact = false }) => {
  const handleToggle = (field: 'transporterBooked' | 'orderPicked' | 'coaAvailable') => {
    const updates: Partial<Job> = {
      [field]: !job[field],
    };

    // Auto-calculate readyForDispatch
    const transporterBooked = field === 'transporterBooked' ? !job.transporterBooked : job.transporterBooked;
    const orderPicked = field === 'orderPicked' ? !job.orderPicked : job.orderPicked;
    const coaAvailable = field === 'coaAvailable' ? !job.coaAvailable : job.coaAvailable;

    updates.readyForDispatch = !!(transporterBooked && orderPicked && coaAvailable);

    onUpdate(job.id, updates);
  };

  const workflowItems = [
    {
      id: 'transporterBooked' as const,
      label: 'Transporter Booked',
      checked: job.transporterBooked || false,
    },
    {
      id: 'orderPicked' as const,
      label: 'Order Picked',
      checked: job.orderPicked || false,
    },
    {
      id: 'coaAvailable' as const,
      label: 'COA Available',
      checked: job.coaAvailable || false,
    },
  ];

  const allComplete = job.readyForDispatch || false;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {workflowItems.map((item) => (
          <button
            key={item.id}
            onClick={(e) => {
              e.stopPropagation();
              handleToggle(item.id);
            }}
            className={`p-1 rounded-full transition-colors ${
              item.checked
                ? 'text-green-600 hover:text-green-700'
                : 'text-gray-300 hover:text-gray-400'
            }`}
            title={item.label}
          >
            {item.checked ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Circle className="w-4 h-4" />
            )}
          </button>
        ))}
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
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
        <Truck className="w-4 h-4" />
        Dispatch Workflow
      </h4>

      <div className="space-y-2">
        {workflowItems.map((item) => (
          <label
            key={item.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={item.checked}
              onChange={() => handleToggle(item.id)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className={`text-sm ${item.checked ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
              {item.label}
            </span>
            {item.checked && (
              <CheckCircle2 className="w-4 h-4 text-green-600 ml-auto" />
            )}
          </label>
        ))}
      </div>

      {allComplete && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800">
            <Truck className="w-5 h-5" />
            <span className="font-semibold">Ready for Dispatch</span>
          </div>
          <p className="text-xs text-green-700 mt-1">
            All workflow steps completed. This order is ready to be dispatched.
          </p>
        </div>
      )}

      {!allComplete && workflowItems.some(item => item.checked) && (
        <div className="mt-2 text-xs text-gray-500">
          {workflowItems.filter(item => item.checked).length} of {workflowItems.length} steps completed
        </div>
      )}
    </div>
  );
};
