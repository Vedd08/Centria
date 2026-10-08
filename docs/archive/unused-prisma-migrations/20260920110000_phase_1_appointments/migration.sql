-- DropIndex
DROP INDEX "DoctorSchedule_doctorId_dayOfWeek_key";

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "slotKey" TEXT;

-- AlterTable
ALTER TABLE "PatientQueue" ADD COLUMN "appointmentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_slotKey_key" ON "Appointment"("slotKey");

-- CreateIndex
CREATE UNIQUE INDEX "PatientQueue_appointmentId_key" ON "PatientQueue"("appointmentId");

-- CreateIndex
CREATE INDEX "DoctorSchedule_clinicId_doctorId_dayOfWeek_idx" ON "DoctorSchedule"("clinicId", "doctorId", "dayOfWeek");

-- Backfill slotKey (Per user request)
UPDATE "Appointment" SET "slotKey" = "doctorId" || '|' || "startTime" WHERE "status" NOT IN ('Cancelled', 'No-Show');
