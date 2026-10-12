#!/usr/bin/env node
/**
 * [TEST DATA] Dermatology & reconstructive QA dataset generator.
 *
 * Produces a deterministic, fully synthetic dataset (fixed seed) for an isolated QA
 * environment of the Hospital Management System. Every person, phone number, address,
 * clinical note and transaction is fictional and labelled as test data. Clinical text is
 * simulated for software testing only — it is NOT medical advice and NOT a patient record.
 *
 * Usage:  node test-data/derm-qa/generate.mjs        -> writes test-data/derm-qa/data/*.csv
 * Re-running always produces identical files (seed below).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'data');
fs.mkdirSync(OUT, { recursive: true });

// ───────────────────────────── deterministic helpers ─────────────────────────────
let seed = 20261012;
const rnd = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of pairs) { if ((r -= w) < 0) return v; }
  return pairs[pairs.length - 1][0];
};
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const round2 = (n) => Math.round(n * 100) / 100;
const pad = (n, w = 3) => String(n).padStart(w, '0');

const d = (s) => new Date(`${s}T00:00:00Z`);
const fmt = (dt) => dt.toISOString().slice(0, 10);
const addDays = (s, n) => fmt(new Date(d(s).getTime() + n * 86400000));
const dow = (s) => d(s).getUTCDay(); // 0 = Sunday
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const toHHMM = (mins) => `${pad(Math.floor(mins / 60), 2)}:${pad(mins % 60, 2)}`;

// ───────────────────────────── configuration ─────────────────────────────
export const CONFIG = {
  clinicName: '[TEST] Aurora Skin & Reconstructive Clinic (QA)',
  clinicAddress: '[TEST DATA] Plot 0, QA Street, Pune, Maharashtra 411000 — fictional',
  clinicPhone: '0200000000',
  clinicEmail: 'frontdesk@aurora-qa.test',
  clinicStateCode: '27',
  gstinPlaceholder: 'TEST-GSTIN-NOT-VALID',
  windowStart: '2026-09-14', // Monday
  windowEnd: '2026-10-10', // Saturday (4 weeks, Mon–Sat; clinic closed Sundays)
  liveDay: 'IMPORT_DAY', // resolved to the actual import date by the importer
  futureHorizonDays: 28,
  testPassword: 'QaTest@2026', // isolated local QA database only
  consultFeeNew: 800,
  consultFeeFollowUp: 500,
};

const opDays = [];
for (let s = CONFIG.windowStart; s <= CONFIG.windowEnd; s = addDays(s, 1)) if (dow(s) !== 0) opDays.push(s);

// ───────────────────────────── departments & staff ─────────────────────────────
const DEPARTMENTS = [
  { dept_id: 'DEP-DERM', name: 'Dermatology', code: 'DERM', description: '[TEST] General, paediatric and aesthetic dermatology' },
  { dept_id: 'DEP-PLAS', name: 'Plastic & Reconstructive Surgery', code: 'PLAS', description: '[TEST] Reconstructive surgery, wound care and scar management' },
];

const STAFF = [
  { staff_id: 'S01', name: 'Ira Deshmukh (Test Admin)', role: 'MASTER', title: 'Clinic Administrator', dept_id: '', assigned_doctor: '' },
  { staff_id: 'S02', name: 'Kavya Rao (Test Reception)', role: 'RECEPTION', title: 'Front Desk — Morning', dept_id: '', assigned_doctor: '' },
  { staff_id: 'S03', name: 'Rohan Desai (Test Reception)', role: 'RECEPTION', title: 'Front Desk — Evening', dept_id: '', assigned_doctor: '' },
  { staff_id: 'D1', name: 'Dr. Meera Kulkarni (Test)', role: 'DOCTOR', title: 'Consultant Dermatologist — Medical & Acne', dept_id: 'DEP-DERM', assigned_doctor: '' },
  { staff_id: 'D2', name: 'Dr. Arjun Iyer (Test)', role: 'DOCTOR', title: 'Consultant Dermatologist — Hair, Laser & Aesthetics', dept_id: 'DEP-DERM', assigned_doctor: '' },
  { staff_id: 'D3', name: 'Dr. Sana Mirza (Test)', role: 'DOCTOR', title: 'Consultant Dermatologist — Paediatric & Medical', dept_id: 'DEP-DERM', assigned_doctor: '' },
  { staff_id: 'D4', name: 'Dr. Vikram Shetty (Test)', role: 'DOCTOR', title: 'Consultant Plastic & Reconstructive Surgeon', dept_id: 'DEP-PLAS', assigned_doctor: '' },
  { staff_id: 'S08', name: 'Asha Pillai (Test Nurse)', role: 'NURSE', title: 'Ward Nurse — Day', dept_id: 'DEP-PLAS', assigned_doctor: 'D4' },
  { staff_id: 'S09', name: 'Leena DSouza (Test Nurse)', role: 'NURSE', title: 'Ward Nurse — Night', dept_id: 'DEP-PLAS', assigned_doctor: 'D4' },
  { staff_id: 'S10', name: 'Nikhil Patil (Test Procedure Tech)', role: 'STAFF', title: 'Procedure Room Technician (Laser/PRP)', dept_id: 'DEP-DERM', assigned_doctor: 'D2' },
  { staff_id: 'S11', name: 'Farah Khan (Test OT Tech)', role: 'STAFF', title: 'OT / Minor Procedure Assistant', dept_id: 'DEP-PLAS', assigned_doctor: 'D4' },
  { staff_id: 'S12', name: 'Deepak Joshi (Test Pharmacist)', role: 'PHARMACY', title: 'Pharmacist', dept_id: '', assigned_doctor: '' },
  { staff_id: 'S13', name: 'Pooja Nair (Test Accounts)', role: 'ACCOUNT', title: 'Billing & Accounts', dept_id: '', assigned_doctor: '' },
  { staff_id: 'S14', name: 'Aditya Menon (Test RM)', role: 'RM', title: 'Relationship Manager', dept_id: '', assigned_doctor: '' },
].map((s) => ({ ...s, email: `${s.staff_id.toLowerCase()}.${s.role.toLowerCase()}@aurora-qa.test`, test_data: 'YES' }));
const staffName = (id) => STAFF.find((s) => s.staff_id === id).name;

/** Weekly sessions (app: DoctorSchedule, one session per doctor per weekday). */
const SCHEDULES = {
  D1: { days: [1, 2, 3, 4, 5, 6], start: '10:00', end: '14:00', slot: 15 },
  D2: { days: [1, 2, 3, 4, 5, 6], start: '14:00', end: '19:00', slot: 15 },
  D3: { days: [1, 3, 5, 6], start: '15:00', end: '19:00', slot: 15 },
  D4: { days: [2, 4, 6], start: '10:00', end: '13:00', slot: 15 }, // Mon/Wed = OT days (not modelled by the app)
};
const LEAVE = [
  { leave_id: 'LV01', staff_id: 'D3', from: '2026-09-28', to: '2026-09-30', reason: '[TEST] Conference leave', app_support: 'UNSUPPORTED — no leave model; app will still offer slots' },
  { leave_id: 'LV02', staff_id: 'S08', from: '2026-10-03', to: '2026-10-03', reason: '[TEST] Sick leave (nurse)', app_support: 'UNSUPPORTED — no nurse roster' },
];
const onLeave = (doc, date) => LEAVE.some((l) => l.staff_id === doc && date >= l.from && date <= l.to);
const doctorWorks = (doc, date) => dow(date) !== 0 && SCHEDULES[doc].days.includes(dow(date)) && !onLeave(doc, date);
const nextDoctorDay = (doc, date) => { let s = date; for (let i = 0; i < 14; i++) { if (doctorWorks(doc, s)) return s; s = addDays(s, 1); } throw new Error(`no day for ${doc}`); };

// ───────────────────────────── treatments / procedures master ─────────────────────────────
// Classification is TEST CONFIGURATION only — every row is flagged for review by a
// qualified Indian GST professional. SAC codes are indicative placeholders.
const TREATMENTS = [
  ['TR01', 'PRP Scalp Session', 6500, true, 18, '999722', 'Aesthetic hair restoration (test: taxable)'],
  ['TR02', 'Glycolic Acid Peel', 2500, true, 18, '999722', 'Cosmetic peel (test: taxable)'],
  ['TR03', 'Salicylic Acid Peel', 2200, true, 18, '999722', 'Acne peel (test: taxable)'],
  ['TR04', 'Q-Switched Nd:YAG Laser Toning', 4500, true, 18, '999722', 'Pigment laser (test: taxable)'],
  ['TR05', 'Fractional CO2 Laser (Scars)', 7500, true, 18, '999722', 'Scar resurfacing (test: taxable)'],
  ['TR06', 'Microneedling with Serum', 4000, true, 18, '999722', 'Scar/texture (test: taxable)'],
  ['TR07', 'Diode Laser Hair Reduction (Face)', 3500, true, 18, '999722', 'Hair reduction (test: taxable)'],
  ['TR08', 'RF Ablation — Seborrhoeic Keratosis', 3000, true, 18, '999722', 'Cosmetic lesion removal (test: taxable)'],
  ['TR09', 'Cryotherapy — Viral Warts', 1200, false, 0, '999312', 'Medical treatment (test: exempt)'],
  ['TR10', 'Electrocautery — Warts (LA)', 1500, false, 0, '999312', 'Medical treatment (test: exempt)'],
  ['TR11', 'Punch Biopsy with Histopathology Dispatch', 2500, false, 0, '999312', 'Diagnostic (test: exempt)'],
  ['TR12', 'Excision of Benign Lesion — Primary Closure', 6000, false, 0, '999312', 'Medical/surgical (test: exempt)'],
  ['TR13', 'Wound Dressing — Simple', 500, false, 0, '999312', 'Wound care (test: exempt)'],
  ['TR14', 'Intralesional Triamcinolone Injection', 800, false, 0, '999312', 'Medical (test: exempt)'],
  ['TR15', 'Split-Thickness Skin Graft (STSG)', 45000, false, 0, '999311', 'Reconstructive surgery (test: exempt)'],
  ['TR16', 'Scar Revision — Post-Traumatic', 25000, false, 0, '999311', 'Reconstructive surgery (test: exempt)'],
  ['TR17', 'Local Flap Reconstruction', 38000, false, 0, '999311', 'Reconstructive surgery (test: exempt)'],
  ['TR18', 'Suture Removal', 300, false, 0, '999312', 'Wound care (test: exempt)'],
  ['TR19', 'IPD Bed Charges (per day)', 2500, false, 0, '999311', 'Inpatient room (test: exempt) — workaround: care orders cannot carry a free price'],
].map(([treatment_id, name, price, taxable, rate, sac, basis]) => ({
  treatment_id, name, price, is_gst_taxable: taxable ? 'YES' : 'NO', tax_rate: rate, sac_code: sac,
  classification_basis: basis, needs_gst_professional_review: 'YES', test_data: 'YES',
}));
const TR = Object.fromEntries(TREATMENTS.map((t) => [t.treatment_id, t]));

// ───────────────────────────── medicine master & stock scenarios ─────────────────────────────
// [id, name, unit, form, category, sell, cost, taxable, rate, hsn, shelf, reorder, scenario]
const MEDICINES = [
  ['M01', 'Doxycycline 100mg Capsule (Test)', 'capsule', 'Capsule', 'Antibiotic (oral)', 12, 6, true, 12, '3004', 'Rack A', 30, 'MULTI_BATCH'],
  ['M02', 'Isotretinoin 20mg Capsule (Test)', 'capsule', 'Capsule', 'Retinoid (oral)', 45, 25, true, 12, '3004', 'Rack A', 20, 'AVAILABLE'],
  ['M03', 'Adapalene 0.1% Gel 15g (Test)', 'tube', 'Gel', 'Topical retinoid', 210, 120, true, 12, '3004', 'Rack C', 6, 'DIFFERENT_BATCH_ONLY'],
  ['M04', 'Clindamycin 1% Gel 20g (Test)', 'tube', 'Gel', 'Topical antibiotic', 160, 90, true, 12, '3004', 'Rack C', 6, 'AVAILABLE'],
  ['M05', 'Benzoyl Peroxide 2.5% Gel 20g (Test)', 'tube', 'Gel', 'Topical anti-acne', 140, 80, true, 12, '3004', 'Rack C', 6, 'NEAR_EXPIRY'],
  ['M06', 'Minoxidil 5% Solution 60ml (Test)', 'bottle', 'Solution', 'Hair (topical)', 650, 380, true, 12, '3004', 'Rack D', 6, 'AVAILABLE'],
  ['M07', 'Finasteride 1mg Tablet (Test)', 'tablet', 'Tablet', 'Hair (oral)', 9, 4, true, 12, '3004', 'Rack A', 60, 'AVAILABLE'],
  ['M08', 'Biotin 10mg Tablet (Test)', 'tablet', 'Tablet', 'Supplement', 8, 4, true, 18, '2106', 'Rack A', 60, 'AVAILABLE'],
  ['M09', 'Hydroquinone 2% + Tretinoin + Mometasone Cream 15g (Test)', 'tube', 'Cream', 'Depigmenting', 260, 150, true, 12, '3004', 'Rack C', 5, 'AVAILABLE'],
  ['M10', 'Tranexamic Acid 250mg Tablet (Test)', 'tablet', 'Tablet', 'Depigmenting (oral)', 14, 7, true, 12, '3004', 'Rack A', 60, 'AVAILABLE'],
  ['M11', 'Sunscreen SPF 50 Gel 50g (Test)', 'tube', 'Gel', 'Photoprotection', 520, 300, true, 18, '3304', 'Rack C', 8, 'MULTI_BATCH'],
  ['M12', 'Mometasone 0.1% Cream 15g (Test)', 'tube', 'Cream', 'Topical steroid', 120, 65, true, 12, '3004', 'Rack C', 6, 'AVAILABLE'],
  ['M13', 'Tacrolimus 0.03% Ointment 10g (Test)', 'tube', 'Ointment', 'Calcineurin inhibitor', 340, 200, true, 12, '3004', 'Rack C', 10, 'LOW_STOCK'],
  ['M14', 'Cetirizine 10mg Tablet (Test)', 'tablet', 'Tablet', 'Antihistamine', 2, 0.8, true, 12, '3004', 'Rack A', 30, 'EXPIRED_BATCH'],
  ['M15', 'Emollient Lotion 200ml (Test)', 'bottle', 'Lotion', 'Moisturiser', 450, 250, true, 18, '3304', 'Rack D', 6, 'RETURN_TO_SUPPLIER'],
  ['M16', 'Clobetasol 0.05% Ointment 15g (Test)', 'tube', 'Ointment', 'Topical steroid (potent)', 110, 60, true, 12, '3004', 'Rack C', 6, 'AVAILABLE'],
  ['M17', 'Methotrexate 7.5mg Tablet (Test)', 'tablet', 'Tablet', 'Immunosuppressant', 6, 3, true, 12, '3004', 'Rack A', 20, 'AVAILABLE'],
  ['M18', 'Calcipotriol 0.005% Ointment 30g (Test)', 'tube', 'Ointment', 'Vitamin D analogue', 690, 400, true, 12, '3004', 'Rack C', 4, 'ZERO_STOCK'],
  ['M19', 'Itraconazole 100mg Capsule (Test)', 'capsule', 'Capsule', 'Antifungal (oral)', 32, 18, true, 12, '3004', 'Rack A', 30, 'INSUFFICIENT_FOR_RX'],
  ['M20', 'Luliconazole 1% Cream 30g (Test)', 'tube', 'Cream', 'Antifungal (topical)', 380, 210, true, 12, '3004', 'Rack C', 6, 'PATIENT_RETURN'],
  ['M21', 'Terbinafine 250mg Tablet (Test)', 'tablet', 'Tablet', 'Antifungal (oral)', 20, 10, true, 12, '3004', 'Rack A', 20, 'AVAILABLE'],
  ['M22', 'Salicylic + Lactic Acid Wart Paint 10ml (Test)', 'bottle', 'Solution', 'Keratolytic', 160, 90, true, 12, '3004', 'Rack D', 4, 'AVAILABLE'],
  ['M23', 'Mupirocin 2% Ointment 5g (Test)', 'tube', 'Ointment', 'Topical antibiotic', 115, 60, true, 12, '3004', 'Rack C', 6, 'AVAILABLE'],
  ['M24', 'Paracetamol 500mg Tablet (Test)', 'tablet', 'Tablet', 'Analgesic', 2, 0.7, true, 12, '3004', 'Rack A', 50, 'NEAR_EXPIRY_MULTI_BATCH'],
  ['M25', 'Amoxicillin-Clavulanate 625mg Tablet (Test)', 'tablet', 'Tablet', 'Antibiotic (oral)', 22, 12, true, 12, '3004', 'Rack A', 30, 'AVAILABLE'],
  ['M26', 'Ceftriaxone 1g Injection (Test)', 'vial', 'Injection', 'Antibiotic (IV)', 65, 35, true, 12, '3004', 'Rack E', 10, 'AVAILABLE'],
  ['M27', 'Lignocaine 2% Injection 30ml (Test)', 'vial', 'Injection', 'Local anaesthetic', 45, 25, true, 12, '3004', 'Rack E', 6, 'CONSUMABLE'],
  ['M28', 'Povidone Iodine 5% Solution 100ml (Test)', 'bottle', 'Solution', 'Antiseptic', 95, 50, true, 12, '3004', 'Rack D', 4, 'CONSUMABLE'],
  ['M29', 'Paraffin Gauze Dressing 10x10cm (Test)', 'piece', 'Dressing', 'Wound care', 35, 18, true, 12, '3005', 'Rack F', 20, 'CONSUMABLE'],
  ['M30', 'Sterile Gauze Pad Pack (Test)', 'pack', 'Dressing', 'Wound care', 40, 20, true, 12, '3005', 'Rack F', 20, 'CONSUMABLE'],
  ['M31', 'PRP Kit — Single Use (Test)', 'piece', 'Kit', 'Procedure consumable', 1800, 1100, true, 12, '9018', 'Rack E', 4, 'CONSUMABLE'],
  ['M32', 'Triamcinolone 40mg/ml Injection (Test)', 'vial', 'Injection', 'Steroid (intralesional)', 120, 70, true, 12, '3004', 'Rack E', 4, 'AVAILABLE'],
  ['M33', 'Levocetirizine 5mg Tablet (Test)', 'tablet', 'Tablet', 'Antihistamine', 4, 1.5, true, 12, '3004', 'Rack A', 30, 'AVAILABLE'],
  ['M34', 'Levocetirizine 2.5mg/5ml Syrup 60ml (Test)', 'bottle', 'Syrup', 'Antihistamine (paediatric)', 85, 45, true, 12, '3004', 'Rack B', 6, 'AVAILABLE'],
  ['M35', 'Folic Acid 5mg Tablet (Test)', 'tablet', 'Tablet', 'Supplement', 1.5, 0.5, true, 12, '3004', 'Rack A', 30, 'AVAILABLE'],
].map(([medicine_id, name, unit, form, category, unit_price, cost, taxable, rate, hsn, shelf, reorder, scenario]) => ({
  medicine_id, name, unit, dosage_form: form, category, unit_price, cost_price: cost, is_gst_taxable: taxable ? 'YES' : 'NO',
  tax_rate: rate, hsn_code: hsn, shelf, reorder_point: reorder, stock_scenario: scenario,
  needs_gst_professional_review: 'YES', test_data: 'YES',
}));
const MED = Object.fromEntries(MEDICINES.map((m) => [m.medicine_id, m]));

