ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "sourceCreatedDate" VARCHAR(255);
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "sourceCreatedBy" VARCHAR(255);

CREATE INDEX IF NOT EXISTS "jobs_sourceCreatedBy_idx" ON "jobs"("sourceCreatedBy");
CREATE INDEX IF NOT EXISTS "jobs_sourceCreatedDate_idx" ON "jobs"("sourceCreatedDate");
