ALTER TABLE "africa_export_shipments" ADD COLUMN "etd" VARCHAR(255);
ALTER TABLE "africa_export_shipments" ADD COLUMN "customsBufferDays" INTEGER NOT NULL DEFAULT 2;

CREATE INDEX "africa_export_shipments_etd_idx" ON "africa_export_shipments"("etd");
