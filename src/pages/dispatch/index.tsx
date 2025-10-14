// src/pages/dispatch/index.tsx (Next.js) OR src/app/DispatchDashboard.tsx
import { DispatchProvider } from "../../context/DispatchContext";
import JobsList from "../../components/jobs/JobsList";
import type { Job } from "../../types";

const demoJobs: Job[] = [
  {
    id: "j1",
    ref: "SO-0001",
    customer: "Sample Customer",
    pickup: "K58 Warehouse",
    dropoff: "GWF Cold Store",
    priority: "normal",
    status: "pending",
    pallets: 10,
    eta: "2025-10-10",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export default function DispatchDashboard() {
  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Dispatch Dashboard</h1>
      <DispatchProvider initialJobs={demoJobs}>
        <JobsList />
      </DispatchProvider>
    </div>
  );
}
