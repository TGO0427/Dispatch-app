ALTER TABLE "africa_export_shipments" ADD COLUMN "dispatchApprovedAt" VARCHAR(255);
ALTER TABLE "africa_export_shipments" ADD COLUMN "dispatchApprovedBy" VARCHAR(255);

CREATE TABLE "africa_export_country_rules" (
  "id" TEXT NOT NULL,
  "country" VARCHAR(255) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "points" JSONB NOT NULL DEFAULT '[]',
  "requiredDocumentIds" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "africa_export_country_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "africa_export_country_rules_country_key" ON "africa_export_country_rules"("country");
CREATE INDEX "africa_export_country_rules_country_idx" ON "africa_export_country_rules"("country");
