-- AlterTable - Add workflow tracking fields to jobs
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "transporterBooked" BOOLEAN DEFAULT false;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "orderPicked" BOOLEAN DEFAULT false;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "coaAvailable" BOOLEAN DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

-- Seed default admin user (password should be changed in production)
INSERT INTO "users" ("id", "username", "email", "password", "role", "createdAt", "updatedAt")
VALUES ('1', 'admin', 'admin@dispatch.com', 'admin123', 'admin', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("username") DO NOTHING;

INSERT INTO "users" ("id", "username", "email", "password", "role", "createdAt", "updatedAt")
VALUES ('2', 'dispatcher', 'dispatcher@dispatch.com', 'dispatcher123', 'dispatcher', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("username") DO NOTHING;

INSERT INTO "users" ("id", "username", "email", "password", "role", "createdAt", "updatedAt")
VALUES ('3', 'manager', 'manager@dispatch.com', 'manager123', 'manager', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("username") DO NOTHING;
