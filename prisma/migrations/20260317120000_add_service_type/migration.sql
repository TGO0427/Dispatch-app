-- AlterTable - Add service type field to jobs
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "serviceType" VARCHAR(50);
