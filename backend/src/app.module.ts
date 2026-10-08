import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { PatientsModule } from './patients/patients.module';
import { TreatmentsModule } from './treatments/treatments.module';
import { VisitsModule } from './visits/visits.module';
import { PackagesModule } from './packages/packages.module';
import { CommissionsModule } from './commissions/commissions.module';
import { InvoicesModule } from './invoices/invoices.module';
import { UsersModule } from './users/users.module';
import { MedicinesModule } from './medicines/medicines.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { PurchasesModule } from './purchases/purchases.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SettingsModule } from './settings/settings.module';
import { ClinicsModule } from './clinics/clinics.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { WardsModule } from './wards/wards.module';
import { AdmissionsModule } from './admissions/admissions.module';
import { MedicationOrdersModule } from './medication-orders/medication-orders.module';
import { PatientDocumentsModule } from './patient-documents/patient-documents.module';
import { QueueModule } from './queue/queue.module';
import { CareOrdersModule } from './care-orders/care-orders.module';
import { PrescriptionTemplatesModule } from './prescription-templates/prescription-templates.module';
import { AccountsModule } from './accounts/accounts.module';
import { AdminModule } from './admin/admin.module';
import { PlatformModule } from './platform/platform.module';
import { DepartmentsModule } from './departments/departments.module';
import { RmModule } from './rm/rm.module';
import { RetailSalesModule } from './retail-sales/retail-sales.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    PatientsModule,
    TreatmentsModule,
    VisitsModule,
    PackagesModule,
    CommissionsModule,
    InvoicesModule,
    UsersModule,
    MedicinesModule,
    PrescriptionsModule,
    PurchasesModule,
    AnalyticsModule,
    SettingsModule,
    ClinicsModule,
    AppointmentsModule,
    WardsModule,
    AdmissionsModule,
    MedicationOrdersModule,
    PatientDocumentsModule,
    QueueModule,
    CareOrdersModule,
    PrescriptionTemplatesModule,
    AccountsModule,
    AdminModule,
    PlatformModule,
    DepartmentsModule,
    RmModule,
    RetailSalesModule,
  ],
})
export class AppModule {}
