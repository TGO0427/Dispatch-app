// src/components/jobs/JobsList.tsx
import { useDispatch } from "../../context/DispatchContext";
import JobCard from "./JobCard";

export default function JobsList() {
  const { jobs } = useDispatch();
  if (!jobs.length) return <div className="text-sm text-zinc-500">No jobs yet.</div>;
  return (
    <div className="grid gap-3">
      {jobs.map((j) => (
        <JobCard key={j.id} job={j} />
      ))}
    </div>
  );
}
