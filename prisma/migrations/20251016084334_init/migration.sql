-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "ref" VARCHAR(255) NOT NULL,
    "customer" VARCHAR(255) NOT NULL,
    "pickup" VARCHAR(255) NOT NULL,
    "dropoff" VARCHAR(255) NOT NULL,
    "warehouse" VARCHAR(255),
    "priority" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "pallets" INTEGER,
    "outstandingQty" INTEGER,
    "eta" VARCHAR(255),
    "scheduledAt" VARCHAR(255),
    "actualDeliveryAt" VARCHAR(255),
    "exceptionReason" TEXT,
    "driverId" VARCHAR(255),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "callsign" VARCHAR(50) NOT NULL,
    "location" VARCHAR(255) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "assignedJobs" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(50) NOT NULL,
    "phone" VARCHAR(50),
    "email" VARCHAR(255),

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_priority_idx" ON "jobs"("priority");

-- CreateIndex
CREATE INDEX "jobs_driverId_idx" ON "jobs"("driverId");

-- CreateIndex
CREATE INDEX "jobs_warehouse_idx" ON "jobs"("warehouse");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_callsign_key" ON "drivers"("callsign");

-- CreateIndex
CREATE INDEX "drivers_status_idx" ON "drivers"("status");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
