CREATE TABLE "invoice_reconciliation_uploads" (
  "id" TEXT NOT NULL,
  "filename" VARCHAR(1000) NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rowsAdded" INTEGER NOT NULL DEFAULT 0,
  "rowsSkipped" INTEGER NOT NULL DEFAULT 0,
  "updatedById" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_reconciliation_uploads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invoice_reconciliation_uploads_uploadedAt_idx" ON "invoice_reconciliation_uploads"("uploadedAt");

CREATE TABLE "invoice_reconciliation_audits" (
  "id" TEXT NOT NULL,
  "entityType" VARCHAR(100) NOT NULL,
  "entityKey" VARCHAR(500) NOT NULL,
  "action" VARCHAR(255) NOT NULL,
  "fromValue" TEXT,
  "toValue" TEXT,
  "userId" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_reconciliation_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invoice_reconciliation_audits_entityType_entityKey_idx" ON "invoice_reconciliation_audits"("entityType", "entityKey");
CREATE INDEX "invoice_reconciliation_audits_createdAt_idx" ON "invoice_reconciliation_audits"("createdAt");
