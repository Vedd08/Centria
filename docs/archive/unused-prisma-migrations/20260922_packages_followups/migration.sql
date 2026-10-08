-- DropIndex
DROP INDEX "DoctorSchedule_clinicId_doctorId_dayOfWeek_idx";

-- CreateTable
CREATE TABLE "FollowUpCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "note" TEXT,
    "callBackOn" TEXT,
    "calledById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FollowUpCall_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FollowUpCall_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUpCall_calledById_fkey" FOREIGN KEY ("calledById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "reasonForVisit" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "slotKey" TEXT,
    CONSTRAINT "Appointment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("clinicId", "createdAt", "doctorId", "endTime", "id", "patientId", "reasonForVisit", "startTime", "status", "updatedAt", "slotKey") SELECT "clinicId", "createdAt", "doctorId", "endTime", "id", "patientId", "reasonForVisit", "startTime", "status", "updatedAt", "slotKey" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
CREATE UNIQUE INDEX "Appointment_slotKey_key" ON "Appointment"("slotKey");
CREATE INDEX "Appointment_clinicId_startTime_idx" ON "Appointment"("clinicId", "startTime");
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");
CREATE INDEX "Appointment_doctorId_idx" ON "Appointment"("doctorId");
CREATE TABLE "new_CareOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "queueId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "medicineId" TEXT,
    "treatmentId" TEXT,
    "description" TEXT NOT NULL,
    "dosage" TEXT,
    "route" TEXT,
    "frequency" TEXT,
    "instructions" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL NOT NULL DEFAULT 0.0,
    "totalPrice" DECIMAL NOT NULL DEFAULT 0.0,
    "status" TEXT NOT NULL DEFAULT 'ORDERED',
    "orderedById" TEXT NOT NULL,
    "performedById" TEXT,
    "performedAt" DATETIME,
    "performNotes" TEXT,
    "dispensedById" TEXT,
    "dispensedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clinicId" TEXT NOT NULL,
    "sourceTemplates" TEXT,
    CONSTRAINT "CareOrder_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "PatientQueue" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CareOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CareOrder_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CareOrder_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "TreatmentMaster" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CareOrder_orderedById_fkey" FOREIGN KEY ("orderedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CareOrder_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CareOrder_dispensedById_fkey" FOREIGN KEY ("dispensedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CareOrder_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CareOrder" ("clinicId", "createdAt", "description", "dispensedAt", "dispensedById", "dosage", "frequency", "id", "instructions", "medicineId", "orderType", "orderedById", "patientId", "performNotes", "performedAt", "performedById", "quantity", "queueId", "route", "status", "totalPrice", "treatmentId", "unitPrice", "updatedAt", "sourceTemplates") SELECT "clinicId", "createdAt", "description", "dispensedAt", "dispensedById", "dosage", "frequency", "id", "instructions", "medicineId", "orderType", "orderedById", "patientId", "performNotes", "performedAt", "performedById", "quantity", "queueId", "route", "status", "totalPrice", "treatmentId", "unitPrice", "updatedAt", "sourceTemplates" FROM "CareOrder";
DROP TABLE "CareOrder";
ALTER TABLE "new_CareOrder" RENAME TO "CareOrder";
CREATE INDEX "CareOrder_queueId_idx" ON "CareOrder"("queueId");
CREATE INDEX "CareOrder_patientId_idx" ON "CareOrder"("patientId");
CREATE INDEX "CareOrder_clinicId_status_idx" ON "CareOrder"("clinicId", "status");
CREATE INDEX "CareOrder_medicineId_idx" ON "CareOrder"("medicineId");
CREATE TABLE "new_PackagePurchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "packageTypeId" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "packageCode" TEXT,
    "purchaseDate" TEXT NOT NULL,
    "amountPaid" DECIMAL NOT NULL,
    "cashAmount" DECIMAL NOT NULL DEFAULT 0.0,
    "bankAmount" DECIMAL NOT NULL DEFAULT 0.0,
    "paymentRefId" TEXT,
    "isGstTaxable" BOOLEAN NOT NULL DEFAULT false,
    "sittingGapDays" INTEGER,
    "openingSittingsUsed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Follow Up',
    "totalSittings" INTEGER NOT NULL DEFAULT 0,
    "sittingsUsed" INTEGER NOT NULL DEFAULT 0,
    "sittingsRemaining" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clinicId" TEXT,
    CONSTRAINT "PackagePurchase_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PackagePurchase_packageTypeId_fkey" FOREIGN KEY ("packageTypeId") REFERENCES "PackageType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PackagePurchase_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PackagePurchase" ("amountPaid", "bankAmount", "cashAmount", "clinicId", "createdAt", "id", "isGstTaxable", "packageCode", "packageName", "packageTypeId", "patientId", "paymentRefId", "purchaseDate", "sittingsRemaining", "sittingsUsed", "status", "totalSittings", "updatedAt", "sittingGapDays", "openingSittingsUsed") SELECT "amountPaid", "bankAmount", "cashAmount", "clinicId", "createdAt", "id", "isGstTaxable", "packageCode", "packageName", "packageTypeId", "patientId", "paymentRefId", "purchaseDate", "sittingsRemaining", "sittingsUsed", "status", "totalSittings", "updatedAt", NULL, 0 FROM "PackagePurchase";
DROP TABLE "PackagePurchase";
ALTER TABLE "new_PackagePurchase" RENAME TO "PackagePurchase";

UPDATE "PackagePurchase" SET "openingSittingsUsed" = CASE
  WHEN "sittingsUsed" - (SELECT COUNT(*) FROM "Visit" v WHERE v."packagePurchaseId" = "PackagePurchase"."id") > 0
  THEN "sittingsUsed" - (SELECT COUNT(*) FROM "Visit" v WHERE v."packagePurchaseId" = "PackagePurchase"."id")
  ELSE 0 END;
CREATE INDEX "PackagePurchase_patientId_idx" ON "PackagePurchase"("patientId");
CREATE TABLE "new_PackageType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL NOT NULL,
    "totalSittings" INTEGER NOT NULL,
    "sittingGapDays" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isGstTaxable" BOOLEAN NOT NULL DEFAULT true,
    "treatmentId" TEXT,
    "doctorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clinicId" TEXT NOT NULL,
    CONSTRAINT "PackageType_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "TreatmentMaster" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PackageType_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PackageType_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PackageType" ("clinicId", "createdAt", "description", "id", "isGstTaxable", "name", "price", "totalSittings", "updatedAt", "sittingGapDays", "isActive", "treatmentId", "doctorId") SELECT "clinicId", "createdAt", "description", "id", "isGstTaxable", "name", "price", "totalSittings", "updatedAt", NULL, true, NULL, NULL FROM "PackageType";
DROP TABLE "PackageType";
ALTER TABLE "new_PackageType" RENAME TO "PackageType";
CREATE UNIQUE INDEX "PackageType_clinicId_name_key" ON "PackageType"("clinicId", "name");
CREATE TABLE "new_PatientQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "queueDate" TEXT NOT NULL,
    "tokenNumber" INTEGER NOT NULL,
    "departmentId" TEXT,
    "complaint" TEXT,
    "isRegular" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "checkedInById" TEXT NOT NULL,
    "checkedInAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doctorId" TEXT,
    "careType" TEXT,
    "diagnosis" TEXT,
    "doctorNotes" TEXT,
    "patientNotes" TEXT,
    "staffNotes" TEXT,
    "consultationFee" DECIMAL NOT NULL DEFAULT 0.0,
    "nextAppointmentDate" TEXT,
    "seenAt" DATETIME,
    "visitId" TEXT,
    "admissionId" TEXT,
    "admissionRequestedAt" DATETIME,
    "admissionRequestedById" TEXT,
    "admissionRequestReason" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clinicId" TEXT NOT NULL,
    CONSTRAINT "PatientQueue_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PatientQueue_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PatientQueue_checkedInById_fkey" FOREIGN KEY ("checkedInById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PatientQueue_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PatientQueue_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PatientQueue_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PatientQueue_admissionRequestedById_fkey" FOREIGN KEY ("admissionRequestedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PatientQueue_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PatientQueue" ("admissionId", "admissionRequestReason", "admissionRequestedAt", "admissionRequestedById", "careType", "checkedInAt", "checkedInById", "clinicId", "complaint", "completedAt", "consultationFee", "createdAt", "departmentId", "diagnosis", "doctorId", "doctorNotes", "id", "isRegular", "nextAppointmentDate", "patientId", "patientNotes", "queueDate", "seenAt", "staffNotes", "status", "tokenNumber", "updatedAt", "visitId") SELECT "admissionId", "admissionRequestReason", "admissionRequestedAt", "admissionRequestedById", "careType", "checkedInAt", "checkedInById", "clinicId", "complaint", "completedAt", "consultationFee", "createdAt", "departmentId", "diagnosis", "doctorId", "doctorNotes", "id", "isRegular", "nextAppointmentDate", "patientId", "patientNotes", "queueDate", "seenAt", "staffNotes", "status", "tokenNumber", "updatedAt", "visitId" FROM "PatientQueue";
DROP TABLE "PatientQueue";
ALTER TABLE "new_PatientQueue" RENAME TO "PatientQueue";
CREATE UNIQUE INDEX "PatientQueue_visitId_key" ON "PatientQueue"("visitId");
CREATE INDEX "PatientQueue_clinicId_queueDate_status_idx" ON "PatientQueue"("clinicId", "queueDate", "status");
CREATE INDEX "PatientQueue_patientId_idx" ON "PatientQueue"("patientId");
CREATE INDEX "PatientQueue_doctorId_idx" ON "PatientQueue"("doctorId");
CREATE INDEX "PatientQueue_clinicId_admissionRequestedAt_idx" ON "PatientQueue"("clinicId", "admissionRequestedAt");
CREATE UNIQUE INDEX "PatientQueue_clinicId_queueDate_departmentId_tokenNumber_key" ON "PatientQueue"("clinicId", "queueDate", "departmentId", "tokenNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "FollowUpCall_clinicId_dueDate_idx" ON "FollowUpCall"("clinicId", "dueDate");

-- CreateIndex
CREATE INDEX "FollowUpCall_patientId_idx" ON "FollowUpCall"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorSchedule_doctorId_dayOfWeek_key" ON "DoctorSchedule"("doctorId", "dayOfWeek");