// Suppliers and purchase invoices (stock receipts). Batches with deliberate expiry cases.
const VENDORS = [
  { vendor_id: 'V1', name: '[TEST] Sahyadri Pharma Distributors', gstin: 'TEST-GSTN-V1-NOT-VALID', state: 'Maharashtra (27)', supply_type: 'Intra-state' },
  { vendor_id: 'V2', name: '[TEST] MedSurg Consumables Co.', gstin: 'TEST-GSTN-V2-NOT-VALID', state: 'Karnataka (29)', supply_type: 'Inter-state (IGST expected)' },
];
// [po_id, vendor, invoice_no, date, [[med, batch, expiry, qty]...]]
const PURCHASES = [
  ['PO1', 'V1', 'TEST-SPD-0912', '2026-09-12', [
    ['M01', 'DOX-A1', '2027-06-30', 200], ['M02', 'ISO-A1', '2027-09-30', 60], ['M03', 'ADA-A1', '2027-03-31', 3],
    ['M04', 'CLI-A1', '2027-05-31', 12], ['M05', 'BPO-A1', '2026-11-15', 10], ['M06', 'MIN-A1', '2027-08-31', 12],
    ['M07', 'FIN-A1', '2027-12-31', 200], ['M08', 'BIO-A1', '2027-10-31', 200], ['M09', 'TRI-A1', '2027-04-30', 10],
    ['M10', 'TXA-A1', '2027-07-31', 500], ['M11', 'SUN-A1', '2027-02-28', 12], ['M12', 'MOM-A1', '2027-06-30', 12],
    ['M13', 'TAC-A1', '2027-05-31', 4], ['M14', 'CET-A1', '2026-09-30', 20], ['M15', 'EMO-A1', '2027-08-31', 15],
    ['M16', 'CLO-A1', '2027-06-30', 10], ['M17', 'MTX-A1', '2027-09-30', 40], ['M19', 'ITR-A1', '2027-03-31', 10],
    ['M20', 'LUL-A1', '2027-07-31', 10], ['M21', 'TER-A1', '2027-08-31', 40], ['M22', 'WRT-A1', '2027-05-31', 8],
    ['M23', 'MUP-A1', '2027-04-30', 10], ['M24', 'PCM-A1', '2026-11-30', 60], ['M25', 'AMC-A1', '2027-06-30', 60],
    ['M33', 'LEV-A1', '2027-09-30', 100], ['M34', 'LVS-A1', '2027-03-31', 10], ['M35', 'FOL-A1', '2028-01-31', 100],
  ]],
  ['PO2', 'V2', 'TEST-MSC-0912', '2026-09-12', [
    ['M26', 'CEF-B1', '2027-08-31', 20], ['M27', 'LIG-B1', '2027-10-31', 12], ['M28', 'PVI-B1', '2027-12-31', 10],
    ['M29', 'PGD-B1', '2028-03-31', 60], ['M30', 'GAU-B1', '2028-03-31', 60], ['M31', 'PRP-B1', '2027-06-30', 8],
    ['M32', 'TRC-B1', '2027-07-31', 6],
  ]],
  ['PO3', 'V1', 'TEST-SPD-0919', '2026-09-19', [
    ['M01', 'DOX-A2', '2027-11-30', 60], ['M11', 'SUN-A2', '2027-09-30', 12], ['M24', 'PCM-A2', '2027-12-31', 100],
    ['M03', 'ADA-A2', '2027-10-31', 8],
  ]],
  ['PO4', 'V2', 'TEST-MSC-1003', '2026-10-03', [
    ['M31', 'PRP-B2', '2027-09-30', 8],
  ]],
  ['PO5', 'V1', 'TEST-SPD-1003', '2026-10-03', [
    ['M14', 'CET-A2', '2027-08-31', 60],
  ]],
];

// ───────────────────────────── packages ─────────────────────────────
const PACKAGE_TYPES = [
  { package_type_id: 'PK1', name: 'PRP Hair Restoration — 6 Sessions (Test)', treatment_id: 'TR01', total_sittings: 6, price: 33000, is_gst_taxable: 'YES', sitting_gap_days: 28, doctor: 'D2' },
  { package_type_id: 'PK2', name: 'Acne Peel Series — 4 Sessions (Test)', treatment_id: 'TR03', total_sittings: 4, price: 8000, is_gst_taxable: 'YES', sitting_gap_days: 14, doctor: 'D1' },
  { package_type_id: 'PK3', name: 'Melasma Laser Toning — 6 Sessions (Test)', treatment_id: 'TR04', total_sittings: 6, price: 22000, is_gst_taxable: 'YES', sitting_gap_days: 14, doctor: 'D2' },
  { package_type_id: 'PK4', name: 'Wound Dressing — 10 Sessions (Test)', treatment_id: 'TR13', total_sittings: 10, price: 4000, is_gst_taxable: 'NO', sitting_gap_days: 2, doctor: 'D4' },
].map((p) => ({ ...p, description: `[TEST] ${p.name}`, needs_gst_professional_review: 'YES', test_data: 'YES' }));
const PKT = Object.fromEntries(PACKAGE_TYPES.map((p) => [p.package_type_id, p]));

// ───────────────────────────── clinical templates ─────────────────────────────
// Each template = one test pathway. `steps` are offsets (days) from the first visit;
// the generator moves each onto a day the treating doctor works.
const rx = (med, dosage, route, frequency, duration, qty, instructions = '') => ({ med, dosage, route, frequency, duration, qty, instructions });

