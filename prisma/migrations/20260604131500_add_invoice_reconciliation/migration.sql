CREATE TABLE "invoice_reconciliation_lines" (
  "id" TEXT NOT NULL,
  "rowKey" VARCHAR(500) NOT NULL,
  "aso" VARCHAR(255) NOT NULL,
  "invoiceNumber" VARCHAR(255),
  "invoiceDate" VARCHAR(50),
  "deliveryDueDate" VARCHAR(50),
  "customer" VARCHAR(1000),
  "invoiceQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "hasInvoiceQty" BOOLEAN NOT NULL DEFAULT false,
  "invoiceValue" DOUBLE PRECISION,
  "product" TEXT,
  "createdBy" VARCHAR(255),
  "deliveryStatus" VARCHAR(255),
  "status" VARCHAR(255),
  "postedDate" VARCHAR(50),
  "createdById" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "invoice_reconciliation_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invoice_reconciliation_reviews" (
  "id" TEXT NOT NULL,
  "aso" VARCHAR(255) NOT NULL,
  "status" VARCHAR(100) NOT NULL,
  "updatedById" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "invoice_reconciliation_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoice_reconciliation_lines_rowKey_key" ON "invoice_reconciliation_lines"("rowKey");
CREATE INDEX "invoice_reconciliation_lines_aso_idx" ON "invoice_reconciliation_lines"("aso");
CREATE INDEX "invoice_reconciliation_lines_invoiceNumber_idx" ON "invoice_reconciliation_lines"("invoiceNumber");
CREATE INDEX "invoice_reconciliation_lines_invoiceDate_idx" ON "invoice_reconciliation_lines"("invoiceDate");
CREATE INDEX "invoice_reconciliation_lines_deliveryDueDate_idx" ON "invoice_reconciliation_lines"("deliveryDueDate");
CREATE INDEX "invoice_reconciliation_lines_createdAt_idx" ON "invoice_reconciliation_lines"("createdAt");

CREATE UNIQUE INDEX "invoice_reconciliation_reviews_aso_key" ON "invoice_reconciliation_reviews"("aso");
CREATE INDEX "invoice_reconciliation_reviews_status_idx" ON "invoice_reconciliation_reviews"("status");
CREATE INDEX "invoice_reconciliation_reviews_updatedAt_idx" ON "invoice_reconciliation_reviews"("updatedAt");
