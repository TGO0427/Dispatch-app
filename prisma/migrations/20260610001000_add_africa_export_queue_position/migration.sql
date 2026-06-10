ALTER TABLE "africa_export_shipments" ADD COLUMN "queuePosition" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "africa_export_shipments_queuePosition_idx" ON "africa_export_shipments"("queuePosition");
