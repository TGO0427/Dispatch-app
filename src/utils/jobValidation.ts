import { Job } from "../types";

export function hasCompletedPallets(job: Pick<Job, "pallets">): boolean {
  return typeof job.pallets === "number" && Number.isFinite(job.pallets) && job.pallets > 0;
}

export function getJobsMissingPallets(jobs: Pick<Job, "ref" | "notes" | "dropoff" | "pallets">[]): string[] {
  return jobs
    .map((job, index) => ({ job, index }))
    .filter(({ job }) => !hasCompletedPallets(job))
    .map(({ job, index }) => job.notes || job.dropoff || `${job.ref} line ${index + 1}`);
}