const T = {
  AGA_PRP: {
    count: 5, category: 'TAXABLE_TEST', doctor: 'D2', gender: 'Male', age: [24, 45],
    complaint: () => pick(['Hair thinning on crown and front', 'Receding hairline, wants hair treatment', 'Hair fall and thinning at top of head']),
    history: () => `Progressive thinning for ${int(1, 4)} years. Father has male-pattern baldness. No systemic illness, no current medication, no anticoagulants.`,
    exam: () => `Norwood-Hamilton grade ${pick(['III', 'III vertex', 'IV'])}. Trichoscopy: hair-shaft diameter variability >20%, miniaturised hairs. Scalp healthy, pull test negative.`,
    dx: 'Androgenetic alopecia (male pattern) — clinical + trichoscopic diagnosis',
    plan: 'Minoxidil 5% 1 ml twice daily; Finasteride 1 mg daily (counselled on sexual side-effects, reversible); PRP series 6 sessions monthly. Pre-PRP: CBC/platelets [placeholder], no NSAIDs 3 days before.',
    advice: 'Apply minoxidil on dry scalp, do not wash for 4 hours. Initial shedding in first 6 weeks is expected. Avoid painkillers 3 days before each PRP session.',
    rx: [rx('M06', '1 ml', 'Topical', 'Twice daily', '1 month', 1, 'Apply to thinning areas'), rx('M07', '1 mg', 'Oral', '0-0-1', '30 days', 30)],
    package: 'PK1',
    steps: [
      { o: 0, kind: 'NEW', proc: 'TR01', buyPackage: true, redeem: true, consumables: [['M31', 1]] },
      { o: 28, kind: 'PROC', proc: 'TR01', redeem: true, trend: ['SAME', 'IMPROVING'], consumables: [['M31', 1]] },
      { o: 56, kind: 'PROC', proc: 'TR01', redeem: true },
    ],
  },
  FPHL_PRP: {
    count: 3, category: 'TAXABLE_TEST', doctor: 'D2', gender: 'Female', age: [28, 48],
    complaint: () => pick(['Hair thinning on top, scalp visible', 'Widening hair parting', 'Hair volume reduced']),
    history: () => `Gradual thinning over ${int(1, 3)} years, widening central parting. Menses regular. No recent illness or crash diet.`,
    exam: () => `Ludwig grade ${pick(['I', 'II'])}; widened central parting, 'Christmas-tree' pattern. Trichoscopy: miniaturisation, peripilar sign. Pull test negative.`,
    dx: 'Female pattern hair loss (Ludwig I–II) — provisional; thyroid and ferritin pending [placeholder]',
    plan: 'Minoxidil 5% once daily at night; Biotin; PRP monthly x 6 after labs reviewed. Labs: TSH, ferritin, Vit D, CBC [placeholders].',
    advice: 'Apply minoxidil once nightly. Bring blood reports at next visit.',
    rx: [rx('M06', '1 ml', 'Topical', 'Once at night', '1 month', 1), rx('M08', '10 mg', 'Oral', '1-0-0', '30 days', 30)],
    package: 'PK1',
    steps: [
      { o: 0, kind: 'NEW' },
      { o: 14, kind: 'PROC', proc: 'TR01', buyPackage: true, redeem: true, trend: ['SAME'], consumables: [['M31', 1]] },
      { o: 42, kind: 'PROC', proc: 'TR01', redeem: true },
    ],
  },
  MELASMA: {
    count: 4, category: 'TAXABLE_TEST', doctor: 'D2', gender: 'Female', age: [28, 50],
    complaint: () => pick(['Dark patches on both cheeks', 'Brown pigmentation on face', 'Pigmentation increasing after sun exposure']),
    history: () => `Pigmentation for ${int(1, 5)} years, worse in summer. ${pick(['Started after pregnancy.', 'On oral contraceptive pills for 2 years.', 'Uses no sunscreen regularly.'])} No history of thrombosis.`,
    exam: () => `Symmetrical light-to-dark brown macules over malar areas and ${pick(['nose', 'upper lip', 'forehead'])}. Wood's lamp: mixed pattern. mMASI ${int(7, 14)}.`,
    dx: 'Melasma — malar/centrofacial, mixed type',
    plan: 'Strict photoprotection; triple-combination cream at night x 8 weeks then taper; oral tranexamic acid 250 mg BD x 8 weeks (no thrombosis risk, counselled); Q-switched Nd:YAG laser toning fortnightly after 2 weeks of priming.',
    advice: 'Sunscreen every 3 hours outdoors. Triple cream only at night, only on patches, not near eyes. Stop TXA and inform us if leg swelling or breathlessness.',
    rx: [rx('M11', 'Thin layer', 'Topical', 'Every 3 hours outdoors', '2 months', 1), rx('M09', 'Pea size', 'Topical', 'Once at night', '8 weeks', 1), rx('M10', '250 mg', 'Oral', '1-0-1', '8 weeks', 112)],
    package: 'PK3',
    steps: [
      { o: 0, kind: 'NEW' },
      { o: 14, kind: 'PROC', proc: 'TR04', buyPackage: true, redeem: true, trend: ['IMPROVING', 'SAME'] },
      { o: 28, kind: 'PROC', proc: 'TR04', redeem: true, trend: ['IMPROVING'] },
    ],
  },
  ACNE_PEEL: {
    count: 5, category: 'TAXABLE_TEST', doctor: 'D1', gender: null, age: [16, 28],
    complaint: () => pick(['Pimples on face', 'Acne on cheeks and forehead', 'Painful pimples, oily skin']),
    history: () => `Acne for ${int(6, 30)} months, oily skin. ${pick(['No menstrual irregularity reported.', 'Uses multiple OTC face washes.', 'Picks lesions.'])} No prior isotretinoin.`,
    exam: () => `Multiple open and closed comedones with inflammatory papules and pustules over cheeks and forehead; no nodules or cysts; mild PIH.`,
    dx: 'Acne vulgaris — Grade II (moderate)',
    plan: 'Adapalene 0.1% gel at night; Clindamycin 1% gel morning; Doxycycline 100 mg daily x 6 weeks; salicylic acid peel series (4) every 2 weeks after 2 weeks of topical priming.',
    advice: 'Apply adapalene only at night on dry skin; mild dryness expected. Take doxycycline after food with water, avoid lying down for 30 min, use sunscreen. Do not squeeze pimples.',
    rx: [rx('M03', 'Pea size', 'Topical', 'Once at night', '6 weeks', 1), rx('M04', 'Thin layer', 'Topical', 'Once in morning', '6 weeks', 1), rx('M01', '100 mg', 'Oral', '1-0-0 after food', '6 weeks', 42)],
    package: 'PK2',
    steps: [
      { o: 0, kind: 'NEW' },
      { o: 14, kind: 'PROC', proc: 'TR03', buyPackage: true, redeem: true, trend: ['IMPROVING', 'SAME'] },
      { o: 28, kind: 'PROC', proc: 'TR03', redeem: true, trend: ['IMPROVING'] },
    ],
  },
  ACNE_SCARS: {
    count: 4, category: 'TAXABLE_TEST', doctor: 'D2', gender: null, age: [22, 35],
    complaint: () => pick(['Acne marks and pits on cheeks', 'Wants treatment for acne scars']),
    history: () => `Acne in teens, now inactive for ${int(1, 5)} years. No isotretinoin in last 6 months. No keloid tendency. ${pick(['History of cold sores — antiviral prophylaxis to be considered.', 'No history of cold sores.'])}`,
    exam: () => `Rolling and boxcar atrophic scars over both cheeks${pick(['', ' and temples'])}; no active acne. Goodman & Baron grade ${pick(['3', '3', '4'])}.`,
    dx: 'Post-acne atrophic scarring (rolling + boxcar)',
    plan: 'Fractional CO2 laser monthly x 4 (alternate with microneedling). Test patch at first visit. Strict sun protection 2 weeks post-procedure.',
    advice: 'Redness for 3–5 days after laser is expected. Use only the prescribed moisturiser and sunscreen; no scrubs or peels for 2 weeks.',
    rx: [rx('M11', 'Thin layer', 'Topical', 'Every 3 hours outdoors', '2 months', 1), rx('M15', 'As needed', 'Topical', 'Twice daily', '1 month', 1)],
    steps: [
      { o: 0, kind: 'NEW' },
      { o: 7, kind: 'PROC', proc: 'TR05', trend: ['SAME'] },
      { o: 35, kind: 'PROC', proc: 'TR06' },
    ],
  },
  LHR: {
    count: 3, category: 'TAXABLE_TEST', doctor: 'D2', gender: 'Female', age: [20, 35],
    complaint: () => pick(['Unwanted facial hair on chin', 'Excess hair on upper lip and chin']),
    history: () => `Excess coarse facial hair for ${int(2, 6)} years; ${pick(['irregular periods', 'regular periods'])}; currently threading every 2 weeks.`,
    exam: () => `Terminal hair over chin and upper lip; modified Ferriman-Gallwey score ${int(8, 14)}; acanthosis ${pick(['absent', 'mild on neck'])}.`,
    dx: 'Hirsutism — ?PCOS (provisional); hormonal profile and pelvic USG advised [placeholders]',
    plan: 'Diode laser hair reduction monthly x 6–8; test spot today; gynaecology opinion for PCOS work-up.',
    advice: 'No threading/waxing between sessions — shaving only. Avoid sun 1 week after laser.',
    rx: [rx('M11', 'Thin layer', 'Topical', 'Morning and noon', '1 month', 1)],
    steps: [
      { o: 0, kind: 'NEW', proc: 'TR07' },
      { o: 28, kind: 'PROC', proc: 'TR07', trend: ['IMPROVING'] },
    ],
  },
  PIH_PEEL: {
    count: 2, category: 'TAXABLE_TEST', doctor: 'D1', gender: null, age: [20, 35],
    complaint: () => 'Dark marks after pimples healed',
    history: () => 'Acne settled 6 months ago, residual dark marks. Not on any active acne medication.',
    exam: () => 'Multiple brown macules over cheeks and jawline at sites of old acne; no active inflammatory lesions.',
    dx: 'Post-inflammatory hyperpigmentation (post-acne)',
    plan: 'Glycolic acid peel 35% every 2–3 weeks x 3–4; sunscreen.',
    advice: 'Avoid scrubbing; mild peeling after a peel is normal.',
    rx: [rx('M11', 'Thin layer', 'Topical', 'Every 3 hours outdoors', '1 month', 1)],
    steps: [{ o: 0, kind: 'NEW', proc: 'TR02' }, { o: 21, kind: 'PROC', proc: 'TR02', trend: ['IMPROVING'] }],
  },
  SK_REMOVAL: {
    count: 2, category: 'TAXABLE_TEST', doctor: 'D2', gender: null, age: [48, 68],
    complaint: () => 'Raised brown growths on face and neck',
    history: () => `Multiple slowly enlarging lesions over ${int(2, 8)} years; asymptomatic; no bleeding or rapid change.`,
    exam: () => `${int(4, 9)} 'stuck-on' brown verrucous papules on face/neck. Dermoscopy: comedo-like openings, milia-like cysts, sharp demarcation — no features of melanoma.`,
    dx: 'Seborrhoeic keratoses — dermoscopically confirmed benign',
    plan: 'Radiofrequency ablation of lesions (cosmetic). Counselled on recurrence and possible pigment change.',
    advice: 'Keep treated spots clean and dry; apply mupirocin twice daily for 5 days; crusts fall off in 7–10 days.',
    rx: [rx('M23', 'Thin layer', 'Topical', 'Twice daily', '5 days', 1)],
    steps: [{ o: 0, kind: 'NEW' }, { o: 7, kind: 'PROC', proc: 'TR08' }],
  },
  TE_OPD: {
    count: 2, category: 'TAXABLE_TEST', doctor: 'D2', gender: 'Female', age: [22, 40],
    complaint: () => pick(['Sudden excessive hair fall', 'Hair coming out in bunches while combing']),
    history: () => `Hair fall for ${int(6, 12)} weeks, began ~3 months after ${pick(['dengue fever', 'a crash diet', 'childbirth', 'typhoid'])}. No scalp itching.`,
    exam: () => 'Diffuse thinning; hair pull test positive (>6 hairs, telogen bulbs); no scarring, no patches; nails normal.',
    dx: 'Acute telogen effluvium — provisional (CBC, ferritin, TSH, Vit D pending [placeholder])',
    plan: 'Reassurance, protein-rich diet, Biotin; review with reports in 4 weeks. No procedure indicated (OPD-only pathway).',
    advice: 'Hair fall usually settles in 3–6 months. Eat adequate protein. Bring blood reports.',
    rx: [rx('M08', '10 mg', 'Oral', '1-0-0', '30 days', 30)],
    steps: [{ o: 0, kind: 'NEW' }, { o: 28, kind: 'FU', trend: ['IMPROVING'] }],
  },
  // ─────────── EXEMPT_TEST pathways ───────────
  ATOPIC_CHILD: {
    count: 3, category: 'EXEMPT_TEST', doctor: 'D3', gender: null, age: [3, 10], child: true,
    complaint: () => pick(['Child has itchy dry skin rash', 'Itching and rash behind knees and elbows', 'Dry patchy skin, scratching at night']),
    history: () => `Recurrent itchy rash since infancy; ${pick(['mother has asthma', 'father has allergic rhinitis', 'no family history of atopy'])}; sleep disturbed by itch.`,
    exam: () => `Xerosis; lichenified eczematous plaques in antecubital and popliteal fossae${pick(['', '; mild facial involvement'])}. SCORAD ${int(25, 38)} (moderate). No secondary infection.`,
    dx: 'Atopic dermatitis — moderate',
    plan: 'Liberal emollient BD; mometasone 0.1% to body plaques once daily x 1 week then alternate days; tacrolimus 0.03% for face; levocetirizine syrup at night for itch.',
    advice: 'Lukewarm short baths, apply moisturiser within 3 minutes after bath. Cotton clothing. Do not apply the steroid cream on the face.',
    rx: [rx('M15', 'Liberal', 'Topical', 'Twice daily', '1 month', 1), rx('M12', 'Thin layer', 'Topical', 'Once daily', '1 week then alternate days', 1), rx('M13', 'Thin layer', 'Topical', 'Twice daily (face)', '2 weeks', 1), rx('M34', '2.5 ml', 'Oral', 'At bedtime', '2 weeks', 1)],
    steps: [{ o: 0, kind: 'NEW' }, { o: 14, kind: 'FU', trend: ['IMPROVING', 'IMPROVING', 'SAME'] }],
  },
  CONTACT_DERM: {
    count: 1, category: 'EXEMPT_TEST', doctor: 'D1', gender: 'Female', age: [25, 45],
    complaint: () => 'Itchy rash on earlobes and neck',
    history: () => 'Itchy rash for 3 weeks, started after wearing artificial jewellery; similar episode last year.',
    exam: () => 'Eczematous, lichenified plaques on bilateral earlobes and nape of neck at sites of metal contact.',
    dx: 'Allergic contact dermatitis — ?nickel (patch test advised; not available in app [placeholder])',
    plan: 'Avoid nickel-containing jewellery; mometasone cream 2 weeks; levocetirizine 5 mg at night.',
    advice: 'Use only gold/silver or plastic jewellery. Apply the cream only on the rash.',
    rx: [rx('M12', 'Thin layer', 'Topical', 'Once daily', '2 weeks', 1), rx('M33', '5 mg', 'Oral', '0-0-1', '14 days', 14)],
    steps: [{ o: 0, kind: 'NEW' }, { o: 14, kind: 'FU', trend: ['IMPROVING'] }],
  },
  PSORIASIS: {
    count: 2, category: 'EXEMPT_TEST', doctor: 'D1', gender: null, age: [30, 55],
    complaint: () => pick(['Scaly red patches on elbows and knees', 'Thick scaly patches on scalp and body']),
    history: () => `Recurrent scaly plaques for ${int(3, 12)} years, worse in winter and with stress. No joint pain. Not on any systemic therapy.`,
    exam: () => `Well-demarcated erythematous plaques with silvery scales on extensors and scalp; Auspitz sign positive; nail pitting present. BSA ~${int(8, 14)}%, PASI ${int(8, 13)}.`,
    dx: 'Chronic plaque psoriasis — moderate',
    plan: 'Clobetasol 0.05% ointment BD x 2 weeks then weekend-only; calcipotriol ointment weekdays; emollient. Methotrexate 7.5 mg weekly considered after baseline CBC/LFT/RFT [placeholders]; folic acid on non-MTX days.',
    advice: 'Methotrexate ONCE A WEEK only (Sunday), never daily. Folic acid on other days except Sunday. Avoid alcohol. Report mouth ulcers or fever immediately.',
    rx: [rx('M16', 'Thin layer', 'Topical', 'Twice daily', '2 weeks', 1), rx('M18', 'Thin layer', 'Topical', 'Once daily (weekdays)', '4 weeks', 1, 'ZERO STOCK — pharmacy should flag unavailable'), rx('M15', 'Liberal', 'Topical', 'Twice daily', '1 month', 1)],
    steps: [
      { o: 0, kind: 'NEW' },
      { o: 14, kind: 'FU', trend: ['IMPROVING', 'SAME'], extraRx: [rx('M17', '7.5 mg', 'Oral', 'Once WEEKLY (Sunday)', '4 weeks', 4), rx('M35', '5 mg', 'Oral', 'Once daily except Sunday', '4 weeks', 24)] },
    ],
  },
  TINEA: {
    count: 3, category: 'EXEMPT_TEST', doctor: 'D1', gender: null, age: [18, 50],
    complaint: () => pick(['Itchy ring-shaped rash in groin', 'Itchy circular patches on waist and thighs']),
    history: () => `Itchy spreading rash for ${int(1, 4)} months; ${pick(['used OTC steroid-combination cream with temporary relief', 'family members have similar itch', 'works outdoors, heavy sweating'])}.`,
    exam: () => 'Annular erythematous scaly plaques with active raised border over groin and waist; KOH mount [placeholder]: septate branching hyphae seen.',
    dx: 'Tinea corporis et cruris (dermatophytosis) — KOH positive',
    plan: 'Itraconazole 100 mg BD x 2 weeks; luliconazole 1% cream BD x 4 weeks (continue 2 weeks after clearance); stop steroid creams; hygiene measures.',
    advice: 'Take itraconazole after food. Keep area dry, loose cotton clothes, separate towel, wash clothes in hot water. Do not use steroid creams.',
    rx: [rx('M19', '100 mg', 'Oral', '1-0-1 after food', '14 days', 28), rx('M20', 'Thin layer', 'Topical', 'Twice daily', '4 weeks', 1)],
    steps: [{ o: 0, kind: 'NEW' }, { o: 14, kind: 'FU', trend: ['IMPROVING', 'IMPROVING', 'WORSENING'] }],
  },
  WARTS: {
    count: 3, category: 'EXEMPT_TEST', doctor: 'D3', gender: null, age: [6, 30], childBias: true,
    complaint: () => pick(['Rough growths on fingers', 'Painful growth on sole of foot', 'Warts on hands increasing']),
    history: () => `Lesions for ${int(2, 10)} months, slowly increasing in number; ${pick(['tried OTC wart remover', 'no prior treatment'])}.`,
    exam: () => `${int(2, 6)} verrucous papules ${pick(['on fingers', 'on dorsum of hands', 'on sole (plantar), painful on pressure'])}; paring shows black dots (thrombosed capillaries).`,
    dx: 'Viral warts — verruca vulgaris / plantaris',
    plan: 'Cryotherapy every 2 weeks (3–4 sessions); wart paint at home between sessions.',
    advice: 'A blister may form after freezing — do not burst it. Apply wart paint only on the wart; protect surrounding skin.',
    rx: [rx('M22', 'Apply on wart', 'Topical', 'Once at night', '4 weeks', 1)],
    steps: [
      { o: 0, kind: 'NEW', proc: 'TR09' },
      { o: 14, kind: 'PROC', proc: 'TR09', trend: ['IMPROVING', 'SAME'] },
      { o: 28, kind: 'FU', trend: ['IMPROVING'] },
    ],
  },
  BENIGN_LESION: {
    count: 2, category: 'EXEMPT_TEST', doctor: 'D4', gender: null, age: [25, 60],
    variants: [
      { complaint: 'Swelling on upper back for 1 year', exam: '2 x 2 cm firm, mobile, non-tender subcutaneous swelling with central punctum on upper back.', dx: 'Epidermoid cyst — upper back', proc: 'TR12', plan: 'Elective excision with primary closure under local anaesthesia; histopathology.' },
      { complaint: 'Mole on forearm changing colour', exam: '7 mm asymmetric brown-black macule on forearm with irregular border; dermoscopy: atypical network, no blue-white veil.', dx: 'Atypical melanocytic naevus — provisional; rule out melanoma (biopsy)', proc: 'TR11', plan: 'Punch/excision biopsy for histopathology; urgent review of report.' },
    ],
    history: () => 'No bleeding; no prior surgery at site. Not on anticoagulants. No known drug allergy.',
    advice: 'Keep dressing dry for 48 hours. Suture removal in 10 days. Histopathology report review as scheduled.',
    rx: [rx('M24', '500 mg', 'Oral', 'SOS for pain (max 3/day)', '3 days', 6), rx('M23', 'Thin layer', 'Topical', 'Twice daily', '7 days', 1)],
    steps: [{ o: 0, kind: 'NEW' }, { o: 7, kind: 'PROC', procFromVariant: true, consumables: [['M27', 1], ['M30', 1]] }, { o: 17, kind: 'FU', proc: 'TR18', trend: ['IMPROVING'] }],
  },
  WOUND: {
    count: 2, category: 'EXEMPT_TEST', doctor: 'D4', gender: null, age: [20, 60],
    variants: [
      { complaint: 'Injury on forearm with discharge', exam: '6 cm sutured laceration on left forearm (sutured elsewhere 5 days ago) with surrounding erythema and seropurulent discharge; no exposed tendon; distal neurovascular intact.', dx: 'Infected traumatic laceration — left forearm' },
      { complaint: 'Road accident wound on leg not healing', exam: '8 x 5 cm abrasion/raw area over right shin with slough at base, healthy margins; no bone exposed; pulses palpable.', dx: 'Post-traumatic raw area right leg with slough' },
    ],
    history: () => `Injury ${int(5, 12)} days ago. ${pick(['Non-diabetic.', 'Known type 2 diabetic on metformin; RBS [placeholder].'])} Tetanus status: ${pick(['TT taken at injury', 'unknown — TT advised'])}.`,
    plan: 'Wound debridement and dressing; oral amoxicillin-clavulanate 5 days; alternate-day dressings (10-session dressing package); review for secondary closure/STSG if granulating.',
    advice: 'Keep dressing dry and clean. Come for dressing every alternate day. Return immediately if fever, increasing pain or foul smell.',
    rx: [rx('M25', '625 mg', 'Oral', '1-0-1 after food', '5 days', 10), rx('M24', '500 mg', 'Oral', 'SOS for pain', '5 days', 10)],
    package: 'PK4',
    steps: [
      { o: 0, kind: 'NEW', proc: 'TR13', buyPackage: true, redeem: true, consumables: [['M29', 2], ['M30', 1], ['M28', 1]] },
      { o: 2, kind: 'DRESS', proc: 'TR13', redeem: true, trend: ['IMPROVING'], consumables: [['M29', 2], ['M30', 1]] },
      { o: 4, kind: 'DRESS', proc: 'TR13', redeem: true, trend: ['IMPROVING'], consumables: [['M29', 2], ['M30', 1]] },
      { o: 7, kind: 'DRESS', proc: 'TR13', redeem: true, trend: ['IMPROVING', 'SAME'], consumables: [['M29', 2], ['M30', 1]] },
      { o: 9, kind: 'DRESS', proc: 'TR13', redeem: true, trend: ['IMPROVING'], consumables: [['M29', 1], ['M30', 1]] },
    ],
  },
  RECON_IPD: {
    count: 4, category: 'EXEMPT_TEST', doctor: 'D4', gender: null, age: [18, 58], ipd: true,
    variants: [
      { key: 'STSG_BURN', complaint: 'Tight scar on neck after old burn, cannot lift chin fully', exam: 'Post-burn hypertrophic contracture band anterior neck limiting extension (~30°); skin elsewhere healthy; donor site thigh available.', dx: 'Post-burn contracture — anterior neck', proc: 'TR15', los: 3, docState: 'COMPLETE', anaesthesia: 'General anaesthesia [TEST placeholder record]' },
      { key: 'STSG_TRAUMA', complaint: 'Large raw wound on leg after accident', exam: '12 x 8 cm granulating raw area over left leg, healthy granulation, no slough; pulses palpable.', dx: 'Traumatic soft-tissue loss — left leg (granulating)', proc: 'TR15', los: 5, docState: 'COMPLETE', anaesthesia: 'Spinal anaesthesia [TEST placeholder record]' },
      { key: 'SCAR_REVISION', complaint: 'Ugly scar on face after accident, wants correction', exam: '5 cm widened, depressed scar on left cheek crossing relaxed skin tension lines; mature (>12 months).', dx: 'Widened post-traumatic facial scar — left cheek', proc: 'TR16', los: 2, docState: 'PENDING_DOCUMENTATION', anaesthesia: 'MISSING — anaesthesia record not uploaded (test gap)' },
      { key: 'FLAP_BLOCKED', complaint: 'Growth on scalp increasing in size', exam: '3.5 cm ulcerated nodular lesion on scalp vertex; biopsy elsewhere [placeholder] reported benign adnexal tumour.', dx: 'Adnexal tumour scalp — excision with local flap planned', proc: 'TR17', los: 0, docState: 'BLOCKED_NO_CONSENT', anaesthesia: 'Not started — consent not obtained' },
    ],
    history: () => `No bleeding disorder. ${pick(['No comorbidities.', 'Hypertensive, controlled on amlodipine.'])} No known drug allergy. Fasting instructions explained.`,
    plan: 'Elective surgery under anaesthesia; pre-op work-up (CBC, coagulation, RBS, ECG [placeholders]) and pre-anaesthetic check; admission on surgery day. Written consent to be taken before admission.',
    advice: 'Keep graft/flap site immobilised and dry. Do not remove the dressing. Elevate limb if applicable. Report fever or foul smell.',
    rx: [], // pre-op OPD visit: no medicines; inpatient drugs are ordered on admission
    steps: [{ o: 0, kind: 'NEW' }, { o: 5, kind: 'IPD' }, { o: 19, kind: 'FU', trend: ['IMPROVING'] }],
  },
};

