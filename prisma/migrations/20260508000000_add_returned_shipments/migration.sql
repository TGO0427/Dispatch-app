ALTER TABLE "jobs"
ADD COLUMN "returnedAt" VARCHAR(255),
ADD COLUMN "returnReason" TEXT,
ADD COLUMN "returnedPallets" INTEGER,
ADD COLUMN "returnNotes" TEXT;
