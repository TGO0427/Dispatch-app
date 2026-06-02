ALTER TABLE "africa_export_shipments" ADD COLUMN "documentDetails" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "africa_export_shipments" ADD COLUMN "history" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "africa_export_shipments" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "africa_export_shipments_archived_idx" ON "africa_export_shipments"("archived");