// ───────────────────────────── synthetic names ─────────────────────────────
const FIRST_M = ['Aarav', 'Vihaan', 'Reyansh', 'Kabir', 'Ishaan', 'Arnav', 'Dhruv', 'Yash', 'Pranav', 'Siddharth', 'Kunal', 'Rahul', 'Manish', 'Tejas', 'Omkar', 'Harsh', 'Nikhil', 'Sameer', 'Varun', 'Ritesh'];
const FIRST_F = ['Ananya', 'Diya', 'Ira', 'Myra', 'Saanvi', 'Kiara', 'Aditi', 'Neha', 'Pooja', 'Sneha', 'Ritika', 'Shruti', 'Tanvi', 'Mrunal', 'Gauri', 'Prachi', 'Radhika', 'Swati', 'Komal', 'Nidhi'];
const LAST = ['Sharma', 'Patil', 'Kulkarni', 'Joshi', 'Deshpande', 'Gupta', 'Iyer', 'Menon', 'Reddy', 'Naik', 'Pawar', 'Chavan', 'Bhosale', 'Shinde', 'Gokhale', 'Bapat', 'Saxena', 'Verma', 'Mehta', 'Shah', 'Kapoor', 'Fernandes', 'Thomas', 'Khan', 'Sheikh'];
const REFERRAL = [['Walk-in', 3], ['Google search', 3], ['Instagram', 2], ['Friend / family', 4], ['Doctor referral', 2], ['Corporate camp', 1], ['Existing patient referral', 2]];
const AREAS = ['Kothrud', 'Baner', 'Aundh', 'Hadapsar', 'Wakad', 'Viman Nagar', 'Karve Nagar', 'Shivajinagar', 'Pimple Saudagar', 'Kharadi'];
const ALLERGIES = [['NKDA', 10], ['Sulfa drugs — rash', 1], ['Penicillin — urticaria', 1], ['Adhesive tape — contact dermatitis', 1]];
const HISTORY = [['No significant past history', 8], ['Hypothyroidism on levothyroxine', 1], ['Type 2 diabetes on metformin', 1], ['Asthma (childhood)', 1], ['Hypertension on amlodipine', 1], ['PCOS', 1]];

// ───────────────────────────── build patients ─────────────────────────────
const templateKeys = Object.keys(T);
const slots = [];
for (const k of templateKeys) for (let i = 0; i < T[k].count; i++) slots.push(k);
if (slots.length !== 50) throw new Error(`Template counts must total 50, got ${slots.length}`);
const order = shuffle(slots);

const usedNames = new Set();
const patients = order.map((tkey, idx) => {
  const t = T[tkey];
  const n = idx + 1;
  const gender = t.gender ?? (chance(0.5) ? 'Female' : 'Male');
  let age = int(t.age[0], t.age[1]);
  if (t.childBias && n % 3 !== 0) age = int(6, 12);
  let name;
  do { name = `${pick(gender === 'Female' ? FIRST_F : FIRST_M)} ${pick(LAST)}`; } while (usedNames.has(name));
  usedNames.add(name);
  const isChild = age < 18;
  const dobYear = 2026 - age;
  const dob = `${dobYear}-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`;
  return {
    patient_id: `QA-P${pad(n)}`,
    mrn_expected: '(assigned by app: UHID-YYYY-NNNN)',
    full_name: `${name} (Test)`,
    gender,
    dob,
    age_at_window: age,
    registration_date: '', // filled after journeys: first visit, or history date for returning patients
    first_visit_or_returning: 'FIRST VISIT (registered in window)',
    patient_status: '',
    phone: `90000${pad(10000 + n, 5)}`,
    email_synthetic: `qa.patient${pad(n)}@aurora-qa.test`,
    address: `[TEST DATA] Flat ${int(1, 30)}, Test Residency, ${pick(AREAS)}, Pune 4110${pad(int(1, 60), 2)}${n === 17 ? ' (out-of-state test: Bengaluru, Karnataka 560001)' : ''}`,
    state: n === 17 ? 'Karnataka (29)' : 'Maharashtra (27)',
    referral_source: weighted(REFERRAL),
    referring_doctor: '',
    allergies: weighted(ALLERGIES),
    medical_history: isChild ? 'Immunisation up to date (as per guardian)' : weighted(HISTORY),
    emergency_contact: `${isChild ? 'Parent' : pick(['Spouse', 'Sibling', 'Parent'])}: ${pick(LAST)} Family (Test) 90009${pad(10000 + n, 5)}`,
    guardian_for_minor: isChild ? `Parent/guardian (Test) — consent by guardian` : '',
    consent_privacy_pref: pick(['SMS reminders: YES; photos for records only', 'SMS reminders: NO; photos for records only', 'SMS reminders: YES; photos for records + anonymised teaching (TEST simulated preference)']),
    govt_id_placeholder: 'NOT COLLECTED (test placeholder — no Aadhaar/PAN)',
    tax_test_category: t.category,
    pathway: tkey,
    primary_doctor: t.doctor,
    variant_index: '',
    test_data: 'YES',
  };
});
patients.forEach((p) => {
  if (p.referral_source === 'Doctor referral') p.referring_doctor = 'Dr. External Referrer (Test)';
});

// Returning patients: seen at the clinic before the window. Their history is imported as
// day-book visits dated May–August 2026, so the app flags them as regulars on check-in.
const RETURNING_PATHWAYS = ['PSORIASIS', 'PSORIASIS', 'ACNE_SCARS', 'ACNE_SCARS', 'AGA_PRP', 'TINEA', 'WARTS', 'MELASMA'];
const HISTORY_DX = {
  PSORIASIS: ['Chronic plaque psoriasis — flare', 'Topical clobetasol + emollient; review SOS'],
  ACNE_SCARS: ['Acne vulgaris — Grade III (treated)', 'Isotretinoin course completed; scars to be addressed after 6 months'],
  AGA_PRP: ['Hair fall — diffuse; androgenetic alopecia suspected', 'Minoxidil started; patient deferred PRP'],
  TINEA: ['Tinea cruris', 'Topical antifungal 4 weeks; recurrence counselling'],
  WARTS: ['Common wart — single', 'Wart paint; did not return'],
  MELASMA: ['Melasma — epidermal', 'Sunscreen + topical; lost to follow-up'],
};
const historicalVisits = [];
const usedReturning = new Set();
for (const key of RETURNING_PATHWAYS) {
  const p = patients.find((x) => x.pathway === key && !usedReturning.has(x.patient_id));
  if (!p) continue;
  usedReturning.add(p.patient_id);
  const hdate = `2026-${pad(int(5, 8), 2)}-${pad(int(1, 27), 2)}`;
  const histDoc = nextDoctorDay(p.primary_doctor, dow(hdate) === 0 ? addDays(hdate, 1) : hdate);
  const [dx, plan] = HISTORY_DX[key];
  historicalVisits.push({
    hv_ref: `HV-${pad(historicalVisits.length + 1, 2)}`, patient_id: p.patient_id, date: histDoc, doctor: p.primary_doctor,
    visit_type: 'OPD', status: 'New', treatment: 'Consultation', diagnosis: dx, remarks: `[SIMULATED history] ${plan}`,
    cash_amount: 800, bank_amount: 0, test_data: 'YES',
  });
  p.registration_date = histDoc;
  p.first_visit_or_returning = 'RETURNING (history before window)';
}

// Variant assignment for templates with variants (deterministic, distinct).
for (const tkey of templateKeys) {
  const t = T[tkey];
  if (!t.variants) continue;
  patients.filter((p) => p.pathway === tkey).forEach((p, i) => { p.variant_index = i % t.variants.length; });
}

// ───────────────────────────── journeys → encounters ─────────────────────────────
const encounters = []; // queue entries (one per patient per day)
const appointments = [];
const futureAppointments = [];
const careOrders = [];
const procedures = [];
const admissions = [];
const progressNotes = [];
const medOrders = [];
const medAdmin = [];
const documents = [];
const packagePurchases = [];
const consumableUse = []; // stock adjustments for procedure consumables

let eSeq = 0, aSeq = 0, oSeq = 0, prSeq = 0, admSeq = 0, pnSeq = 0, moSeq = 0, maSeq = 0, docSeq = 0, ppSeq = 0, cuSeq = 0;

// Start days spread over the first three weeks (a few pathways start late in week 4).
const startPool = opDays.slice(0, 18);
const firstVisitTimes = {};

function slotTime(doc, date, used) {
  const s = SCHEDULES[doc];
  const n = (toMin(s.end) - toMin(s.start)) / s.slot;
  for (let tries = 0; tries < 50; tries++) {
    const k = int(0, n - 1);
    const t = toHHMM(toMin(s.start) + k * s.slot);
    const key = `${doc}|${date}|${t}`;
    if (!used.has(key)) { used.add(key); return t; }
  }
  throw new Error(`no free slot ${doc} ${date}`);
}
const usedSlots = new Set();

const consentFor = (proc, tkey, state) => {
  if (state === 'PENDING_CONSENT') return 'PENDING — not obtained (procedure must not proceed)';
  if (state === 'BLOCKED_NO_CONSENT') return 'NOT OBTAINED — admission/surgery must be blocked';
  return 'SIMULATED TEST CONSENT — placeholder document, NOT a real signature';
};

