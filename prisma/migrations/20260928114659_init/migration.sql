-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SUPERVISOR', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "TroughStatus" AS ENUM ('IDLE', 'RUNNING', 'MAINTENANCE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "SensorType" AS ENUM ('AIR_TEMPERATURE', 'LEAF_TEMPERATURE', 'HUMIDITY', 'LEAF_MOISTURE', 'AIRFLOW', 'FAN_SPEED', 'LEAF_WEIGHT');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('PLANNED', 'WITHERING', 'COMPLETED', 'ABORTED');

-- CreateEnum
CREATE TYPE "ScheduleAction" AS ENUM ('WITHERING_CYCLE', 'FAN_ON', 'HEATER_ON', 'REVERSE_AIRFLOW', 'LEAF_TURNING', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OPERATOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Factory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Factory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trough" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "factoryId" TEXT NOT NULL,
    "capacityKg" DOUBLE PRECISION NOT NULL,
    "status" "TroughStatus" NOT NULL DEFAULT 'IDLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trough_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sensor" (
    "id" TEXT NOT NULL,
    "troughId" TEXT NOT NULL,
    "type" "SensorType" NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "minThreshold" DOUBLE PRECISION,
    "maxThreshold" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sensor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reading" (
    "id" BIGSERIAL NOT NULL,
    "sensorId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "troughId" TEXT NOT NULL,
    "leafIntakeKg" DOUBLE PRECISION NOT NULL,
    "initialMoisture" DOUBLE PRECISION NOT NULL,
    "targetMoisture" DOUBLE PRECISION NOT NULL,
    "finalMoisture" DOUBLE PRECISION,
    "status" "BatchStatus" NOT NULL DEFAULT 'PLANNED',
    "plannedStartAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "troughId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "action" "ScheduleAction" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "setpoint" DOUBLE PRECISION,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "troughId" TEXT NOT NULL,
    "sensorId" TEXT,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Factory_code_key" ON "Factory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Trough_code_key" ON "Trough"("code");

-- CreateIndex
CREATE INDEX "Trough_factoryId_idx" ON "Trough"("factoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Sensor_troughId_type_key" ON "Sensor"("troughId", "type");

-- CreateIndex
CREATE INDEX "Reading_sensorId_recordedAt_idx" ON "Reading"("sensorId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_code_key" ON "Batch"("code");

-- CreateIndex
CREATE INDEX "Batch_troughId_status_idx" ON "Batch"("troughId", "status");

-- CreateIndex
CREATE INDEX "Schedule_troughId_idx" ON "Schedule"("troughId");

-- CreateIndex
CREATE INDEX "Alert_troughId_createdAt_idx" ON "Alert"("troughId", "createdAt");

-- CreateIndex
CREATE INDEX "Alert_acknowledged_idx" ON "Alert"("acknowledged");

-- AddForeignKey
ALTER TABLE "Trough" ADD CONSTRAINT "Trough_factoryId_fkey" FOREIGN KEY ("factoryId") REFERENCES "Factory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sensor" ADD CONSTRAINT "Sensor_troughId_fkey" FOREIGN KEY ("troughId") REFERENCES "Trough"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reading" ADD CONSTRAINT "Reading_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_troughId_fkey" FOREIGN KEY ("troughId") REFERENCES "Trough"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_troughId_fkey" FOREIGN KEY ("troughId") REFERENCES "Trough"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_troughId_fkey" FOREIGN KEY ("troughId") REFERENCES "Trough"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
