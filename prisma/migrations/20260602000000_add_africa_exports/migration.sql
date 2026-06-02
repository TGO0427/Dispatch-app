-- CreateTable
CREATE TABLE "africa_export_transporters" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "route" VARCHAR(255),
    "contact" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(50) NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "africa_export_transporters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "africa_export_shipments" (
    "id" TEXT NOT NULL,
    "ref" VARCHAR(255) NOT NULL,
    "customer" VARCHAR(255) NOT NULL,
    "destinationCountry" VARCHAR(255),
    "hsCode" VARCHAR(100),
    "productType" TEXT,
    "incoterm" VARCHAR(50) NOT NULL DEFAULT 'FCA',
    "transportMode" VARCHAR(50) NOT NULL DEFAULT 'Road',
    "preferenceScheme" VARCHAR(100) NOT NULL DEFAULT 'To confirm',
    "destinationAgent" TEXT,
    "eta" VARCHAR(255),
    "pallets" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "assignedTransporterId" VARCHAR(255),
    "lastCheckedAt" VARCHAR(255),
    "notes" TEXT,
    "documents" JSONB NOT NULL DEFAULT '{}',
    "createdById" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "africa_export_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "africa_export_shipments_ref_key" ON "africa_export_shipments"("ref");

-- CreateIndex
CREATE INDEX "africa_export_shipments_status_idx" ON "africa_export_shipments"("status");

-- CreateIndex
CREATE INDEX "africa_export_shipments_destinationCountry_idx" ON "africa_export_shipments"("destinationCountry");

-- CreateIndex
CREATE INDEX "africa_export_shipments_assignedTransporterId_idx" ON "africa_export_shipments"("assignedTransporterId");

-- CreateIndex
CREATE INDEX "africa_export_shipments_eta_idx" ON "africa_export_shipments"("eta");

-- CreateIndex
CREATE INDEX "africa_export_shipments_createdAt_idx" ON "africa_export_shipments"("createdAt");

-- CreateIndex
CREATE INDEX "africa_export_transporters_status_idx" ON "africa_export_transporters"("status");

-- CreateIndex
CREATE INDEX "africa_export_transporters_name_idx" ON "africa_export_transporters"("name");

-- AddForeignKey
ALTER TABLE "africa_export_shipments" ADD CONSTRAINT "africa_export_shipments_assignedTransporterId_fkey" FOREIGN KEY ("assignedTransporterId") REFERENCES "africa_export_transporters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