for (const p of patients) {
  const t = T[p.pathway];
  const variant = t.variants ? t.variants[p.variant_index] : null;
  let start = pick(t.steps.length >= 3 ? startPool.slice(0, 12) : startPool);
  if (p.pathway === 'WOUND' || p.pathway === 'RECON_IPD') start = pick(opDays.slice(0, 10));
  // The pending-documentation admission is a current inpatient on import day, so it is
  // admitted at the end of week 4 rather than lingering for weeks.
  if (variant?.key === 'SCAR_REVISION') start = opDays[18];
  // The expired-batch test needs this follow-up after CET-A1 expires on 2026-09-30.
  if (p.pathway === 'CONTACT_DERM') start = pick(opDays.slice(6, 12));
  const doc = t.doctor;
  let purchaseRef = null;
  let lastEncounter = null;

  t.steps.forEach((step, si) => {
    let date = nextDoctorDay(doc, addDays(start, step.o));
    // IPD admissions happen on OT days (Mon/Wed) — the app has no OT calendar, so they are
    // simply dated; the encounter that opens the admission is a ward check-in on that day.
    if (step.kind === 'IPD') date = addDays(start, step.o);
    if (dow(date) === 0) date = addDays(date, 1);

    const beyond = date > CONFIG.windowEnd;
    if (beyond) {
      // Not yet happened — becomes a booked future appointment.
      const fdate = nextDoctorDay(doc, date);
      futureAppointments.push({ patient: p, doc, date: fdate, step, si });
      return;
    }

    // ── IPD step: admission scenario ──
    if (step.kind === 'IPD') {
      if (variant.docState === 'BLOCKED_NO_CONSENT') {
        admissions.push({
          admission_ref: `ADM-QA-${pad(++admSeq, 2)}`, patient_id: p.patient_id, scenario: variant.key, doctor: doc,
          import_action: 'DO NOT ADMIT — QA must attempt admission and record whether the app blocks it',
          admission_date: date, planned_procedure: TR[variant.proc].name, indication: variant.dx,
          ward: 'QA Surgical Ward', bed: 'B4', status_expected: 'BLOCKED (consent not obtained)', los_days: 0,
          consent_status: consentFor(variant.proc, p.pathway, 'BLOCKED_NO_CONSENT'), preop_checklist: 'INCOMPLETE — consent, anaesthesia fitness pending',
          anaesthesia: variant.anaesthesia, discharge_date: '', discharge_summary: '', documentation_state: variant.docState,
          care_team: `${staffName('D4')}; ${staffName('S08')}; ${staffName('S11')}`, test_data: 'YES',
        });
        return;
      }
      const enc = newEncounter(p, doc, date, 'IPD_ADMISSION', si, step, { variant });
      const admRef = `ADM-QA-${pad(++admSeq, 2)}`;
      const dischargeDate = variant.docState === 'COMPLETE' ? addDays(date, variant.los) : '';
      const stillAdmitted = !dischargeDate || dischargeDate > CONFIG.windowEnd;
      const bed = { STSG_BURN: 'B1', STSG_TRAUMA: 'B2', SCAR_REVISION: 'B3' }[variant.key];
      admissions.push({
        admission_ref: admRef, patient_id: p.patient_id, scenario: variant.key, doctor: doc, encounter_id: enc.encounter_id,
        import_action: 'Admit via POST /admissions (queueId of encounter) on admission_date',
        admission_date: date, planned_procedure: TR[variant.proc].name, indication: variant.dx,
        ward: 'QA Surgical Ward', bed, status_expected: stillAdmitted ? 'ADMITTED' : 'DISCHARGED', los_days: variant.los,
        consent_status: variant.docState === 'PENDING_DOCUMENTATION' ? 'PENDING — consent placeholder not yet uploaded' : consentFor(variant.proc, p.pathway, 'OK'),
        preop_checklist: variant.docState === 'COMPLETE' ? 'COMPLETE (test): NBM 8h, site marked, CBC/coag/RBS [placeholders], PAC done' : 'INCOMPLETE — PAC/anaesthesia record missing',
        anaesthesia: variant.anaesthesia,
        discharge_date: stillAdmitted ? '' : dischargeDate,
        discharge_summary: stillAdmitted ? '' : `[SIMULATED] ${variant.dx}. Underwent ${TR[variant.proc].name} on ${date} under ${variant.anaesthesia.split(' [')[0].toLowerCase()}. Post-op uneventful; graft/flap take satisfactory at first dressing. Discharged stable on day ${variant.los}. Discharge medication: Amoxicillin-clavulanate 625 mg BD x 5 days, Paracetamol 500 mg TDS x 5 days. Follow-up: dressing review in 5 days, suture/staple removal day 10–12.`,
        documentation_state: variant.docState,
        care_team: `${staffName('D4')}; ${staffName('S08')}; ${staffName('S09')}; ${staffName('S11')}`, test_data: 'YES',
      });
      enc.admission_ref = admRef;
      // Procedure record
      procedures.push(procRow(p, enc, variant.proc, variant.docState === 'COMPLETE' ? 'COMPLETED' : 'AWAITING_STAFF_SIGN_OFF', {
        indication: variant.dx, contraindication: 'Fit for surgery per PAC [placeholder]; no anticoagulants',
        consent: variant.docState === 'COMPLETE' ? consentFor() : 'PENDING — not uploaded',
        checklist: variant.docState === 'COMPLETE' ? 'WHO surgical safety checklist: sign-in / time-out / sign-out — COMPLETE (simulated)' : 'Sign-out section INCOMPLETE — awaiting OT staff sign-off',
        notes: `${TR[variant.proc].name} performed by ${staffName('D4')}, assisted by ${staffName('S11')}. ${variant.anaesthesia}. Haemostasis achieved; tie-over/compression dressing applied.`,
        consumables: 'Lignocaine 2% x1, Paraffin gauze x4, Gauze packs x2, Povidone iodine x1',
        post: 'Limb/neck immobilisation, elevation, first dressing on POD 5.',
      }));
      // Consumables & pharmacy for IPD stay — billed on the patient bill (IPD includes meds).
      addOrder(enc, 'TREATMENT', { treatment: variant.proc, qty: 1, status: variant.docState === 'COMPLETE' ? 'DONE' : 'ORDERED', performer: 'D4' });
      addOrder(enc, 'TREATMENT', { treatment: 'TR19', qty: Math.max(1, variant.los), status: 'DONE', performer: 'S08', note: 'Bed charges (workaround: treatment master item)' });
      addOrder(enc, 'INJECTION', { med: 'M26', dosage: '1 g', route: 'IV', frequency: 'Once daily', qty: Math.max(1, variant.los), status: 'DONE', dispense: true, performer: 'S08' });
      addOrder(enc, 'MEDICINE', { med: 'M24', dosage: '500 mg', route: 'Oral', frequency: '1-1-1', qty: 9, status: 'DONE', dispense: true, performer: 'S08' });
      addOrder(enc, 'MEDICINE', { med: 'M29', dosage: '—', route: 'Topical', frequency: 'With dressing', qty: 4, status: 'DONE', dispense: true, performer: 'S11' });
      addOrder(enc, 'MEDICINE', { med: 'M27', dosage: '10 ml', route: 'Local infiltration', frequency: 'Once (OT)', qty: 1, status: 'DONE', dispense: true, performer: 'S11' });
      // Medication administration record + progress notes per day of stay
      const days = Math.max(1, variant.los || 2);
      const mo1 = { mo_ref: `MO-${pad(++moSeq)}`, admission_ref: admRef, patient_id: p.patient_id, medicine_id: 'M26', dosage: '1 g', route: 'IV', frequency: 'Once daily', start_date: date, end_date: addDays(date, days - 1), status_expected: stillAdmitted ? 'ACTIVE' : 'COMPLETED', doctor: 'D4', test_data: 'YES' };
      const mo2 = { mo_ref: `MO-${pad(++moSeq)}`, admission_ref: admRef, patient_id: p.patient_id, medicine_id: 'M24', dosage: '500 mg', route: 'Oral', frequency: '1-1-1', start_date: date, end_date: addDays(date, days - 1), status_expected: stillAdmitted ? 'ACTIVE' : 'COMPLETED', doctor: 'D4', test_data: 'YES' };
      medOrders.push(mo1, mo2);
      for (let dd = 0; dd < days; dd++) {
        const day = addDays(date, dd);
        if (day > CONFIG.windowEnd) break;
        const nurse = dd % 2 === 0 ? 'S08' : 'S09';
        medAdmin.push({ ma_ref: `MA-${pad(++maSeq)}`, mo_ref: mo1.mo_ref, administered_at: `${day} 09:00`, status: 'Given', by: nurse, notes: '[TEST] IV slow over 30 min, no reaction' });
        for (const [time, st] of [['08:00', 'Given'], ['14:00', dd === 1 ? 'Refused' : 'Given'], ['20:00', dd === 0 ? 'Missed' : 'Given']]) {
          medAdmin.push({ ma_ref: `MA-${pad(++maSeq)}`, mo_ref: mo2.mo_ref, administered_at: `${day} ${time}`, status: st, by: time === '20:00' ? 'S09' : 'S08', notes: st === 'Refused' ? '[TEST] Patient declined — no pain' : st === 'Missed' ? '[TEST] Patient in OT recovery' : '' });
        }
        progressNotes.push({ pn_ref: `PN-${pad(++pnSeq)}`, admission_ref: admRef, recorded_at: `${day} 08:30`, author: nurse, note_type: 'NURSE', status: 'STABLE', blood_pressure: `${int(110, 134)}/${int(70, 86)}`, pulse: int(68, 96), temperature: round2(36.5 + rnd() * 0.9), note: dd === 0 ? '[SIMULATED] Post-op: dressing intact, no soaking; drain nil. Pain 3/10.' : '[SIMULATED] Afebrile, dressing dry, tolerating diet, ambulating with support.' });
        progressNotes.push({ pn_ref: `PN-${pad(++pnSeq)}`, admission_ref: admRef, recorded_at: `${day} 11:00`, author: 'D4', note_type: 'DOCTOR', status: dd === 1 && variant.key === 'STSG_TRAUMA' ? 'NEEDS_ATTENTION' : 'STABLE', blood_pressure: '', pulse: '', temperature: '', note: dd === 1 && variant.key === 'STSG_TRAUMA' ? '[SIMULATED] Low-grade fever 38.0°C, soakage at graft edge — wound swab sent [placeholder]; continue IV antibiotic.' : '[SIMULATED] Stable. Graft/flap site inspected through window — no haematoma. Continue plan.' });
      }
      docRow(p, enc, admRef, 'OTHER', variant.docState === 'COMPLETE' ? 'Consent — SIMULATED TEST PLACEHOLDER (not a real signature)' : null);
      docRow(p, enc, admRef, 'SCAN_IMAGE', 'Pre-operative photograph — synthetic placeholder image');
      docRow(p, enc, admRef, 'LAB_REPORT', 'Pre-operative investigations (CBC, PT/INR, RBS, HIV/HBsAg, ECG) — SIMULATED placeholder, all within normal limits');
      if (variant.docState === 'COMPLETE') docRow(p, enc, admRef, 'OTHER', `Anaesthesia & operation record — SIMULATED placeholder (${variant.anaesthesia.split(' [')[0]})`);
      if (!stillAdmitted) docRow(p, enc, admRef, 'DISCHARGE_SUMMARY', 'Discharge summary — SIMULATED');
      lastEncounter = enc;
      return;
    }

    const enc = newEncounter(p, doc, date, step.kind, si, step, { variant });
    lastEncounter = enc;

    // Incomplete-procedure scenarios (fixed patients for reproducibility). Decided before
    // any package sale: a deferred procedure must not trigger a sale that day.
    const procId = step.procFromVariant ? variant.proc : step.proc;
    let state = 'COMPLETED';
    const nth = (k, i) => p === patients.filter((x) => x.pathway === k)[i];
    if (procId && p.pathway === 'MELASMA' && si === 1 && nth('MELASMA', 0)) state = 'PENDING_CONSENT';
    if (procId && p.pathway === 'ACNE_SCARS' && si === 1 && nth('ACNE_SCARS', 0)) state = 'POSTPONED';
    if (procId && p.pathway === 'ACNE_SCARS' && si === 1 && nth('ACNE_SCARS', 1)) state = 'AWAITING_STAFF_SIGN_OFF';
    if (procId && p.pathway === 'BENIGN_LESION' && si === 1 && p.variant_index === 1) state = 'MISSING_DOCUMENTATION';
    const deferred = state === 'POSTPONED' || state === 'PENDING_CONSENT';

    // Package purchase (sold at reception before the session)
    if (step.buyPackage && t.package && !deferred) {
      const pk = PKT[t.package];
      const discount = ppSeq === 1 ? 0.1 : ppSeq === 6 ? 0.05 : 0; // two discounted sales
      const amount = round2(pk.price * (1 - discount));
      purchaseRef = `PP-${pad(++ppSeq, 2)}`;
      packagePurchases.push({
        purchase_ref: purchaseRef, patient_id: p.patient_id, package_type_id: pk.package_type_id, purchase_date: date,
        list_price: pk.price, amount_paid: amount, discount_amount: round2(pk.price - amount),
        discount_reason: discount ? (discount === 0.1 ? '[TEST] Loyalty discount approved by Dr. Iyer' : '[TEST] Festival offer') : '',
        payment_method: weighted([['cash', 1], ['bank', 3]]), total_sittings: pk.total_sittings,
        sold_by: 'S02', encounter_id: enc.encounter_id, test_data: 'YES',
      });
      enc.package_purchase_ref = purchaseRef;
    }
    if (step.redeem && purchaseRef) enc.redeem_package_ref = purchaseRef;

    // Procedure for this encounter
    if (procId) {
      enc.treatment_id = procId;
      if (deferred) {
        // Doctor saw the patient but the procedure did not happen — no treatment billed.
        enc.treatment_id = '';
        enc.redeem_package_ref = '';
        enc.notes_extra = state === 'POSTPONED' ? 'Procedure POSTPONED — active acne flare / herpes labialis; re-book in 2 weeks.' : 'Procedure DEFERRED — consent not yet obtained; patient wants to discuss with family.';
      }
      const isLaserOrPeel = ['TR02', 'TR03', 'TR04', 'TR05', 'TR06', 'TR07'].includes(procId);
      procedures.push(procRow(p, enc, procId, state, {
        indication: enc.diagnosis,
        contraindication: isLaserOrPeel ? 'No isotretinoin in 6 months, no active infection/herpes, not pregnant (self-reported), no photosensitising drugs — reviewed (simulated)' : procId === 'TR01' ? 'Platelets normal [placeholder], no anticoagulants/NSAIDs, no active scalp infection — reviewed (simulated)' : 'No anticoagulants, no bleeding disorder, no LA allergy — reviewed (simulated)',
        consent: state === 'PENDING_CONSENT' ? 'PENDING — not obtained' : state === 'MISSING_DOCUMENTATION' ? 'SIMULATED TEST CONSENT recorded verbally — document NOT uploaded (gap)' : consentFor(),
        checklist: state === 'AWAITING_STAFF_SIGN_OFF' ? 'Post-procedure sign-off by technician PENDING' : state === 'COMPLETED' || state === 'MISSING_DOCUMENTATION' ? 'Pre-procedure checklist COMPLETE (simulated): ID check, site, consent, photos, patch test' : 'Not started',
        notes: state === 'COMPLETED' || state === 'AWAITING_STAFF_SIGN_OFF' || state === 'MISSING_DOCUMENTATION' ? procedureNote(procId) : '',
        consumables: (step.consumables || []).map(([m, q]) => `${MED[m].name} x${q}`).join('; '),
        post: postInstr(procId),
      }));
      if (state === 'COMPLETED' || state === 'AWAITING_STAFF_SIGN_OFF' || state === 'MISSING_DOCUMENTATION') {
        for (const [m, q] of step.consumables || []) {
          consumableUse.push({ cu_ref: `CU-${pad(++cuSeq)}`, encounter_id: enc.encounter_id, date, medicine_id: m, qty: q, reason: `[TEST] Consumed in ${TR[procId].name} — ${p.patient_id}` });
        }
        if (procId !== 'TR13' && procId !== 'TR18') docRow(p, enc, '', 'SCAN_IMAGE', 'Pre-procedure photograph — synthetic placeholder image (no real person)');
        if (state !== 'MISSING_DOCUMENTATION' && ['TR01', 'TR04', 'TR05', 'TR11', 'TR12', 'TR06', 'TR07', 'TR08'].includes(procId)) docRow(p, enc, '', 'OTHER', 'Consent — SIMULATED TEST PLACEHOLDER (not a real signature)');
      }
      if (procId === 'TR11' && state !== 'PENDING_CONSENT') docRow(p, enc, '', 'LAB_REPORT', 'Histopathology report — SIMULATED placeholder (benign compound naevus)');
    }

    // Prescriptions (care orders) — new visit gets the template prescription.
    const items = step.kind === 'NEW' ? t.rx : (step.extraRx || []);
    for (const it of items) {
      const m = MED[it.med];
      let status = 'DONE', dispense = true, scenario = '';
      if (m.stock_scenario === 'ZERO_STOCK') { status = 'ORDERED'; dispense = false; scenario = 'UNAVAILABLE_ZERO_STOCK'; }
      if (it.med === 'M19') { scenario = 'INSUFFICIENT_STOCK'; status = 'ORDERED'; dispense = false; }
      if (it.med === 'M13') scenario = 'LOW_STOCK (4 received, reorder point 10) — pharmacist should see low-stock alert';
      // Saved-but-not-dispensed: patient chose to buy elsewhere (tests Rx vs dispensing separation)
      if (dispense && chance(0.1)) { status = 'ORDERED'; dispense = false; scenario = 'SAVED_NOT_DISPENSED (patient will buy outside)'; }
      addOrder(enc, it.med.startsWith('M') && MED[it.med].dosage_form === 'Injection' ? 'INJECTION' : 'MEDICINE', { med: it.med, dosage: it.dosage, route: it.route, frequency: it.frequency, instructions: [it.duration, it.instructions].filter(Boolean).join(' — '), qty: it.qty, status, dispense, scenario, performer: 'S12' });
    }
    // Expired-batch scenario: week-4 urticaria add-on with Cetirizine (batch CET-A1 expired 2026-09-30).
    if (step.kind === 'FU' && p.pathway === 'CONTACT_DERM') {
      addOrder(enc, 'MEDICINE', { med: 'M14', dosage: '10 mg', route: 'Oral', frequency: '0-0-1', instructions: '10 days', qty: 10, status: 'DONE', dispense: true, scenario: 'EXPIRED_BATCH_PRESENT — must dispense from CET-A2 (valid), never CET-A1 (expired 2026-09-30)', performer: 'S12' });
    }
    // Clarification / substitution: doctor writes a non-stocked strength.
    if (step.kind === 'NEW' && p.pathway === 'MELASMA' && p === patients.filter((x) => x.pathway === 'MELASMA')[1]) {
      addOrder(enc, 'MEDICINE', { med: '', notStocked: true, description: 'Hydroquinone 4% Cream (not stocked — Test)', dosage: 'Pea size', route: 'Topical', frequency: 'Once at night', instructions: 'Requires clarification: stocked alternative is M09 triple combination; substitution needs doctor approval', qty: 1, status: 'ORDERED', dispense: false, scenario: 'CLARIFICATION_SUBSTITUTION_REQUIRED', performer: 'S12' });
    }
  });

}

function newEncounter(p, doc, date, kind, si, step, { variant }) {
  const t = T[p.pathway];
  const id = `E${pad(++eSeq, 4)}`;
  const prior = encounters.filter((e) => e.patient_id === p.patient_id);
  const isRegular = prior.length > 0 || usedReturning.has(p.patient_id);
  const time = slotTime(doc, date, usedSlots);
  const checkIn = Math.max(toMin(time) - int(5, 20), toMin('09:30'));
  const seenMin = Math.max(toMin(time), checkIn + int(5, 35));
  const reception = kind === 'IPD_ADMISSION' ? 'PLANNED_ADMISSION' : weighted([['BOOKED', 50], ['WALK_IN', isRegular ? 15 : 35], ['RESCHEDULED', 8]]);
  const complaint = variant?.complaint ?? t.complaint();
  // Reception records what the patient says or what was booked — never a diagnosis.
  const followUpComplaint = kind === 'DRESS' ? 'Came for dressing' : kind === 'PROC' ? 'Came for booked procedure session' : kind === 'FU' ? 'Follow-up visit as advised' : kind === 'IPD_ADMISSION' ? 'Admission for planned surgery' : complaint;
  const exam = variant?.exam ?? t.exam?.();
  const dx = variant?.dx ?? t.dx;
  const trend = step.trend ? pick(step.trend) : '';
  const fee = kind === 'NEW' ? CONFIG.consultFeeNew : kind === 'DRESS' || kind === 'IPD_ADMISSION' ? 0 : CONFIG.consultFeeFollowUp;
  const enc = {
    encounter_id: id, patient_id: p.patient_id, date, check_in_time: toHHMM(checkIn), appointment_time: reception === 'WALK_IN' ? '' : time,
    seen_time: toHHMM(seenMin), completed_time: toHHMM(seenMin + (step.proc || step.procFromVariant ? int(35, 75) : int(10, 25))),
    reception_mode: reception, department: doc === 'D4' ? 'DEP-PLAS' : 'DEP-DERM', doctor: doc, visit_kind: kind, is_regular: isRegular ? 'YES' : 'NO',
    reception_complaint: followUpComplaint, final_queue_status: 'COMPLETED', care_type: kind === 'IPD_ADMISSION' ? 'IPD' : 'OPD',
    chief_complaint: complaint,
    history: kind === 'NEW' ? t.history() : `Review: ${trend ? `condition ${trend.toLowerCase()}` : 'as planned'}; adherence ${pick(['good', 'good', 'partial'])}; no adverse effects reported.`,
    examination: kind === 'NEW' ? exam : kind === 'DRESS' ? `Wound ${pick(['granulating well', 'clean with minimal slough', 'healthy, margins contracting'])}; no cellulitis.` : `Findings ${trend === 'IMPROVING' ? 'improved compared with last visit' : trend === 'WORSENING' ? 'worse — new satellite lesions' : 'similar to last visit'}.`,
    diagnosis: kind === 'NEW' ? dx : `${dx.split(' — ')[0]} — follow-up`,
    diagnosis_status: /provisional|\?|rule out/i.test(dx) && kind === 'NEW' ? 'PROVISIONAL' : 'CONFIRMED',
    assessment: kind === 'NEW' ? 'See plan.' : trend === 'WORSENING' ? 'Inadequate response — check adherence and steroid misuse; consider extending therapy.' : 'Responding to treatment.',
    plan: kind === 'NEW' ? (variant?.plan ?? t.plan) : kind === 'DRESS' ? 'Continue alternate-day dressing.' : 'Continue current plan.',
    patient_notes: t.advice,
    staff_notes: (step.proc || (step.procFromVariant && variant?.proc)) ? `[TEST] Prepare procedure room for ${TR[step.proc || variant.proc].name}; pre-procedure photos; check consent placeholder.` : '',
    consultation_fee: fee, condition_trend: trend, treatment_id: '', next_appointment_date: '', follow_up_recommendation: '',
    authoring_clinician: doc, package_purchase_ref: '', redeem_package_ref: '', admission_ref: '', notes_extra: '', test_data: 'YES',
  };
  // Next visit = next step date (computed after) — filled in post-pass.
  encounters.push(enc);
  if (reception !== 'WALK_IN' && reception !== 'PLANNED_ADMISSION') {
    const a = { appointment_ref: `A${pad(++aSeq, 4)}`, patient_id: p.patient_id, doctor: doc, date, start_time: time, status: 'Completed', reason: followUpComplaint, encounter_id: id, rescheduled_from: '' };
    if (reception === 'RESCHEDULED') {
      // Originally booked 1–3 days earlier on another working day, then moved.
      let orig = addDays(date, -int(1, 3));
      if (!doctorWorks(doc, orig) || orig < CONFIG.windowStart) orig = date;
      const otime = slotTime(doc, orig, usedSlots);
      a.rescheduled_from = `${orig} ${otime}`;
    }
    appointments.push(a);
  }
  return enc;
}

