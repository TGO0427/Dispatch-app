ALTER TABLE "africa_export_country_rules" ADD COLUMN "history" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "africa_export_country_rules" ADD COLUMN "updatedBy" VARCHAR(255);
