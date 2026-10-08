/**
 * Imports the clinic's "Data Entry.xlsx" export into the database.
 *
 * The workbook is first flattened to JSON (see scripts/extract-excel.py), then this
 * script upserts it. Deterministic IDs derived from the source rows make the import
 * idempotent — re-running updates rows in place instead of duplicating them.
 *
 * Usage:  npx ts-node prisma/import-excel.ts [path-to-json] [--replace]
 *   --replace  clears existing patients/visits/packages/purchases/treatments first
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

const JSON_PATH = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'C:/tmp/hms-import.json';
const REPLACE = process.argv.includes('--replace');

/** Stable ID from arbitrary parts, so a re-import updates rather than duplicates. */
const idFor = (kind: string, ...parts: (string | number)[]) =>
  `${kind}-${createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 24)}`;

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

type Row = Record<string, any>;

async function main() {
  const raw = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
  console.log(
    `Loaded: ${Object.keys(raw.patients).length} patients, ${raw.visits.length} visits, ` +
      `${Object.keys(raw.treatments).length} treatments, ${raw.packages.length} packages, ${raw.purchases.length} purchases`,
  );

  // ---- Clinic: reuse whichever clinic the demo login accounts already belong to ----
  const masterUser = await prisma.user.findUnique({ where: { email: 'admin@clinic.com' } });
  if (!masterUser?.clinicId) throw new Error('Demo user admin@clinic.com has no clinic — run the seed first');
  const clinicId = masterUser.clinicId;

  if (REPLACE) {
    console.log('--replace: clearing existing clinical data (users/clinics/wards kept)...');
    // Order matters: children before parents.
    await prisma.medicationAdministration.deleteMany({ where: { clinicId } });
    await prisma.medicationOrder.deleteMany({ where: { clinicId } });
    await prisma.progressNote.deleteMany({ where: { clinicId } });
    await prisma.patientDocument.deleteMany({ where: { clinicId } });
    await prisma.admission.deleteMany({ where: { clinicId } });
    await prisma.bed.updateMany({ where: { clinicId }, data: { status: 'AVAILABLE' } });
    await prisma.commissionRecord.deleteMany({ where: { clinicId } });
    await prisma.invoice.deleteMany({ where: { clinicId } });
    await prisma.prescriptionItem.deleteMany({ where: { prescription: { clinicId } } });
    await prisma.prescription.deleteMany({ where: { clinicId } });
    await prisma.appointment.deleteMany({ where: { clinicId } });
    await prisma.visit.deleteMany({ where: { clinicId } });
    await prisma.packagePurchase.deleteMany({ where: { clinicId } });
    await prisma.packageType.deleteMany({ where: { clinicId } });
    await prisma.purchase.deleteMany({ where: { clinicId } });
    await prisma.patient.deleteMany({ where: { clinicId } });
    await prisma.treatmentMaster.deleteMany({ where: { clinicId } });
  }

  // ---- Doctors: map the workbook's doctor names onto real user accounts ----
  const doctorNames: string[] = raw.doctors ?? [];
  const doctorByName = new Map<string, string>();
  const defaultHash = await bcrypt.hash('doctor123', 10);
  for (const name of doctorNames) {
    const email = `${name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@clinic.com`;
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, role: 'DOCTOR', clinicId },
      create: { email, name, role: 'DOCTOR', passwordHash: defaultHash, clinicId },
    });
    doctorByName.set(name, user.id);
  }
  const fallbackDoctorId = doctorByName.values().next().value ?? masterUser.id;
  console.log(`Doctors mapped: ${doctorByName.size}`);

  // ---- Treatments ----
  const treatmentByName = new Map<string, string>();
  const treatmentEntries = Object.entries(raw.treatments as Record<string, boolean>);
  for (const [name, taxable] of treatmentEntries) {
    const id = idFor('trt', clinicId, name);
    await prisma.treatmentMaster.upsert({
      where: { id },
      update: { name, isGstTaxable: taxable, clinicId },
      // Price is not in the workbook — the day-book records money per visit instead.
      create: { id, name, isGstTaxable: taxable, price: 0, clinicId },
    });
    treatmentByName.set(name.toLowerCase(), id);
  }
  console.log(`Treatments: ${treatmentEntries.length}`);

  // ---- Patients ----
  const patientByPhone = new Map<string, string>();
  const patientByName = new Map<string, string>();
  let uhidSeq = 0;
  const patientEntries = Object.entries(raw.patients as Record<string, Row>);
  for (const [key, p] of patientEntries) {
    const id = idFor('pat', clinicId, key);
    uhidSeq++;
    const data = {
      name: p.name,
      phone: p.phone || 'N/A',
      email: p.email || null,
      dob: isDate(p.dob) ? p.dob : null,
      gender: ['Male', 'Female', 'Other'].includes(p.gender) ? p.gender : 'Other',
      address: p.address || null,
      allergyNotes: p.allergyNotes || null,
      referringDoctor: p.referringDoctor || null,
      howHeardAboutUs: p.howHeardAboutUs || null,
      clinicId,
    };
    await prisma.patient.upsert({
      where: { id },
      update: data,
      create: { id, uhid: `UHID-${String(uhidSeq).padStart(5, '0')}`, ...data },
    });
    if (p.phone) patientByPhone.set(p.phone, id);
    patientByName.set(p.name.trim().toLowerCase(), id);
  }
  console.log(`Patients from master: ${patientEntries.length}`);

  /** Day-book rows sometimes reference people absent from the master sheet. */
  async function ensurePatient(phone: string, name: string): Promise<string | null> {
    if (phone && patientByPhone.has(phone)) return patientByPhone.get(phone)!;
    const nameKey = name.trim().toLowerCase();
    if (!phone && patientByName.has(nameKey)) return patientByName.get(nameKey)!;
    if (!name && !phone) return null;

    const key = phone || `nophone::${nameKey}`;
    const id = idFor('pat', clinicId, key);
    uhidSeq++;
    const data = {
      name: name || `Unknown (${phone})`,
      phone: phone || 'N/A',
      gender: 'Other',
      clinicId,
    };
    await prisma.patient.upsert({
      where: { id },
      update: {},
      create: { id, uhid: `UHID-${String(uhidSeq).padStart(5, '0')}`, ...data },
    });
    if (phone) patientByPhone.set(phone, id);
    patientByName.set(nameKey, id);
    return id;
  }

  // ---- Visits (OPD + IPD day-books) ----
  const VALID_STATUS = new Set(['New', 'Follow Up', 'Dressing']);
  let visitCount = 0;
  let skipped = 0;
  const visits: Row[] = raw.visits;

  for (let i = 0; i < visits.length; i++) {
    const v = visits[i];
    const patientId = await ensurePatient(v.phone, v.patientName);
    if (!patientId) {
      skipped++;
      continue;
    }

    const treatmentId = v.treatment ? treatmentByName.get(v.treatment.toLowerCase()) ?? null : null;
    const doctorId = doctorByName.get(v.doctorName) ?? fallbackDoctorId;
    const status = VALID_STATUS.has(v.status) ? v.status : 'New';

    const id = idFor('vst', clinicId, v.visitType, v.date, v.phone || v.patientName, v.treatment, String(i));
    const data = {
      date: v.date,
      visitType: v.visitType,
      patientId,
      doctorId,
      rmId: null,
      clientRm: v.clientRm || null,
      operator: v.operator || v.doctorName || 'Not Recorded',
      treatmentId,
      treatmentName: v.treatment || 'Not Specified',
      treatmentPrice: 0,
      isGstTaxable: !!v.taxable,
      diagnosis: v.diagnosis || null,
      remarks: v.remarks || null,
      otherRemarks: v.otherRemarks || null,
      cashAmount: v.cash || 0,
      bankAmount: v.bank || 0,
      paymentRefId: v.paymentRefId && v.paymentRefId !== 'Not Available' ? v.paymentRefId : null,
      status,
      nextAppointmentDate: isDate(v.nextAppointmentDate) ? v.nextAppointmentDate : null,
      clinicId,
    };
    await prisma.visit.upsert({ where: { id }, update: data, create: { id, ...data } });
    visitCount++;
    if (visitCount % 400 === 0) console.log(`  ...${visitCount} visits`);
  }
  console.log(`Visits: ${visitCount} imported, ${skipped} skipped (no identifiable patient)`);

  // ---- Packages ----
  const pkgTypeByCode = new Map<string, string>();
  for (const p of raw.packages as Row[]) {
    const code = p.code || p.description || 'Package';
    if (pkgTypeByCode.has(code)) continue;
    const id = idFor('pkt', clinicId, code);
    await prisma.packageType.upsert({
      where: { id },
      update: { name: code, description: p.description || null, clinicId },
      create: {
        id,
        name: code,
        description: p.description || null,
        price: p.amount || 0,
        totalSittings: p.totalSittings || 0,
        isGstTaxable: !!p.taxable,
        clinicId,
      },
    });
    pkgTypeByCode.set(code, id);
  }

  let pkgCount = 0;
  for (let i = 0; i < (raw.packages as Row[]).length; i++) {
    const p = raw.packages[i];
    const patientId = await ensurePatient(p.phone, p.patientName);
    if (!patientId) continue;
    const code = p.code || p.description || 'Package';
    const id = idFor('pkp', clinicId, p.phone || p.patientName, code, p.purchaseDate, String(i));
    const data = {
      patientId,
      packageTypeId: pkgTypeByCode.get(code)!,
      packageName: p.description || code,
      packageCode: p.code || null,
      purchaseDate: isDate(p.purchaseDate) ? p.purchaseDate : new Date().toISOString().split('T')[0],
      amountPaid: p.amount || 0,
      cashAmount: p.cash || 0,
      bankAmount: p.bank || 0,
      paymentRefId: p.paymentRefId || null,
      isGstTaxable: !!p.taxable,
      status: p.status || 'Follow Up',
      totalSittings: p.totalSittings || 0,
      sittingsUsed: p.availed || 0,
      openingSittingsUsed: p.availed || 0,
      sittingsRemaining: p.available || 0,
      clinicId,
    };
    await prisma.packagePurchase.upsert({ where: { id }, update: data, create: { id, ...data } });
    pkgCount++;
  }
  console.log(`Packages: ${pkgTypeByCode.size} types, ${pkgCount} purchases`);

  // ---- Purchase register ----
  let purCount = 0;
  for (let i = 0; i < (raw.purchases as Row[]).length; i++) {
    const p = raw.purchases[i];
    const id = idFor('pur', clinicId, p.vendorName, p.invoiceNumber, String(i));
    const data = {
      vendorName: p.vendorName,
      vendorGstn: p.vendorGstn,
      invoiceNumber: p.invoiceNumber,
      invoiceDate: isDate(p.invoiceDate) ? p.invoiceDate : new Date().toISOString().split('T')[0],
      itemDescription: p.itemDescription || p.inputClassification || 'Not specified',
      inputClassification: p.inputClassification,
      itcEligibility: p.itcEligibility,
      taxableValue: p.taxableValue,
      igst: p.igst,
      cgst: p.cgst,
      sgst: p.sgst,
      totalValue: p.totalValue,
      recordedById: masterUser.id,
      clinicId,
    };
    await prisma.purchase.upsert({ where: { id }, update: data, create: { id, ...data } });
    purCount++;
  }
  console.log(`Purchases: ${purCount}`);

  console.log('\nImport complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