function addOrder(enc, type, o) {
  const m = o.med ? MED[o.med] : null;
  const tr = o.treatment ? TR[o.treatment] : null;
  const unitPrice = m ? m.unit_price : tr ? tr.price : 0;
  careOrders.push({
    order_id: `O${pad(++oSeq, 4)}`, encounter_id: enc.encounter_id, patient_id: enc.patient_id, order_type: type,
    medicine_id: o.med || '', treatment_id: o.treatment || '', not_stocked: o.notStocked ? 'YES' : 'NO',
    description: o.description || (m ? m.name : tr ? tr.name : ''), dosage: o.dosage || '', route: o.route || '', frequency: o.frequency || '',
    instructions: o.instructions || o.note || '', quantity: o.qty, unit_price: unitPrice, total_price: round2(unitPrice * o.qty),
    final_status: o.status, dispensed: o.dispense ? 'YES' : 'NO', performed_by: o.status === 'DONE' ? o.performer : '',
    scenario: o.scenario || '', ordered_by: enc.doctor, test_data: 'YES',
  });
}

function procRow(p, enc, procId, state, f) {
  return {
    procedure_ref: `PR${pad(++prSeq)}`, encounter_id: enc.encounter_id, patient_id: p.patient_id, treatment_id: procId, procedure: TR[procId].name,
    state, recommended_by: enc.doctor, indication: f.indication, contraindication_review: f.contraindication,
    planned_date: enc.date, assigned_staff: enc.doctor === 'D4' ? 'S11' : enc.doctor === 'D2' ? 'S10' : 'S10',
    consent_status: f.consent, pre_procedure_media: 'Synthetic placeholder PNG (no real person). Video: UNSUPPORTED (app accepts images/PDF only)',
    checklist: f.checklist, procedure_notes: f.notes ? `[SIMULATED] ${f.notes}` : '', consumables_used: f.consumables || '',
    post_procedure_instructions: f.post, test_data: 'YES',
  };
}

function procedureNote(id) {
  return {
    TR01: 'PRP: 20 ml venous blood, double-spin; ~4 ml PRP injected intradermally across thinning areas (nappage). Tolerated well.',
    TR02: 'Glycolic acid 35% applied 3 min after degreasing; neutralised; mild erythema, no frosting.',
    TR03: 'Salicylic acid 30% peel, 2 coats, 4 min; mild frosting over T-zone; washed off; tolerated well.',
    TR04: 'Q-switched Nd:YAG 1064 nm, 6 mm spot, 2.0 J/cm², 2 passes; end-point mild erythema.',
    TR05: 'Fractional CO2, 15 mJ, density 10%, 2 passes after topical anaesthesia 45 min; pinpoint bleeding; cooling applied.',
    TR06: 'Dermapen 1.5 mm with hyaluronic serum, 4 passes; uniform pinpoint bleeding; sterile saline wipe.',
    TR07: 'Diode 810 nm, 12 J/cm², chin and upper lip; perifollicular oedema end-point; cooling gel.',
    TR08: 'RF ablation of 6 lesions under topical anaesthesia; superficial char wiped; mupirocin applied.',
    TR09: 'Liquid nitrogen spray, 2 freeze-thaw cycles of 10 s per wart with 1 mm halo.',
    TR11: '4 mm punch biopsy under LA (lignocaine 2%); specimen in formalin to histopathology [placeholder lab]; 1 suture.',
    TR12: 'Elliptical excision under LA; cyst removed intact; layered closure 4-0 nylon; specimen to histopathology [placeholder].',
    TR13: 'Wound cleaned with saline/povidone iodine; slough removed; paraffin gauze + gauze pads + bandage.',
    TR18: 'Sutures removed; wound healed by primary intention; steri-strips applied.',
  }[id] || 'Procedure performed as planned.';
}
function postInstr(id) {
  if (['TR02', 'TR03', 'TR04', 'TR05', 'TR06', 'TR07', 'TR08'].includes(id)) return 'Strict sunscreen, no actives/scrubs for 7–14 days, moisturise; report blistering.';
  if (id === 'TR01') return 'Do not wash hair for 24 h; no NSAIDs 3 days; mild tenderness expected.';
  if (id === 'TR09' || id === 'TR10') return 'Keep blister intact; dry dressing; review in 2 weeks.';
  if (['TR11', 'TR12', 'TR15', 'TR16', 'TR17'].includes(id)) return 'Keep dressing dry 48 h; suture removal day 10; histopathology review.';
  return 'Keep dressing dry and clean; next dressing as scheduled.';
}
function docRow(p, enc, admRef, category, title) {
  if (!title) return;
  documents.push({
    doc_ref: `DOC-${pad(++docSeq)}`, patient_id: p.patient_id, encounter_id: enc.encounter_id, admission_ref: admRef, category,
    title: `[TEST] ${title}`, file: category === 'SCAN_IMAGE' ? 'assets/placeholder-photo.png' : 'assets/placeholder-document.pdf',
    mime_type: category === 'SCAN_IMAGE' ? 'image/png' : 'application/pdf', uploaded_by: enc.doctor, test_data: 'YES',
  });
}

// Fill next-appointment dates from the following encounter or future appointment.
for (const p of patients) {
  const encs = encounters.filter((e) => e.patient_id === p.patient_id).sort((a, b) => a.date.localeCompare(b.date));
  const fut = futureAppointments.filter((f) => f.patient.patient_id === p.patient_id).sort((a, b) => a.date.localeCompare(b.date));
  encs.forEach((e, i) => {
    const next = encs[i + 1]?.date || fut[0]?.date || '';
    e.next_appointment_date = next;
    e.follow_up_recommendation = next ? `Review on ${next}` : 'Review as needed (SOS)';
  });
  if (!p.registration_date) p.registration_date = encs[0]?.date || '';
  const adm = admissions.find((a) => a.patient_id === p.patient_id);
  p.patient_status = adm?.status_expected === 'ADMITTED' ? 'INPATIENT'
    : adm?.status_expected?.startsWith('BLOCKED') ? 'SURGERY ON HOLD — consent pending'
    : fut.length ? 'ACTIVE — follow-up booked'
    : 'ACTIVE — review SOS';
}

// ───────────────────────────── live-day (import day) queue scenarios ─────────────────────────────
// Six future follow-ups are pulled forward to the import day so the live queue shows
// patients waiting, with the doctor, awaiting a service, and one who left.
const liveStatuses = ['WAITING', 'WAITING', 'WAITING', 'WITH_DOCTOR', 'AWAITING_SERVICE', 'CANCELLED'];
const liveCandidates = shuffle(futureAppointments).slice(0, 6);
liveCandidates.forEach((f, i) => {
  futureAppointments.splice(futureAppointments.indexOf(f), 1);
  const id = `E${pad(++eSeq, 4)}`;
  encounters.push({
    encounter_id: id, patient_id: f.patient.patient_id, date: CONFIG.liveDay, check_in_time: toHHMM(toMin('10:00') + i * 17), appointment_time: '',
    reception_mode: i % 2 ? 'WALK_IN' : 'BOOKED', department: f.doc === 'D4' ? 'DEP-PLAS' : 'DEP-DERM', doctor: f.doc, visit_kind: 'LIVE_' + liveStatuses[i],
    is_regular: 'YES', reception_complaint: liveStatuses[i] === 'CANCELLED' ? 'Follow-up — patient left before consultation (long wait)' : 'Follow-up visit as advised',
    final_queue_status: liveStatuses[i], care_type: liveStatuses[i] === 'AWAITING_SERVICE' ? 'OPD' : '', chief_complaint: '', history: '', examination: '',
    diagnosis: liveStatuses[i] === 'AWAITING_SERVICE' ? `${(T[f.patient.pathway].dx || '').split(' — ')[0]} — follow-up` : '', diagnosis_status: '',
    assessment: '', plan: liveStatuses[i] === 'AWAITING_SERVICE' ? 'Procedure today — awaiting service desk' : '', patient_notes: '', staff_notes: '',
    consultation_fee: liveStatuses[i] === 'AWAITING_SERVICE' ? CONFIG.consultFeeFollowUp : 0, condition_trend: '', treatment_id: '', next_appointment_date: '',
    follow_up_recommendation: '', authoring_clinician: f.doc, package_purchase_ref: '', redeem_package_ref: '', admission_ref: '', notes_extra: 'Live-queue scenario on import day', test_data: 'YES',
  });
});

// Future appointments (booked follow-ups after the window, all Scheduled).
for (const f of futureAppointments) {
  appointments.push({ appointment_ref: `A${pad(++aSeq, 4)}`, patient_id: f.patient.patient_id, doctor: f.doc, date: f.date, start_time: slotTime(f.doc, f.date, usedSlots), status: 'Scheduled', reason: `Booked follow-up: ${f.step.kind}${f.step.proc ? ` (${TR[f.step.proc].name})` : ''}`, encounter_id: '', rescheduled_from: '' });
}

// Cancelled and no-show appointments (no encounter that slot).
const cnPatients = shuffle(patients).slice(0, 11);
cnPatients.forEach((p, i) => {
  const doc = p.primary_doctor;
  const date = nextDoctorDay(doc, pick(opDays.slice(2, 22)));
  const status = i < 6 ? 'Cancelled' : 'No-Show';
  appointments.push({ appointment_ref: `A${pad(++aSeq, 4)}`, patient_id: p.patient_id, doctor: doc, date, start_time: slotTime(doc, date, usedSlots), status, reason: status === 'Cancelled' ? pick(['[TEST] Patient travelling', '[TEST] Clash with exam', '[TEST] Feeling unwell — will rebook']) : '[TEST] Did not attend, no call', encounter_id: '', rescheduled_from: '' });
});
// Conflict/booking-rule probes (expected to be REJECTED by the app or flagged).
const probes = [
  { probe: 'DOUBLE_BOOK_SAME_SLOT', patient_id: patients[1].patient_id, doctor: 'D1', date: appointments[0].date, start_time: appointments.find((a) => a.doctor === 'D1')?.start_time, expected: 'REJECT 409 — slot already taken' },
  { probe: 'OUTSIDE_SESSION', patient_id: patients[2].patient_id, doctor: 'D4', date: '2026-10-13', start_time: '16:00', expected: 'REJECT 400 — not a valid open slot' },
  { probe: 'DOCTOR_NO_SESSION_THAT_DAY', patient_id: patients[3].patient_id, doctor: 'D4', date: '2026-10-14', start_time: '10:00', expected: 'REJECT 400 — no session on Wednesday' },
  { probe: 'DOCTOR_ON_LEAVE', patient_id: patients[4].patient_id, doctor: 'D3', date: '2026-09-30', start_time: '15:00', expected: 'SHOULD REJECT — doctor on leave (app has no leave model: expected to ACCEPT → gap)' },
  { probe: 'SUNDAY_CLOSED', patient_id: patients[5].patient_id, doctor: 'D1', date: '2026-10-18', start_time: '10:00', expected: 'REJECT 400 — no Sunday session' },
  { probe: 'SCHEDULE_CHANGE_WITH_BOOKINGS', patient_id: '', doctor: 'D3', date: '(Saturdays)', start_time: '15:00→16:00', expected: 'Change Dr. Mirza Saturday session to 16:00–19:00 while 15:xx bookings exist: app should warn about affected appointments; revert afterwards (verify only — not part of import)' },
  { probe: 'ROOM_DOUBLE_BOOKING', patient_id: '', doctor: 'D2', date: '(any)', start_time: '(same time, laser room)', expected: 'Two laser procedures in one room at the same time should be rejected — app has no room booking (UNSUPPORTED)' },
];
const d1First = appointments.find((a) => a.doctor === 'D1' && a.status !== 'Cancelled' && a.status !== 'No-Show');
probes[0].date = d1First.date; probes[0].start_time = d1First.start_time;

// Duplicate-registration probes (not part of the 50).
const dupProbes = [
  { probe: 'EXACT_DUPLICATE', name: patients[6].full_name, phone: patients[6].phone, dob: patients[6].dob, gender: patients[6].gender, expected: 'SHOULD WARN/BLOCK — same name+phone+DOB as ' + patients[6].patient_id },
  { probe: 'SAME_PHONE_SPELLING_VARIANT', name: patients[7].full_name.replace(/a/, 'aa'), phone: patients[7].phone, dob: patients[7].dob, gender: patients[7].gender, expected: 'SHOULD WARN — possible duplicate of ' + patients[7].patient_id },
  { probe: 'FAMILY_MEMBER_SHARED_PHONE', name: `Riya ${patients[8].full_name.split(' ')[1]} (Test)`, phone: patients[8].phone, dob: '2019-05-10', gender: 'Female', expected: 'ALLOW with warning — child shares parent phone (' + patients[8].patient_id + ')' },
];

// ───────────────────────────── billing ─────────────────────────────
// Expected values follow the app's formulas (queue.service getBill / invoices.service).
// Where the app formula differs from the correct business rule, both are recorded.
const encounterBills = [];
const gstInvoices = [];
const payments = [];
let pbSeq = 0, phSeq = 0, invSeq = 0, paySeq = 0;

const MODES = [['CASH', 35], ['UPI', 40], ['CARD', 15], ['ONLINE', 10]];
const paymentDetails = (mode, total, n) => {
  if (mode === 'CASH') return { amountReceived: Math.ceil(total / 100) * 100 + (n % 3 === 0 ? 500 : 0) };
  if (mode === 'UPI') return { transactionId: `TESTUPI${pad(n, 8)}`, upiId: `qa.payer${pad(n)}@testupi`, upiApp: pick(['Google Pay', 'PhonePe', 'Paytm', 'BHIM']), accountHolder: '' };
  if (mode === 'CARD') return { cardType: pick(['Debit', 'Credit']), cardNetwork: pick(['Visa', 'Mastercard', 'RuPay']), cardLast4: pad(int(0, 9999), 4), bankName: '[TEST] Demo Bank', transactionId: `TESTRRN${pad(n, 6)}`, approvalCode: `A${pad(int(0, 99999), 5)}` };
  return { transferType: pick(['NEFT', 'IMPS', 'RTGS']), transactionId: `TESTUTR${pad(n, 10)}`, accountHolder: '[TEST] Payer Name', accountNumber: `00000000${pad(n, 4)}`, bankName: '[TEST] Demo Bank', ifsc: 'TEST0000001' };
};

