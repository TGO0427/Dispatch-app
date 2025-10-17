-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "jobType" VARCHAR(50) NOT NULL DEFAULT 'order';

-- CreateIndex
CREATE INDEX "jobs_jobType_idx" ON "jobs"("jobType");
