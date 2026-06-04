CREATE TABLE "invoice_reconciliation_timing_notes" (
  "id" TEXT NOT NULL,
  "invoiceKey" VARCHAR(500) NOT NULL,
  "invoiceNumber" VARCHAR(255),
  "note" TEXT NOT NULL,
  "updatedById" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "invoice_reconciliation_timing_notes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoice_reconciliation_timing_notes_invoiceKey_key" ON "invoice_reconciliation_timing_notes"("invoiceKey");
CREATE INDEX "invoice_reconciliation_timing_notes_invoiceNumber_idx" ON "invoice_reconciliation_timing_notes"("invoiceNumber");
CREATE INDEX "invoice_reconciliation_timing_notes_updatedAt_idx" ON "invoice_reconciliation_timing_notes"("updatedAt");