function lineTax(amount, taxable, rate) {
  if (!taxable) return { cgst: 0, sgst: 0 };
  return { cgst: amount * (rate / 2) / 100, sgst: amount * (rate / 2) / 100 };
}

for (const e of encounters) {
  if (e.date === CONFIG.liveDay && e.final_queue_status !== 'AWAITING_SERVICE') continue;
  const orders = careOrders.filter((o) => o.encounter_id === e.encounter_id && o.final_status !== 'CANCELLED');
  const lines = [];
  if (e.consultation_fee > 0) lines.push({ kind: 'CONSULTATION', desc: `Consultation — ${staffName(e.doctor)}`, amount: e.consultation_fee, taxable: false, rate: 0 });
  let appTreatmentAmount = 0;
  if (e.treatment_id) {
    const tr = TR[e.treatment_id];
    const covered = !!e.redeem_package_ref;
    appTreatmentAmount = tr.price; // app charges visit.treatmentPrice even when a package covers it
    lines.push({ kind: 'TREATMENT', desc: tr.name + (covered ? ' (package session)' : ''), amount: covered ? 0 : tr.price, taxable: tr.is_gst_taxable === 'YES', rate: tr.tax_rate, appAmount: tr.price });
  }
  for (const o of orders) {
    if (e.care_type === 'OPD' && ['MEDICINE', 'INJECTION'].includes(o.order_type)) continue;
    const m = o.medicine_id ? MED[o.medicine_id] : null; const tr = o.treatment_id ? TR[o.treatment_id] : null;
    lines.push({ kind: o.order_type, desc: o.description, amount: o.total_price, taxable: m ? m.is_gst_taxable === 'YES' : tr ? tr.is_gst_taxable === 'YES' : false, rate: m ? m.tax_rate : tr ? tr.tax_rate : 0 });
  }
  const totals = (useApp) => {
    let sub = 0, taxable = 0, cg = 0, sg = 0;
    for (const l of lines) {
      const amt = useApp && l.appAmount !== undefined ? l.appAmount : l.amount;
      sub += amt; if (l.taxable) { taxable += amt; const t = lineTax(amt, true, l.rate); cg += t.cgst; sg += t.sgst; }
    }
    const cgst = round2(cg), sgst = round2(sg), subT = round2(sub);
    return { sub: subT, taxable: round2(taxable), exempt: round2(subT - round2(taxable)), cgst, sgst, total: round2(subT + cgst + sgst) };
  };
  if (!lines.length) continue;
  const correct = totals(false), app = totals(true);
  const n = ++pbSeq;
  const status = correct.total === 0 ? 'NO_CHARGE' : e.final_queue_status === 'AWAITING_SERVICE' ? 'UNPAID' : weighted([['PAID', 80], ['UNPAID', 12], ['PARTIAL', 8]]);
  const mode = status === 'UNPAID' || status === 'NO_CHARGE' ? '' : weighted(MODES);
  const paidAmount = status === 'PAID' ? correct.total : status === 'PARTIAL' ? round2(Math.floor(correct.total * 0.5 / 100) * 100) : 0;
  const bill = {
    bill_ref: `PB-REF-${pad(n, 4)}`, kind: 'PATIENT', encounter_id: e.encounter_id, patient_id: e.patient_id, date: e.date,
    lines: lines.map((l) => `${l.kind}:${l.desc}=${l.amount}${l.taxable ? `@${l.rate}%` : '(exempt)'}`).join(' | '),
    line_count: lines.length, sub_total: correct.sub, taxable_value: correct.taxable, exempt_value: correct.exempt, cgst: correct.cgst, sgst: correct.sgst, total: correct.total,
    app_formula_total: app.total, app_differs: app.total !== correct.total ? 'YES — package session re-charged by app (defect test)' : 'NO',
    mixed_invoice: lines.some((l) => l.taxable) && lines.some((l) => !l.taxable) ? 'YES' : 'NO',
    payment_status: status,
    app_payment_status: status === 'PARTIAL' ? 'UNPAID (partial payments unsupported)' : status === 'NO_CHARGE' ? `UNPAID — app shows ₹${app.total} due (package session re-charged)` : status,
    payment_mode: mode, amount_paid: paidAmount, outstanding: round2(correct.total - paidAmount), test_data: 'YES',
  };
  encounterBills.push(bill);
  if ((status === 'PAID' || status === 'PARTIAL') && paidAmount > 0) {
    const ps = ++paySeq;
    payments.push({ payment_ref: `PAY-${pad(ps, 4)}`, target_type: 'PATIENT_BILL', target_ref: bill.bill_ref, patient_id: e.patient_id, date: e.date, mode, amount: paidAmount, kind: status === 'PARTIAL' ? 'PARTIAL (UNSUPPORTED in app — record as note only)' : 'FULL', details_json: JSON.stringify(paymentDetails(mode, paidAmount, ps)), received_by: e.doctor === 'D4' ? 'S03' : 'S02', test_data: 'YES' });
  }

  // GST invoice register entry (Collect Payment): one invoice per visit, single line.
  if ((status === 'PAID' || status === 'PARTIAL' || status === 'NO_CHARGE') && e.care_type) {
    const tr = e.treatment_id ? TR[e.treatment_id] : null;
    const covered = !!e.redeem_package_ref;
    // IPD: the whole consolidated bill goes on one exempt invoice (visit treatment = "Consultation").
    const taxableValue = e.care_type === 'IPD' ? correct.sub : tr ? (covered ? 0 : tr.price) : e.consultation_fee;
    const isTaxable = tr ? tr.is_gst_taxable === 'YES' : false;
    const rate = tr ? tr.tax_rate : 0;
    if (taxableValue > 0 || covered) {
      const cg = isTaxable && !covered ? round2(taxableValue * rate / 2 / 100) : 0;
      gstInvoices.push({
        invoice_ref: `GI-${pad(++invSeq, 4)}`, source: 'COLLECT_PAYMENT', encounter_id: e.encounter_id, patient_id: e.patient_id, date: e.date,
        item: tr ? tr.name + (covered ? ' (Package Session Redemption)' : '') : e.care_type === 'IPD' ? 'IPD consolidated bill' : 'Consultation',
        sac_hsn: tr ? tr.sac_code : e.care_type === 'IPD' ? '999311' : '999312',
        is_gst_taxable: isTaxable && !covered ? 'YES' : 'NO', tax_rate: isTaxable && !covered ? rate : 0,
        taxable_value: taxableValue, cgst: cg, sgst: cg, total: round2(taxableValue + 2 * cg), payment_mode: mode,
        note: e.care_type === 'IPD' ? 'IPD bill posted as one exempt line — taxable medicine lines inside lose their GST (single-line invoice gap)' : tr && e.consultation_fee > 0 ? `Consultation fee ₹${e.consultation_fee} NOT on this invoice (app invoices are single-line) — register gap` : '',
        supply_type: patients.find((x) => x.patient_id === e.patient_id).state.startsWith('Karnataka') ? 'B2C — patient from another state (POS review needed; app supports CGST/SGST only)' : 'B2C intra-state',
        document_type: 'Tax invoice / Bill of supply (exempt) — app does not distinguish', test_data: 'YES',
      });
    }
  }

  // Pharmacy bill for OPD medicines that were dispensed.
  if (e.care_type === 'OPD') {
    const meds = orders.filter((o) => ['MEDICINE', 'INJECTION'].includes(o.order_type) && o.medicine_id);
    if (meds.length) {
      // Correct rule: charge only what was handed over. The app's pharmacy bill lists every
      // non-cancelled order, dispensed or not — both totals are kept.
      const sumOf = (rows) => {
        let sub = 0, cg = 0, tx = 0;
        for (const o of rows) { const m = MED[o.medicine_id]; sub += o.total_price; if (m.is_gst_taxable === 'YES') { tx += o.total_price; cg += o.total_price * (m.tax_rate / 2) / 100; } }
        const cgst = round2(cg);
        return { sub: round2(sub), tx: round2(tx), cgst, total: round2(round2(sub) + 2 * cgst) };
      };
      const disp = meds.filter((o) => o.dispensed === 'YES');
      const c = sumOf(disp), a = sumOf(meds);
      const pstatus = !disp.length ? 'NOTHING_DISPENSED' : weighted([['PAID', 85], ['UNPAID', 15]]);
      const pmode = pstatus === 'PAID' ? weighted(MODES) : '';
      const pref = `PH-REF-${pad(++phSeq, 4)}`;
      const total = c.total;
      encounterBills.push({
        bill_ref: pref, kind: 'PHARMACY', encounter_id: e.encounter_id, patient_id: e.patient_id, date: e.date,
        lines: meds.map((o) => `${o.order_type}:${o.description}=${o.total_price}@${MED[o.medicine_id].tax_rate}%${o.dispensed === 'NO' ? ` [NOT DISPENSED: ${o.scenario || 'pending'}]` : ''}`).join(' | '),
        line_count: meds.length, sub_total: c.sub, taxable_value: c.tx, exempt_value: round2(c.sub - c.tx), cgst: c.cgst, sgst: c.cgst, total,
        app_formula_total: a.total, app_differs: a.total !== c.total ? 'YES — app bills ordered-but-not-dispensed items' : 'NO',
        mixed_invoice: 'NO', payment_status: pstatus, app_payment_status: pstatus, payment_mode: pmode, amount_paid: pstatus === 'PAID' ? total : 0, outstanding: pstatus === 'PAID' ? 0 : total, test_data: 'YES',
      });
      if (pstatus === 'PAID') {
        const ps = ++paySeq;
        payments.push({ payment_ref: `PAY-${pad(ps, 4)}`, target_type: 'PHARMACY_BILL', target_ref: pref, patient_id: e.patient_id, date: e.date, mode: pmode, amount: total, kind: 'FULL', details_json: JSON.stringify(paymentDetails(pmode, total, ps)), received_by: 'S12', test_data: 'YES' });
      }
    }
  }
}

// Package sale invoices (auto-created by the app on purchase: taxable value = amount paid, +18% if taxable).
for (const pp of packagePurchases) {
  const pk = PKT[pp.package_type_id];
  const taxable = pk.is_gst_taxable === 'YES';
  const cg = taxable ? round2(pp.amount_paid * 9 / 100) : 0;
  gstInvoices.push({
    invoice_ref: `GI-${pad(++invSeq, 4)}`, source: 'PACKAGE_SALE', encounter_id: pp.encounter_id, patient_id: pp.patient_id, date: pp.purchase_date,
    item: pk.name, sac_hsn: TR[pk.treatment_id].sac_code, is_gst_taxable: taxable ? 'YES' : 'NO', tax_rate: taxable ? 18 : 0, taxable_value: pp.amount_paid, cgst: cg, sgst: cg, total: round2(pp.amount_paid + 2 * cg),
    payment_mode: pp.payment_method === 'cash' ? 'CASH' : 'BANK (package sale cannot record mode/details)', note: pp.discount_amount > 0 ? `Discount ₹${pp.discount_amount} on list ₹${pp.list_price}` : '',
    supply_type: 'B2C intra-state', document_type: 'Tax invoice', test_data: 'YES',
  });
  payments.push({ payment_ref: `PAY-${pad(++paySeq, 4)}`, target_type: 'PACKAGE_INVOICE', target_ref: `GI-${pad(invSeq, 4)}`, patient_id: pp.patient_id, date: pp.purchase_date, mode: pp.payment_method === 'cash' ? 'CASH' : 'ONLINE', amount: round2(pp.amount_paid + 2 * cg), kind: 'FULL', details_json: '{}', received_by: 'S02', test_data: 'YES' });
}

// Retail pharmacy sales (walk-in counter). One is by a registered patient (psoriasis → sunscreen).
const psoriasisPt = patients.find((p) => p.pathway === 'PSORIASIS');
const RETAIL = [
  { ref: 'RS-01', date: '2026-09-19', customer: '[TEST] Walk-in Customer A', phone: '', mode: 'CASH', items: [['M11', 1], ['M15', 1]] },
  { ref: 'RS-02', date: '2026-10-01', customer: psoriasisPt.full_name, phone: psoriasisPt.phone, mode: 'UPI', items: [['M11', 1]] },
  { ref: 'RS-03', date: '2026-10-08', customer: '[TEST] Walk-in Customer B', phone: '', mode: 'CARD', items: [['M33', 10], ['M24', 10], ['M23', 1]] },
];
const retailSales = [];
for (const r of RETAIL) {
  let sub = 0, cg = 0;
  for (const [m, q] of r.items) { const amt = MED[m].unit_price * q; sub += amt; cg += amt * (MED[m].tax_rate / 2) / 100; }
  const cgst = round2(cg);
  retailSales.push({ retail_ref: r.ref, date: r.date, customer: r.customer, customer_phone: r.phone, items: r.items.map(([m, q]) => `${m}x${q}`).join(';'), sub_total: round2(sub), cgst, sgst: cgst, total: round2(sub + 2 * cgst), payment_mode: r.mode, test_data: 'YES' });
  gstInvoices.push({ invoice_ref: `GI-${pad(++invSeq, 4)}`, source: 'RETAIL_SALE', encounter_id: '', patient_id: r.phone ? psoriasisPt.patient_id : '', date: r.date, item: 'Retail Pharmacy Sale', sac_hsn: 'mixed (see 28_retail_sales)', is_gst_taxable: 'YES', tax_rate: 'mixed', taxable_value: round2(sub), cgst, sgst: cgst, total: round2(sub + 2 * cgst), payment_mode: r.mode, note: 'Line-level rates (12%/18%) collapse into one invoice line', supply_type: 'B2C intra-state', document_type: 'Tax invoice', test_data: 'YES' });
  payments.push({ payment_ref: `PAY-${pad(++paySeq, 4)}`, target_type: 'RETAIL_INVOICE', target_ref: `GI-${pad(invSeq, 4)}`, patient_id: r.phone ? psoriasisPt.patient_id : '', date: r.date, mode: r.mode, amount: round2(sub + 2 * cgst), kind: 'FULL', details_json: JSON.stringify(paymentDetails(r.mode, round2(sub + 2 * cgst), paySeq)), received_by: 'S12', test_data: 'YES' });
}

// Finance scenarios the app does not model — kept as expected-outcome rows for manual QA.
const financeScenarios = [
  { scenario: 'CANCELLED_INVOICE', ref: 'GI-0003', action: 'Cancel invoice issued in error', expected: 'Cancellation with reason + audit trail; number not reused', app_support: 'PARTIAL — DELETE hard-deletes the invoice (no audit trail, no credit note)' },
  { scenario: 'DUPLICATE_INVOICE', ref: 'GI-0001', action: 'Collect Payment again for the same visit', expected: 'REJECT 409 — visit already billed', app_support: 'SUPPORTED' },
  { scenario: 'INVALID_FIELDS', ref: '—', action: 'Create invoice with negative amount / no linked visit', expected: 'REJECT 400', app_support: 'SUPPORTED' },
  { scenario: 'ADVANCE_PAYMENT', ref: 'ADM-QA-02', action: 'Collect ₹20,000 advance at admission, adjust on discharge bill', expected: 'Advance receipt; adjusted against final invoice', app_support: 'UNSUPPORTED' },
  { scenario: 'PARTIAL_PAYMENT', ref: 'PB bills marked PARTIAL', action: 'Record part payment, carry balance', expected: 'Outstanding balance tracked', app_support: 'UNSUPPORTED — bills are PAID/UNPAID only' },
  { scenario: 'REFUND_CREDIT_NOTE', ref: 'PP-03', action: 'Patient cancels package after 1 session; refund unused sessions', expected: 'Credit note for unused value, GST reversed', app_support: 'UNSUPPORTED' },
  { scenario: 'PACKAGE_EXPIRY', ref: 'PK1', action: 'Package validity 12 months', expected: 'Expired package cannot be redeemed', app_support: 'UNSUPPORTED — no validity field' },
  { scenario: 'INTER_STATE_SUPPLY', ref: 'QA-P017', action: 'Patient address in Karnataka', expected: 'Place-of-supply decision; IGST if inter-state (needs GST professional)', app_support: 'UNSUPPORTED — CGST/SGST only on sales' },
  { scenario: 'GSTR1_EXPORT', ref: 'All GI-*', action: 'Export B2C/HSN summary for the month', expected: 'Test file matching invoice register', app_support: 'UNSUPPORTED — no GSTR-1 export; reconcile against Invoices CSV export + Accounts summary' },
  { scenario: 'INPUT_IGST', ref: 'PO2 (V2 Karnataka)', action: 'Record purchase with IGST', expected: 'ITC split IGST', app_support: 'SUPPORTED in Purchases (igst field)' },
  { scenario: 'SPLIT_PAYMENT', ref: 'ADM-QA-01 patient bill', action: 'Pay one bill part cash, part UPI', expected: 'Two tenders on one bill, both on the receipt', app_support: 'UNSUPPORTED — one mode per bill' },
  { scenario: 'BILL_DISCOUNT', ref: 'Any OPD bill', action: 'Give a discount on a consultation/procedure bill', expected: 'Discount line with reason and approver', app_support: 'UNSUPPORTED — discounts exist only on package sales' },
  { scenario: 'INVOICE_NUMBER_REUSE', ref: 'GI-0003', action: 'Cancel (delete) the latest invoice, then issue a new one', expected: 'Cancelled number is never reused', app_support: 'TO VERIFY — numbering takes the highest existing number + 1' },
].map((r) => ({ ...r, test_data: 'YES' }));

