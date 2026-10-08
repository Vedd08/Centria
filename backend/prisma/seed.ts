import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    console.log('Demo seed execution blocked in production. Set ALLOW_DEMO_SEED=true to override.');
    process.exit(0);
  }

  console.log(
    'Seeding HMS 8-role users, patients, treatments, packages, commission rules, visits, GST invoices, and IPD (wards/admissions) data...',
  );

  
  // 1. Resolve the clinic to seed into.
  // If the demo MASTER account already exists (e.g. from a prior run or a hand-set-up
  // dev.db), reuse *its* clinic rather than a hardcoded name — otherwise re-running this
  // script would keep landing sample data in a clinic the login accounts don't belong to,
  // making it invisible in the app. Falls back to creating a fresh clinic on a brand-new
  // database where no demo accounts exist yet.
  const existingMasterUser = await prisma.user.findUnique({ where: { email: 'admin@clinic.com' } });
  const defaultClinic = existingMasterUser?.clinicId
    ? await prisma.clinic.findUnique({ where: { id: existingMasterUser.clinicId } })
    : await prisma.clinic.upsert({
        where: { name: 'A2K Clinic' },
        update: {},
        create: {
          name: 'A2K Clinic',
          address: 'Visakhapatnam',
          phone: '9876543210',
          email: 'contact@a2kclinic.com',
        },
      });
  if (!defaultClinic) {
    throw new Error(`Demo user admin@clinic.com references a clinicId that no longer exists`);
  }
  const clinicId = defaultClinic.id;

  const superAdminHash = await bcrypt.hash('superadmin123', 10);
  const masterHash = await bcrypt.hash('master123', 10);
  const doctorHash = await bcrypt.hash('doctor123', 10);
  const rmHash = await bcrypt.hash('rm123', 10);
  const receptionHash = await bcrypt.hash('reception123', 10);
  const pharmacyHash = await bcrypt.hash('pharmacy123', 10);
  const accountHash = await bcrypt.hash('account123', 10);
  const nurseHash = await bcrypt.hash('nurse123', 10);
  const staffHash = await bcrypt.hash('staff123', 10);

  const users = [
    {
      email: 'superadmin@clinic.com',
      passwordHash: superAdminHash,
      name: 'Platform Owner (Super Admin)',
      role: 'SUPER_ADMIN',
      clinicId,
    },
    {
      email: 'admin@clinic.com',
      passwordHash: masterHash,
      name: 'Dr. Ananya Sharma (Hospital Owner)',
      role: 'MASTER',
      clinicId,
    },
    {
      email: 'doctor@clinic.com',
      passwordHash: doctorHash,
      name: 'Dr. Vikramaditya Rao',
      role: 'DOCTOR',
      clinicId,
    },
    {
      email: 'rm@clinic.com',
      passwordHash: rmHash,
      name: 'Priya Verma (RM Intake)',
      role: 'RM',
      clinicId,
    },
    {
      email: 'reception@clinic.com',
      passwordHash: receptionHash,
      name: 'Suresh Kumar (Reception Lead)',
      role: 'RECEPTION',
      clinicId,
    },
    {
      email: 'billing@clinic.com',
      passwordHash: accountHash,
      name: 'Meera Nair (Billing & Accounts)',
      role: 'ACCOUNT',
      clinicId,
    },
    {
      email: 'pharmacy@clinic.com',
      passwordHash: pharmacyHash,
      name: 'Rahul Sen (Pharmacy Lead)',
      role: 'PHARMACY',
      clinicId,
    },
    {
      email: 'account@clinic.com',
      passwordHash: accountHash,
      name: 'Deepak Mehta (Account Lead)',
      role: 'ACCOUNT',
      clinicId,
    },
    {
      email: 'nurse@clinic.com',
      passwordHash: nurseHash,
      name: 'Anjali Nair (Ward Nurse)',
      role: 'NURSE',
      clinicId,
    },
    {
      email: 'staff@clinic.com',
      passwordHash: staffHash,
      name: 'Ravi Teja (Service Staff)',
      role: 'STAFF',
      clinicId,
    },
  ];

  const createdUsers: Record<string, any> = {};
  for (const user of users) {
    const u = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        passwordHash: user.passwordHash,
        name: user.name,
        role: user.role,
        clinicId: user.clinicId,
      },
      create: user,
    });
    createdUsers[user.role] = u;
  }

  // Attach the ward nurse and service staff to the demo doctor, so their task lists
  // are populated by that doctor's orders.
  await prisma.user.updateMany({
    where: { email: { in: ['nurse@clinic.com', 'staff@clinic.com'] } },
    data: { assignedDoctorId: createdUsers['DOCTOR'].id },
  });

  // Sample Patients
  const samplePatients = [
    {
      uhid: 'UHID-2026-0001',
      name: 'Kavita Kapoor',
      phone: '9876543210',
      dob: '1992-05-14',
      gender: 'Female',
      address: 'Suite 402, Green Glen Layout, Bangalore',
      allergyNotes: 'Allergic to Lidocaine topical cream',
      referringDoctor: 'Dr. R. K. Mehta (Dermatologist)',
      howHeardAboutUs: 'Instagram Ad',
      clinicId,
    },
    {
      uhid: 'UHID-2026-0002',
      name: 'Rohan Deshmukh',
      phone: '9123456789',
      dob: '1988-11-20',
      gender: 'Male',
      address: 'Indiranagar 100ft Road, Bangalore',
      allergyNotes: 'None reported',
      referringDoctor: 'Self Walk-in',
      howHeardAboutUs: 'Google Search',
      clinicId,
    },
    {
      uhid: 'UHID-2026-0003',
      name: 'Simran Ahuja',
      phone: '9988776655',
      dob: '1996-03-08',
      gender: 'Female',
      address: 'Koramangala 4th Block, Bangalore',
      allergyNotes: 'Sensitive skin - prone to post-laser erythema',
      referringDoctor: 'Dr. Sunita Patel',
      howHeardAboutUs: 'Friend Recommendation',
      clinicId,
    },
  ];

  const createdPatients: Record<string, any> = {};
  for (const patient of samplePatients) {
    let p = await prisma.patient.findFirst({ where: { clinicId, uhid: patient.uhid } });
    if (p) {
      p = await prisma.patient.update({ where: { id: p.id }, data: patient });
    } else {
      p = await prisma.patient.create({ data: patient });
    }
    createdPatients[patient.uhid] = p;
  }

  // 15 Sample Treatments with base price
  const sampleTreatments = [
    { name: 'Laser Hair Reduction (Full Face)', isGstTaxable: true, price: 3500 , clinicId },
    { name: 'Botox Wrinkle Reduction (Upper Face)', isGstTaxable: true, price: 12000 , clinicId },
    { name: 'Hyaluronic Acid Lip Dermal Filler', isGstTaxable: true, price: 16000 , clinicId },
    { name: 'Medical Chemical Peel (Salicylic/Glycolic)', isGstTaxable: true, price: 3000 , clinicId },
    { name: 'Microneedling Collagen Induction Therapy', isGstTaxable: true, price: 4500 , clinicId },
    { name: 'PRP Hair Restoration Session', isGstTaxable: true, price: 6500 , clinicId },
    { name: 'Carbon Laser Peel (Hollywood Facial)', isGstTaxable: true, price: 4000 , clinicId },
    { name: 'HydraFacial MD Deep Cleansing', isGstTaxable: true, price: 4500 , clinicId },
    { name: 'Q-Switched Nd:YAG Tattoo Removal', isGstTaxable: true, price: 3500 , clinicId },
    { name: 'Acne Scar Subcision & Cross', isGstTaxable: true, price: 5000 , clinicId },
    { name: 'PDO Thread Lift (Jawline Contouring)', isGstTaxable: true, price: 25000 , clinicId },
    { name: 'Glutathione Skin Brightening Therapy', isGstTaxable: true, price: 3500 , clinicId },
    { name: 'Microdermabrasion Skin Polishing', isGstTaxable: true, price: 2500 , clinicId },
    { name: 'Dermatological Medical Consultation', isGstTaxable: false, price: 1000 , clinicId },
    { name: 'Post-Procedure Wound & Patch Check', isGstTaxable: false, price: 500 , clinicId },
  ];

  const createdTreatments: Record<string, any> = {};
  for (const tr of sampleTreatments) {
    const t = await prisma.treatmentMaster.upsert({
      where: { clinicId_name: { clinicId, name: tr.name } },
      update: { isGstTaxable: tr.isGstTaxable, price: tr.price },
      create: tr,
    });
    createdTreatments[tr.name] = t;
  }

  // Sample Package Types
  const samplePackageTypes = [
    {
      name: 'Laser Hair Reduction (Full Face) - 6 Sittings Package',
      description: 'Complete 6-sitting aesthetic diode laser treatment package',
      price: 15000,
      totalSittings: 6,
      clinicId,
    },
    {
      name: 'PRP Hair Restoration - 3 Sittings Package',
      description: 'Autologous platelet-rich plasma scalp therapy 3-session pass',
      price: 18000,
      totalSittings: 3,
      clinicId,
    },
  ];

  const createdPackageTypes: Record<string, any> = {};
  for (const pkg of samplePackageTypes) {
    const p = await prisma.packageType.upsert({
      where: { clinicId_name: { clinicId, name: pkg.name } },
      update: pkg,
      create: pkg,
    });
    createdPackageTypes[pkg.name] = p;
  }

  // Sample Package Purchase
  const laserPkg = createdPackageTypes['Laser Hair Reduction (Full Face) - 6 Sittings Package'];
  const samplePurchase = await prisma.packagePurchase.upsert({
    where: { id: 'pkg-pur-kavita-001' },
    update: {
      patientId: createdPatients['UHID-2026-0001'].id,
      packageTypeId: laserPkg.id,
      packageName: laserPkg.name,
      purchaseDate: '2026-07-20',
      amountPaid: 15000,
      totalSittings: laserPkg.totalSittings,
      isGstTaxable: laserPkg.isGstTaxable,
      sittingGapDays: laserPkg.sittingGapDays,
      openingSittingsUsed: 0,
      sittingsUsed: 1,
      sittingsRemaining: 5,
      clinicId,
    },
    create: {
      id: 'pkg-pur-kavita-001',
      patientId: createdPatients['UHID-2026-0001'].id,
      packageTypeId: laserPkg.id,
      packageName: laserPkg.name,
      purchaseDate: '2026-07-20',
      amountPaid: 15000,
      totalSittings: laserPkg.totalSittings,
      isGstTaxable: laserPkg.isGstTaxable,
      sittingGapDays: laserPkg.sittingGapDays,
      openingSittingsUsed: 0,
      sittingsUsed: 1,
      sittingsRemaining: 5,
      clinicId,
    },
  });

  // Commission Rules Seed
  const sampleRules = [
    { role: 'Doctor', shareType: 'percentage', value: 15 , clinicId },
    { role: 'RM', shareType: 'percentage', value: 5 , clinicId },
    { role: 'Operator', shareType: 'fixed', value: 300 , clinicId },
    { role: 'ReferringDoctor', shareType: 'percentage', value: 10 , clinicId },
  ];

  for (const rule of sampleRules) {
    await prisma.commissionRule.upsert({
      where: { clinicId_role: { clinicId, role: rule.role } },
      update: rule,
      create: rule,
    });
  }

  const todayDateStr = new Date().toISOString().split('T')[0];

  // Sample Visits (linked to User FKs for doctorId and rmId).
  // Fixed IDs keep re-seeding idempotent — plain `create` calls appended two more
  // visits (and their commission records) on every run.
  const tr1 = createdTreatments['Laser Hair Reduction (Full Face)'];
  const visit1Data = {
    date: todayDateStr,
    patientId: createdPatients['UHID-2026-0001'].id,
    doctorId: createdUsers['DOCTOR'].id,
    rmId: createdUsers['RM'].id,
    operator: 'Technician Neha',
    treatmentId: tr1.id,
    treatmentName: tr1.name,
    treatmentPrice: tr1.price,
    isGstTaxable: tr1.isGstTaxable,
    packagePurchaseId: samplePurchase.id,
    diagnosis: 'Hirsutism - Sitting 1 of 6 completed',
    status: 'New',
    nextAppointmentDate: '2026-08-25',
    clinicId,
  };
  const visit1 = await prisma.visit.upsert({
    where: { id: 'visit-seed-kavita-001' },
    update: visit1Data,
    create: { id: 'visit-seed-kavita-001', ...visit1Data },
  });

  const tr2 = createdTreatments['Dermatological Medical Consultation'];
  const visit2Data = {
    date: todayDateStr,
    patientId: createdPatients['UHID-2026-0002'].id,
    doctorId: createdUsers['MASTER'].id,
    rmId: createdUsers['RM'].id,
    operator: 'Dr. Ananya Sharma',
    treatmentId: tr2.id,
    treatmentName: tr2.name,
    treatmentPrice: tr2.price,
    isGstTaxable: tr2.isGstTaxable,
    diagnosis: 'Acne Vulgaris Grade II assessment',
    status: 'New',
    nextAppointmentDate: '2026-08-01',
    clinicId,
  };
  const visit2 = await prisma.visit.upsert({
    where: { id: 'visit-seed-rohan-001' },
    update: visit2Data,
    create: { id: 'visit-seed-rohan-001', ...visit2Data },
  });

  // Commission Records Seed. CommissionRecord has no natural key to upsert on, so
  // the seeded rows for these visits are cleared before being recreated.
  await prisma.commissionRecord.deleteMany({
    where: { visitId: { in: [visit1.id, visit2.id] } },
  });
  await prisma.commissionRecord.createMany({
    data: [
      {
        clinicId,
        visitId: visit1.id,
        role: 'Doctor',
        beneficiaryName: createdUsers['DOCTOR'].name,
        visitStatus: 'New',
        treatmentPrice: 3500,
        shareType: 'percentage',
        ruleValue: 15,
        calculatedAmount: (3500 * 15) / 100,
      },
      {
        clinicId,
        visitId: visit1.id,
        role: 'RM',
        beneficiaryName: createdUsers['RM'].name,
        visitStatus: 'New',
        treatmentPrice: 3500,
        shareType: 'percentage',
        ruleValue: 5,
        calculatedAmount: (3500 * 5) / 100,
      },
    ],
  });

  // Invoices Seed
  let inv = await prisma.invoice.findFirst({ where: { clinicId, invoiceNumber: 'INV-2026-0001' } });
  const invoiceData = {
    clinicId,
    visitId: visit1.id,
    patientName: createdPatients['UHID-2026-0001'].name,
    patientUhid: createdPatients['UHID-2026-0001'].uhid,
    itemTitle: tr1.name,
    isGstTaxable: true,
    taxableValue: 3500,
    cgstRate: 9.0,
    sgstRate: 9.0,
    cgst: 315,
    sgst: 315,
    totalAmount: 4130,
    paymentMethod: 'bank',
    paymentRef: 'UPI-9876543210',
  };
  
  if (inv) {
    await prisma.invoice.update({
      where: { id: inv.id },
      data: invoiceData,
    });
  } else {
    await prisma.invoice.create({
      data: { invoiceNumber: 'INV-2026-0001', ...invoiceData },
    });
  }

  // Pharmacy Catalog. Two items sit at or below their reorder point so the dashboard
  // low-stock tile and the reorder filter have something to show.
  const sampleMedicines = [
    { name: 'Melaglow SPF 50 Sunscreen', unit: 'tube', stockQty: 42, reorderPoint: 10, unitPrice: 780 , clinicId },
    { name: 'Fusidic Acid 2% Ointment', unit: 'tube', stockQty: 8, reorderPoint: 12, unitPrice: 210 , clinicId },
    { name: 'Minoxidil 5% Topical Solution', unit: 'bottle', stockQty: 26, reorderPoint: 8, unitPrice: 1100 , clinicId },
    { name: 'Finasteride 1mg Tablets', unit: 'tablet', stockQty: 300, reorderPoint: 60, unitPrice: 12 , clinicId },
    { name: 'Biotin 10mg Supplements', unit: 'tablet', stockQty: 180, reorderPoint: 50, unitPrice: 18 , clinicId },
    { name: 'Botulinum Toxin 100U Vial', unit: 'vial', stockQty: 4, reorderPoint: 4, unitPrice: 14500 , clinicId },
    { name: 'Hyaluronic Acid Filler 1ml Syringe', unit: 'syringe', stockQty: 9, reorderPoint: 3, unitPrice: 12800 , clinicId },
    { name: 'Lidocaine 2% Topical Anaesthetic', unit: 'tube', stockQty: 15, reorderPoint: 6, unitPrice: 340 , clinicId },
  ];

  const createdMedicines: Record<string, any> = {};
  for (const med of sampleMedicines) {
    const m = await prisma.medicine.upsert({
      where: { clinicId_name: { clinicId, name: med.name } },
      update: med,
      create: med,
    });
    createdMedicines[med.name] = m;
  }

  // Sample Prescription (Pending, so the pharmacy dispense flow is demonstrable)
  await prisma.prescriptionItem.deleteMany({
    where: { prescriptionId: 'rx-seed-kavita-001' },
  });
  const prescriptionData = {
    clinicId,
    visitId: visit1.id,
    patientId: createdPatients['UHID-2026-0001'].id,
    doctorId: createdUsers['DOCTOR'].id,
    notes:
      'Apply broad spectrum sunscreen every 3 hours. Avoid direct sun exposure for 48 hours after each laser sitting.',
    status: 'Pending',
  };
  await prisma.prescription.upsert({
    where: { id: 'rx-seed-kavita-001' },
    update: prescriptionData,
    create: { id: 'rx-seed-kavita-001', ...prescriptionData },
  });
  await prisma.prescriptionItem.createMany({
    data: [
      {
        prescriptionId: 'rx-seed-kavita-001',
        medicineId: createdMedicines['Melaglow SPF 50 Sunscreen'].id,
        dosage: 'Apply liberally',
        frequency: '1-0-1',
        duration: '30 days',
        quantity: 1,
      },
      {
        prescriptionId: 'rx-seed-kavita-001',
        medicineId: createdMedicines['Fusidic Acid 2% Ointment'].id,
        dosage: 'Pea size',
        frequency: '1-0-1',
        duration: '5 days',
        quantity: 1,
      },
    ],
  });

  // ============================================================
  // IPD: Wards, Beds, Admission, Medication Chart, Progress Notes
  // ============================================================
  const wardGeneral = await prisma.ward.upsert({
    where: { clinicId_name: { clinicId, name: 'General Ward' } },
    update: { floor: '2nd Floor' },
    create: { clinicId, name: 'General Ward', floor: '2nd Floor' },
  });
  const wardIcu = await prisma.ward.upsert({
    where: { clinicId_name: { clinicId, name: 'ICU' } },
    update: { floor: '3rd Floor' },
    create: { clinicId, name: 'ICU', floor: '3rd Floor' },
  });

  const bedSpecs = [
    { ward: wardGeneral, bedNumber: 'GW-101', status: 'OCCUPIED' },
    { ward: wardGeneral, bedNumber: 'GW-102', status: 'AVAILABLE' },
    { ward: wardGeneral, bedNumber: 'GW-103', status: 'AVAILABLE' },
    { ward: wardGeneral, bedNumber: 'GW-104', status: 'AVAILABLE' },
    { ward: wardIcu, bedNumber: 'ICU-201', status: 'AVAILABLE' },
    { ward: wardIcu, bedNumber: 'ICU-202', status: 'AVAILABLE' },
  ];
  const createdBeds: Record<string, any> = {};
  for (const b of bedSpecs) {
    const bed = await prisma.bed.upsert({
      where: { wardId_bedNumber: { wardId: b.ward.id, bedNumber: b.bedNumber } },
      update: { status: b.status },
      create: { clinicId, wardId: b.ward.id, bedNumber: b.bedNumber, status: b.status },
    });
    createdBeds[b.bedNumber] = bed;
  }

  // Demo admission reuses Kavita Kapoor, who already has seeded visits/prescriptions/
  // an invoice, so her Patient History panel demonstrates OPD + IPD data together.
  const admissionData = {
    clinicId,
    patientId: createdPatients['UHID-2026-0001'].id,
    doctorId: createdUsers['DOCTOR'].id,
    bedId: createdBeds['GW-101'].id,
    admittedById: createdUsers['RECEPTION'].id,
    reasonForAdmission: 'Post-laser observation for severe allergic reaction to topical anaesthetic',
    status: 'ADMITTED',
  };
  const admission1 = await prisma.admission.upsert({
    where: { id: 'admission-seed-kavita-001' },
    update: admissionData,
    create: { id: 'admission-seed-kavita-001', ...admissionData },
  });

  const medOrder1Data = {
    clinicId,
    admissionId: admission1.id,
    patientId: admission1.patientId,
    medicineId: createdMedicines['Fusidic Acid 2% Ointment'].id,
    doctorId: createdUsers['DOCTOR'].id,
    dosage: 'Pea size, thin layer',
    route: 'Topical',
    frequency: '1-0-1',
    instructions: 'Apply to affected area after cleaning with saline',
    startDate: todayDateStr,
    status: 'ACTIVE',
  };
  const medOrder1 = await prisma.medicationOrder.upsert({
    where: { id: 'medorder-seed-kavita-001' },
    update: medOrder1Data,
    create: { id: 'medorder-seed-kavita-001', ...medOrder1Data },
  });

  const medOrder2Data = {
    clinicId,
    admissionId: admission1.id,
    patientId: admission1.patientId,
    medicineId: createdMedicines['Biotin 10mg Supplements'].id,
    doctorId: createdUsers['DOCTOR'].id,
    dosage: '1 tablet',
    route: 'Oral',
    frequency: 'Once daily',
    instructions: 'After breakfast',
    startDate: todayDateStr,
    status: 'ACTIVE',
  };
  const medOrder2 = await prisma.medicationOrder.upsert({
    where: { id: 'medorder-seed-kavita-002' },
    update: medOrder2Data,
    create: { id: 'medorder-seed-kavita-002', ...medOrder2Data },
  });

  await prisma.medicationAdministration.deleteMany({
    where: { medicationOrderId: { in: [medOrder1.id, medOrder2.id] } },
  });
  await prisma.medicationAdministration.createMany({
    data: [
      {
        clinicId,
        medicationOrderId: medOrder1.id,
        status: 'Given',
        administeredById: createdUsers['NURSE'].id,
        notes: 'Applied without incident',
      },
      {
        clinicId,
        medicationOrderId: medOrder2.id,
        status: 'Given',
        administeredById: createdUsers['NURSE'].id,
      },
      {
        clinicId,
        medicationOrderId: medOrder1.id,
        status: 'Missed',
        administeredById: createdUsers['NURSE'].id,
        notes: 'Patient was in radiology for a scan at scheduled time',
      },
    ],
  });

  await prisma.progressNote.deleteMany({ where: { admissionId: admission1.id } });
  await prisma.progressNote.createMany({
    data: [
      {
        clinicId,
        admissionId: admission1.id,
        authorId: createdUsers['DOCTOR'].id,
        noteType: 'DOCTOR',
        note: 'Erythema subsiding. Continue topical fusidic acid, review in 24 hours. No signs of secondary infection.',
        bloodPressure: '118/76',
        pulse: 78,
        temperature: 36.8,
        spo2: 98,
      },
      {
        clinicId,
        admissionId: admission1.id,
        authorId: createdUsers['NURSE'].id,
        noteType: 'NURSE',
        note: 'Patient comfortable, tolerated topical application well. No new complaints.',
        bloodPressure: '120/78',
        pulse: 80,
        temperature: 36.9,
        spo2: 99,
      },
    ],
  });

  // Patient Documents: a tiny real placeholder image is written to disk (same
  // uploads/patient-documents path the backend serves from) so the Documents/Images
  // tab has something real to render on first run.
  const PLACEHOLDER_IMAGE_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const uploadDir = path.join(process.cwd(), 'uploads', 'patient-documents');
  fs.mkdirSync(uploadDir, { recursive: true });
  const documentStoredFileName = 'seed-placeholder-kavita-skin-photo.png';
  const documentFilePath = path.join(uploadDir, documentStoredFileName);
  const documentImageBuffer = Buffer.from(PLACEHOLDER_IMAGE_BASE64, 'base64');
  if (!fs.existsSync(documentFilePath)) {
    fs.writeFileSync(documentFilePath, documentImageBuffer);
  }
  const documentData = {
    clinicId,
    patientId: createdPatients['UHID-2026-0001'].id,
    visitId: visit1.id,
    category: 'SCAN_IMAGE',
    title: 'Pre-treatment skin photo',
    description: 'Baseline photo taken before laser sitting 1',
    fileName: 'skin-photo.png',
    storedFileName: documentStoredFileName,
    mimeType: 'image/png',
    fileSizeBytes: documentImageBuffer.length,
    uploadedById: createdUsers['DOCTOR'].id,
  };
  await prisma.patientDocument.upsert({
    where: { id: 'doc-seed-kavita-001' },
    update: documentData,
    create: { id: 'doc-seed-kavita-001', ...documentData },
  });

  // Sample Vendor Purchases covering each ITC eligibility bucket
  const samplePurchases = [
    {
      id: 'pur-seed-001',
      vendorName: 'Dermaline Medical Supplies Pvt Ltd',
      vendorGstn: '29AABCD1234E1Z5',
      invoiceNumber: 'DML/2026/0417',
      invoiceDate: '2026-07-12',
      itemDescription: 'Botulinum Toxin 100U vials (batch of 5)',
      inputClassification: 'Medicine Stock',
      itcEligibility: 'Full',
      taxableValue: 72500,
      igst: 0,
      cgst: 6525,
      sgst: 6525,
      totalValue: 85550,
      clinicId,
    },
    {
      id: 'pur-seed-002',
      vendorName: 'LaserTech Instruments India',
      vendorGstn: '27AAECL5678F1ZP',
      invoiceNumber: 'LTI-2026-2290',
      invoiceDate: '2026-07-05',
      itemDescription: 'Diode laser handpiece replacement cartridge',
      inputClassification: 'Capital Goods',
      itcEligibility: 'Full',
      taxableValue: 185000,
      igst: 33300,
      cgst: 0,
      sgst: 0,
      totalValue: 218300,
      clinicId,
    },
    {
      id: 'pur-seed-003',
      vendorName: 'Greenleaf Facility Services',
      vendorGstn: '29AAGFG9012H1Z3',
      invoiceDate: '2026-07-18',
      invoiceNumber: 'GFS/JUL/1183',
      itemDescription: 'Clinic housekeeping and shared reception upkeep',
      inputClassification: 'Other',
      itcEligibility: 'Mixed Use',
      taxableValue: 24000,
      igst: 0,
      cgst: 2160,
      sgst: 2160,
      totalValue: 28320,
      clinicId,
    },
  ];

  for (const pur of samplePurchases) {
    const { id, ...rest } = pur;
    await prisma.purchase.upsert({
      where: { id },
      update: { ...rest, recordedById: createdUsers['ACCOUNT'].id },
      create: { id, ...rest, recordedById: createdUsers['ACCOUNT'].id },
    });
  }

  console.log(
    'Seed completed for 8-role system (SUPER_ADMIN, MASTER, DOCTOR, RM, RECEPTION, PHARMACY, ACCOUNT, NURSE)!',
  );
}

main()
  .catch((e: any) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