// ───────────────────────────── stock ledger ─────────────────────────────
const batches = [];
const stockMoves = [];
for (const [po, vendor, inv, date, lines] of PURCHASES) {
  for (const [m, batch, exp, qty] of lines) {
    batches.push({ batch_ref: batch, medicine_id: m, purchase_ref: po, vendor_id: vendor, supplier_invoice: inv, received_date: date, expiry_date: exp, qty_received: qty, cost_price: MED[m].cost_price, expiry_state_on_2026_10_12: exp < '2026-10-12' ? 'EXPIRED' : exp <= '2026-12-11' ? 'NEAR_EXPIRY (<60 days)' : 'OK', test_data: 'YES' });
    stockMoves.push({ date, medicine_id: m, delta: qty, type: 'RECEIPT', ref: `${po}/${batch}` });
  }
}
const purchasesOut = PURCHASES.map(([po, vendor, inv, date, lines]) => {
  const taxable = round2(lines.reduce((s, [m, , , q]) => s + MED[m].cost_price * q, 0));
  const tax = round2(lines.reduce((s, [m, , , q]) => s + MED[m].cost_price * q * MED[m].tax_rate / 100, 0));
  const inter = VENDORS.find((v) => v.vendor_id === vendor).supply_type.startsWith('Inter');
  return { purchase_ref: po, vendor_id: vendor, vendor_invoice_no: inv, invoice_date: date, line_count: lines.length, taxable_value: taxable, igst: inter ? tax : 0, cgst: inter ? 0 : round2(tax / 2), sgst: inter ? 0 : round2(tax / 2), total_value: round2(taxable + tax), input_classification: 'Medicine Stock', itc_eligibility: 'Full', test_data: 'YES' };
});
for (const o of careOrders) if (o.dispensed === 'YES' && o.medicine_id) {
  const e = encounters.find((x) => x.encounter_id === o.encounter_id);
  stockMoves.push({ date: e.date, medicine_id: o.medicine_id, delta: -o.quantity, type: 'DISPENSE', ref: o.order_id });
}
for (const r of RETAIL) for (const [m, q] of r.items) stockMoves.push({ date: r.date, medicine_id: m, delta: -q, type: 'RETAIL_SALE', ref: r.ref });
for (const c of consumableUse) stockMoves.push({ date: c.date, medicine_id: c.medicine_id, delta: -c.qty, type: 'ADJUST_CONSUMED', ref: c.cu_ref });
const ADJUSTMENTS = [
  { ref: 'ADJ-01', date: '2026-09-24', medicine_id: 'M15', delta: -2, reason: '[TEST] Return to supplier — 2 bottles leaking (V1)' },
  { ref: 'ADJ-02', date: '2026-10-02', medicine_id: 'M20', delta: 1, reason: '[TEST] Patient return — unopened tube, refunded at counter' },
  { ref: 'ADJ-03', date: '2026-10-05', medicine_id: 'M14', delta: -20, reason: '[TEST] Expired stock write-off — batch CET-A1 (exp 2026-09-30)' },
  { ref: 'ADJ-04', date: '2026-10-09', medicine_id: 'M24', delta: -3, reason: '[TEST] Physical count correction — 3 tablets short' },
];
for (const a of ADJUSTMENTS) stockMoves.push({ date: a.date, medicine_id: a.medicine_id, delta: a.delta, type: 'ADJUSTMENT', ref: a.ref });
stockMoves.sort((a, b) => a.date.localeCompare(b.date) || b.delta - a.delta);

// Running balance per medicine; any negative balance means the dataset would fail on import.
const balance = {};
const ledger = stockMoves.map((mv) => {
  balance[mv.medicine_id] = (balance[mv.medicine_id] || 0) + mv.delta;
  return { ...mv, balance_after: balance[mv.medicine_id], test_data: 'YES' };
});

// ───────────────────────────── schedules output ─────────────────────────────
const schedules = [];
for (const [doc, s] of Object.entries(SCHEDULES)) for (const day of s.days) schedules.push({ doctor: doc, doctor_name: staffName(doc), day_of_week: day, day_name: DOW[day], start_time: s.start, end_time: s.end, slot_minutes: s.slot, app_support: 'SUPPORTED (DoctorSchedule)' });
const rosters = [
  ...['S08', 'S09'].flatMap((n) => opDays.map((day, i) => ({ staff_id: n, date: day, shift: n === 'S08' ? '08:00-20:00 Day' : '20:00-08:00 Night', area: 'QA Surgical Ward', app_support: 'UNSUPPORTED — no nurse roster' })).filter((r, i) => i % 2 === (r.staff_id === 'S08' ? 0 : 1))),
  ...opDays.filter((dd) => [1, 3].includes(dow(dd))).map((dd) => ({ staff_id: 'D4+S11', date: dd, shift: '09:00-14:00', area: 'Operation theatre (OT-1)', app_support: 'UNSUPPORTED — no OT/room schedule' })),
  ...opDays.map((dd) => ({ staff_id: 'S10', date: dd, shift: '14:00-19:00', area: 'Procedure room (Laser/PRP)', app_support: 'UNSUPPORTED — no room booking' })),
];

const followUpCalls = [];
let fcSeq = 0;
for (const a of appointments.filter((x) => x.status === 'No-Show')) followUpCalls.push({ call_ref: `FC-${pad(++fcSeq, 2)}`, patient_id: a.patient_id, kind: 'DOCTOR_FOLLOW_UP', due_date: a.date, outcome: pick(['NO_ANSWER', 'CALL_BACK', 'BOOKED']), note: '[TEST] Called after no-show', called_by: 'S02', test_data: 'YES' });

const templatesRx = [
  { template_ref: 'TPL-01', doctor: 'D1', name: 'Acne Vulgaris — Grade II (Test)', condition: 'Acne vulgaris', items: 'M03;M04;M01' },
  { template_ref: 'TPL-02', doctor: 'D1', name: 'Tinea Corporis/Cruris (Test)', condition: 'Dermatophytosis', items: 'M19;M20' },
  { template_ref: 'TPL-03', doctor: 'D3', name: 'Atopic Dermatitis — Child (Test)', condition: 'Atopic dermatitis', items: 'M15;M12;M13;M34' },
];

// ───────────────────────────── live-queue de-duplication (no randomness) ─────────────────────────────
// A patient can be in a day's queue only once. If the live-day draw picked the same patient
// twice, move the extra row to the first patient with a booked follow-up who is not already
// in the live queue. Runs after every random draw, so no other row changes.
{
  const live = encounters.filter((e) => e.date === CONFIG.liveDay);
  const seen = new Set();
  for (const e of live) {
    if (!seen.has(e.patient_id)) { seen.add(e.patient_id); continue; }
    const sub = appointments.find((a) => a.status === 'Scheduled' && !seen.has(a.patient_id));
    if (!sub) throw new Error('no substitute patient for live queue');
    e.patient_id = sub.patient_id; e.doctor = sub.doctor; e.authoring_clinician = sub.doctor;
    e.department = sub.doctor === 'D4' ? 'DEP-PLAS' : 'DEP-DERM';
    seen.add(sub.patient_id);
  }
}

// ───────────────────────────── GSTR-1 style TEST export (expected) ─────────────────────────────
// Built from the expected invoice register. Layout follows GSTR-1 tables 7 (B2CS),
// 8 (nil/exempt), 12 (HSN/SAC) and 13 (documents issued). TEST FILE — never upload or file.
const pos = (g) => (g.patient_id && patients.find((x) => x.patient_id === g.patient_id)?.state.startsWith('Karnataka') ? '29-Karnataka (POS REVIEW)' : '27-Maharashtra');
const b2csMap = {}, hsnMap = {};
const addHsn = (code, desc, rate, taxable, tax) => {
  const k = `${code}|${rate}`;
  const h = (hsnMap[k] ||= { hsn_sac: code, description: desc, rate, invoices_or_lines: 0, taxable_value: 0, cgst: 0, sgst: 0, igst: 0 });
  h.invoices_or_lines++; h.taxable_value = round2(h.taxable_value + taxable); h.cgst = round2(h.cgst + tax); h.sgst = round2(h.sgst + tax);
};
let exemptIntra = 0, exemptInter = 0;
for (const g of gstInvoices) {
  if (g.source === 'RETAIL_SALE') {
    const r = RETAIL.find((x) => g.date === x.date);
    for (const [m, q] of r.items) {
      const amt = MED[m].unit_price * q, tax = round2(amt * MED[m].tax_rate / 200);
      addHsn(MED[m].hsn_code, MED[m].category, MED[m].tax_rate, amt, tax);
      const k = `27-Maharashtra|${MED[m].tax_rate}`;
      const b = (b2csMap[k] ||= { place_of_supply: '27-Maharashtra', rate: MED[m].tax_rate, taxable_value: 0, cgst: 0, sgst: 0, igst: 0 });
      b.taxable_value = round2(b.taxable_value + amt); b.cgst = round2(b.cgst + tax); b.sgst = round2(b.sgst + tax);
    }
    continue;
  }
  if (g.is_gst_taxable === 'YES') {
    const k = `${pos(g)}|${g.tax_rate}`;
    const b = (b2csMap[k] ||= { place_of_supply: pos(g), rate: g.tax_rate, taxable_value: 0, cgst: 0, sgst: 0, igst: 0 });
    b.taxable_value = round2(b.taxable_value + g.taxable_value); b.cgst = round2(b.cgst + g.cgst); b.sgst = round2(b.sgst + g.sgst);
  } else if (pos(g).startsWith('29')) exemptInter = round2(exemptInter + g.taxable_value);
  else exemptIntra = round2(exemptIntra + g.taxable_value);
  addHsn(g.sac_hsn, g.is_gst_taxable === 'YES' ? 'Aesthetic/cosmetic services (TEST classification)' : 'Health care services (TEST classification — exempt)', g.tax_rate, g.taxable_value, g.cgst);
}
const gstr1B2cs = Object.values(b2csMap).map((b) => ({ ...b, type: 'OE', file_label: 'TEST FILE — DO NOT FILE' }));
const gstr1Exempt = [
  { description: 'Intra-state supplies to unregistered persons', nil_rated: 0, exempted: exemptIntra, non_gst: 0, file_label: 'TEST FILE — DO NOT FILE' },
  { description: 'Inter-state supplies to unregistered persons (POS REVIEW)', nil_rated: 0, exempted: exemptInter, non_gst: 0, file_label: 'TEST FILE — DO NOT FILE' },
];
const gstr1Hsn = Object.values(hsnMap).map((h) => ({ ...h, file_label: 'TEST FILE — DO NOT FILE' }));
const gstr1Docs = [{ nature: 'Invoices for outward supply', sr_from: '(first app invoice number)', sr_to: '(last app invoice number)', total_issued: gstInvoices.length + 1, cancelled: 1, net_issued: gstInvoices.length, note: 'One erroneous invoice is issued and cancelled during import (CANCELLED_INVOICE scenario)', file_label: 'TEST FILE — DO NOT FILE' }];

// ───────────────────────────── write CSVs ─────────────────────────────
const csvEscape = (v) => { const s = v === undefined || v === null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
function writeCsv(name, rows) {
  if (!rows.length) throw new Error(`empty ${name}`);
  const cols = Object.keys(rows[0]);
  const body = [cols.join(','), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(','))].join('\n');
  fs.writeFileSync(path.join(OUT, name), '﻿' + body + '\n', 'utf8');
  return rows.length;
}
const files = {
  '00_clinic_config.csv': [{ ...CONFIG, test_data: 'YES' }],
  '01_departments.csv': DEPARTMENTS.map((x) => ({ ...x, test_data: 'YES' })),
  '02_staff.csv': STAFF,
  '03_doctor_schedules.csv': schedules,
  '04_staff_leave.csv': LEAVE,
  '05_rosters_rooms_ot_UNSUPPORTED.csv': rosters,
  '06_treatments.csv': TREATMENTS,
  '07_package_types.csv': PACKAGE_TYPES,
  '08_medicines.csv': MEDICINES,
  '09_vendors.csv': VENDORS.map((x) => ({ ...x, test_data: 'YES' })),
  '10_purchases.csv': purchasesOut,
  '11_batches.csv': batches,
  '12_patients.csv': patients,
  '13_duplicate_registration_probes.csv': dupProbes.map((x) => ({ ...x, test_data: 'YES' })),
  '14_appointments.csv': appointments.map((a) => ({ ...a, test_data: 'YES' })),
  '15_appointment_rule_probes.csv': probes.map((x) => ({ ...x, test_data: 'YES' })),
  '16_encounters.csv': encounters.sort((a, b) => (a.date === CONFIG.liveDay) - (b.date === CONFIG.liveDay) || a.date.localeCompare(b.date) || a.check_in_time.localeCompare(b.check_in_time)),
  '17_care_orders.csv': careOrders,
  '18_procedures.csv': procedures,
  '19_package_purchases.csv': packagePurchases,
  '20_admissions.csv': admissions,
  '21_progress_notes.csv': progressNotes.map((x) => ({ ...x, test_data: 'YES' })),
  '22_medication_orders.csv': medOrders,
  '23_medication_administrations.csv': medAdmin.map((x) => ({ ...x, test_data: 'YES' })),
  '24_documents.csv': documents,
  '25_encounter_bills.csv': encounterBills,
  '26_gst_invoice_register.csv': gstInvoices,
  '27_payments.csv': payments,
  '28_retail_sales.csv': retailSales,
  '29_finance_scenarios.csv': financeScenarios,
  '30_stock_adjustments.csv': [...ADJUSTMENTS.map((a) => ({ ...a, source: 'MANUAL' })), ...consumableUse.map((c) => ({ ref: c.cu_ref, date: c.date, medicine_id: c.medicine_id, delta: -c.qty, reason: c.reason, source: 'PROCEDURE_CONSUMABLE' }))].map((x) => ({ ...x, test_data: 'YES' })),
  '31_stock_ledger_expected.csv': ledger,
  '32_follow_up_calls.csv': followUpCalls,
  '33_prescription_templates.csv': templatesRx.map((x) => ({ ...x, test_data: 'YES' })),
  '34_historical_visits.csv': historicalVisits,
  '35_gstr1_TEST_b2cs.csv': gstr1B2cs,
  '36_gstr1_TEST_exempt.csv': gstr1Exempt,
  '37_gstr1_TEST_hsn_sac.csv': gstr1Hsn,
  '38_gstr1_TEST_documents.csv': gstr1Docs,
};
const counts = {};
for (const [f, rows] of Object.entries(files)) counts[f] = writeCsv(f, rows);

// ───────────────────────────── placeholder assets ─────────────────────────────
// A flat grey PNG (no person, no body part) and a one-page PDF that says, in words, that
// it is not a consent. These stand in for clinical photos and consent forms on upload.
const ASSETS = path.join(HERE, 'assets');
fs.mkdirSync(ASSETS, { recursive: true });
{
  const zlib = await import('node:zlib');
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const w = 320, h = 240;
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * (w * 3 + 1) + 1 + x * 3; const stripe = ((x + y) >> 4) % 2 === 0;
    raw[o] = raw[o + 1] = raw[o + 2] = stripe ? 200 : 180;
  }
  fs.writeFileSync(path.join(ASSETS, 'placeholder-photo.png'), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));

  const text = 'BT /F1 16 Tf 50 760 Td (TEST PLACEHOLDER - SYNTHETIC QA DOCUMENT) Tj 0 -28 Td /F1 12 Tf (This is NOT a signed consent and NOT a medical record.) Tj 0 -18 Td (Generated for software testing of the Aurora QA clinic only.) Tj ET';
  const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${text.length} >>\nstream\n${text}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let pdf = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  fs.writeFileSync(path.join(ASSETS, 'placeholder-document.pdf'), pdf, 'latin1');
}
console.log('[TEST DATA] dataset written to', OUT);
console.table(counts);
