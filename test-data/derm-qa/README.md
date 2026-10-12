# [TEST DATA] Dermatology & Reconstructive QA Dataset — Plan and Import Proposal

> **Everything in this folder is synthetic test data.** All people, phone numbers, addresses,
> clinical notes, consents and transactions are fictional, generated for software testing of
> the Hospital Management System only. Clinical text is **simulated** and is not medical advice
> or a patient record. No government identifiers are generated. GST classifications are **test
> configuration** and every one is flagged for review by a qualified Indian GST professional.
> Nothing here is to be filed with any government portal.

| Item | Where |
|---|---|
| Generator (deterministic, seed `20261012`) | `generate.mjs` → `data/*.csv`, `assets/*` |
| Independent validator / reconciliation (G) | `validate.mjs` → `reports/reconciliation.md` |
| Patient master — exactly 50 (B) | `data/12_patients.csv` |
| Linked datasets (C) | `data/00_…` to `data/33_…` (table below) |

```
node test-data/derm-qa/generate.mjs   # rebuild the CSVs (byte-identical every run)
node test-data/derm-qa/validate.mjs   # 42 checks + reconciliation report; exit 1 on failure
```

## Status — imported and verified (2026-10-12)

All 10 steps of the execution sequence are done; the approvals in [§H.6](#h6-approvals-needed-before-step-7) were given.

| Step | Result |
|---|---|
| Dataset validated | `validate.mjs`: **50/50 checks pass** → `reports/reconciliation.md` |
| Imported (isolated QA DB) | via the app's API as each role — 50 patients, 8 historical visits, 94 window encounters + 6 live-queue rows, 110 appointments, 18 package sales, 3 admissions, 108 invoices, 143 bills, 67 documents |
| Timestamps aligned | 1,767 records moved from import time to their dataset date/time → `runtime/timestamp-alignment.log` |
| Read back from the app | `tools/verify.mjs`: **19/23 checks match** — the 4 that don't are application defects (below), not import gaps → `reports/import-results.md` |
| Test-data register | `register/test-data-register.csv` (QA-P### ↔ UHID) and `register/encounters-register.csv` (encounter ↔ token, PB-/PH- bill no., INV- no.) |

**Open the QA app:** http://localhost:3100 (frontend) → http://localhost:4100/api (backend), clinic
`[TEST] Aurora Skin & Reconstructive Clinic (QA)`. Every login is `<staff_id>.<role>@aurora-qa.test`
(see `data/02_staff.csv`, e.g. `s02.reception@aurora-qa.test`, `d1.doctor@aurora-qa.test`,
`s12.pharmacy@aurora-qa.test`, `s13.account@aurora-qa.test`); password `QaTest@2026`
(isolated QA database only). Platform admin: `s00.super_admin@aurora-qa.test`.

```
node test-data/derm-qa/tools/start-backend.mjs     # QA API on :4100 (runtime/qa-derm.db)
node test-data/derm-qa/tools/start-frontend.mjs    # QA UI on :3100
node test-data/derm-qa/tools/verify.mjs            # re-check the app against the dataset
# Reset: stop both, delete test-data/derm-qa/runtime/, then
node test-data/derm-qa/tools/bootstrap.mjs && <start backend> && node test-data/derm-qa/tools/import.mjs && node test-data/derm-qa/tools/align-timestamps.mjs
```
(`bootstrap.mjs` expects a compiled backend in `runtime/dist` —
`cd backend && npx tsc -p tsconfig.build.json --outDir ../test-data/derm-qa/runtime/dist --incremental false`.)

### Defects confirmed by the import (evidence in `reports/import-results.md`)
| # | Finding | Evidence |
|---|---|---|
| 1 | **Expired stock is dispensed** — FEFO takes the expired batch first | Batch CET-A1 (expired 2026-09-30) went from 20 → 10 while valid CET-A2 stayed untouched |
| 2 | **Package-covered sessions charged again** on the patient bill | 34 bills differ from the correct rule; together with #3, ₹1,00,642.64 over-charged |
| 3 | **Pharmacy bill includes medicines never dispensed** (saved-not-dispensed, zero/insufficient stock) | Same 34-bill set |
| 4 | **Inpatient medicines are deducted from stock twice** — once by the pharmacy's dispense, again for every MAR dose marked "Given" (and MAR doses are never billed) | Paracetamol −22, Ceftriaxone −9 = exactly the "Given" doses |
| 5 | **Patient e-mail is never saved** | 0/50 patients have an e-mail although all were sent one |
| 6 | **A cancelled (deleted) invoice number is reused** | INV-2026-0001 issued, deleted, and re-issued as INV-2026-0001 |
| 7 | **Doctor leave is not modelled** — bookings on leave days are accepted | DOCTOR_ON_LEAVE probe accepted |
| 8 | No duplicate-patient check; invoice delete is a hard delete; stock adjustments don't touch batches; consultation fee hard-coded exempt | Inspection (listed in §F) |
| 9 | Minor: accounts GST total returned with float noise (`72001.20000000001`); error messages say "Dr. Dr. …"; follow-up call-back dates cannot be back-dated | API responses |

Working as intended: zero/insufficient-stock dispense rejected, double-booking / outside-session /
no-session / Sunday slots rejected, duplicate invoice (409), invalid invoice (400), missing UPI
transaction ID or bad card digits (400), package discounts and sittings, payment modes with details,
GST invoice values and dates, accounts totals for the window.

---

## A. Data-generation plan

### A.1 What was inspected (step 1)
- **Stack:** NestJS + Prisma backend (`backend/`), React/Vite frontend (`frontend/`), SQLite locally
  (`backend/prisma/schema.prisma`, `provider = "sqlite"`), Postgres in production.
- **Modules with an API** (34 controllers): patients, appointments + doctor schedules, queue
  (check-in → assess → service → pharmacy), care orders (medicine/injection/treatment/other,
  perform, dispense), visits (day-book), treatments master, packages (types, purchases, redemption),
  invoices (Collect Payment, reconcile, delete), encounter bills (patient + pharmacy, paid/unpaid,
  mode + details), medicines (catalogue, refill with batches, adjust, expiry, batch trace),
  purchases (ITC), retail POS, admissions (wards/beds, progress notes, discharge), medication
  orders + administrations (MAR), patient documents (upload), prescription templates,
  follow-up calls, departments, users, analytics, accounts.
- **Back-dating:** queue check-in (`queueDate`), admissions (`admissionDate`), appointments
  (`startTime`), visits (`date`), purchases (`invoiceDate`) accept historical dates. Invoices,
  bill payments, dispenses, care orders, progress notes, administrations and stock movements are
  always stamped **now** — see the timestamp-alignment step in [§H](#h-safe-import-plan).

### A.2 Test environment (step 2)
`backend/prisma/dev.db` is **not** a safe target: it already holds clinic data — "A2K Clinic"
(904 patients, 1,944 visits — apparently imported from the clinic's Excel day-books), "Logic
Minds" and "Apollo Dermatology Center". **No test data will be written to it.** The plan uses a
new, separate SQLite file and a second backend instance (see [§H](#h-safe-import-plan)).

### A.3 Design
- **Clinic identity (configurable, `00_clinic_config.csv`):** `[TEST] Aurora Skin & Reconstructive
  Clinic (QA)`, fictional Pune address, GSTIN `TEST-GSTIN-NOT-VALID`. Every name carries
  `(Test)`/`[TEST]`; every row has `test_data = YES`; e-mails use the reserved `.test` domain.
- **Window:** 4 consecutive weeks, **Mon 2026-09-14 → Sat 2026-10-10**, Mon–Sat (closed
  Sundays) = 24 operating days; 94 encounters on 22 of them (2–12 per day, mean 4.3; two quiet
  days with none). Six more encounters are dated `IMPORT_DAY` to populate a live queue
  (3 waiting, 1 with doctor, 1 awaiting service, 1 left). 35 follow-ups are booked as future
  appointments. 8 of the 50 patients are **returning** — they have day-book history from
  May–August 2026 (`34_historical_visits.csv`), so the app flags them as regulars.
- **Staff (14):** admin, 2 receptionists, 3 dermatologists (medical/acne, hair-laser-aesthetic,
  paediatric), 1 plastic surgeon, 2 ward nurses, procedure-room tech, OT tech, pharmacist,
  accountant, RM. Weekly sessions per doctor; one leave period.
- **Patients (50) = 17 clinical pathways.** The 30:20 split is a **test label**
  (`tax_test_category`) kept separate from the tax treatment of each service line:

| TAXABLE_TEST (30) | n | EXEMPT_TEST (20) | n |
|---|---|---|---|
| Androgenetic alopecia → PRP package | 5 | Atopic dermatitis (child, guardian) | 3 |
| Female pattern hair loss → PRP package | 3 | Allergic contact dermatitis | 1 |
| Melasma → Q-switched laser package | 4 | Chronic plaque psoriasis | 2 |
| Acne vulgaris → salicylic peel package | 5 | Tinea corporis/cruris | 3 |
| Post-acne scarring → CO2 / microneedling | 4 | Viral warts → cryotherapy | 3 |
| Hirsutism → laser hair reduction | 3 | Benign lesion → excision / biopsy | 2 |
| Post-inflammatory pigmentation → peel | 2 | Wound → debridement + dressing package | 2 |
| Seborrhoeic keratoses → RF ablation | 2 | Reconstructive IPD (STSG ×2, scar revision, flap) | 4 |
| Telogen effluvium (OPD only) | 2 | | |

  Cross-over is deliberate: taxable-category patients have exempt consultation lines, and the
  telogen-effluvium patients receive **only** exempt services; exempt-category patients buy
  taxable medicines/sunscreen. Turnover is always computed from **lines**.
- **Clinical content:** each new consultation has chief complaint, duration/history, examination,
  provisional/confirmed diagnosis, assessment, plan, prescription with dose/route/frequency/
  duration, advice, staff instructions, follow-up date, authoring doctor. Follow-ups record a
  condition trend (improving/same/worsening). Reception records only the patient's words or
  "booked procedure session" — the validator checks that no reception complaint contains a
  diagnosis.

### A.4 Files (C)
| File | Rows | Content |
|---|---|---|
| 00_clinic_config | 1 | Clinic identity, window, fees, test password for the isolated QA DB |
| 01_departments | 2 | Dermatology, Plastic & Reconstructive Surgery |
| 02_staff | 14 | Fictional staff, roles, departments, nurse/tech ↔ doctor links |
| 03_doctor_schedules | 19 | Weekly sessions (supported) |
| 04_staff_leave | 2 | Leave (unsupported — used as a probe) |
| 05_rosters_rooms_ot_UNSUPPORTED | 56 | Nurse roster, OT and procedure-room schedules |
| 06_treatments | 19 | Procedures with price, taxability, rate, SAC (review flagged) |
| 07_package_types | 4 | PRP ×6, acne peel ×4, melasma laser ×6, dressing ×10 |
| 08_medicines | 35 | Medicine/consumable master with stock scenario tags |
| 09_vendors / 10_purchases / 11_batches | 2 / 5 / 40 | Suppliers (1 inter-state), purchase invoices, batches with expiry |
| 12_patients | **50** | Patient master incl. registration date, first-visit/returning, status, guardian, emergency contact, consent preferences |
| 13_duplicate_registration_probes | 3 | Duplicate-detection tests (not imported as patients) |
| 14_appointments | 110 | Completed, rescheduled, cancelled, no-show, future |
| 15_appointment_rule_probes | 7 | Double-booking, outside session, no session, leave, Sunday, schedule change, room clash |
| 16_encounters | 100 | Queue entries + clinical record per visit (check-in, seen, completed times) |
| 17_care_orders | 119 | Prescriptions/orders with dispensing outcome and scenario |
| 18_procedures | 51 | Indication, contraindication review, consent status, checklist, notes, consumables, state |
| 19_package_purchases | 18 | Sales incl. 2 discounted |
| 20_admissions | 4 | 2 complete & discharged, 1 pending documentation, 1 must-be-blocked |
| 21–23 progress notes / medication orders / administrations | 18 / 6 / 36 | Vitals, doctor notes, MAR (given/missed/refused) |
| 24_documents | 67 | Placeholder photos, simulated consents, investigations, anaesthesia records, histopathology, discharge summaries |
| 25_encounter_bills | 143 | Patient + pharmacy bills, correct total **and** app-formula total |
| 26_gst_invoice_register | 108 | Expected GST invoice register (collect payment, package, retail) with SAC/HSN |
| 27_payments | 141 | Allocation per bill/invoice with mode and mode-specific details |
| 28_retail_sales | 3 | Walk-in pharmacy sales |
| 29_finance_scenarios | 13 | Cancel, duplicate, invalid, advance, partial, split, refund, bill discount, expiry, inter-state, number reuse, GSTR-1 |
| 30_stock_adjustments | 38 | Returns, write-off, count correction, procedure consumables |
| 31_stock_ledger_expected | 187 | Every stock movement with running balance |
| 32_follow_up_calls / 33_prescription_templates | 5 / 3 | Reception call log, doctor templates |
| 34_historical_visits | 8 | Pre-window history for the 8 returning patients (May–Aug 2026) |
| 35–38 gstr1_TEST_* | 2 / 2 / 6 / 1 | GSTR-1-style **test** tables: B2CS, exempt, HSN/SAC, documents issued |

Tools (`tools/`): `env.mjs` (paths, QA DB), `bootstrap.mjs`, `start-backend.mjs`, `start-frontend.mjs`
+ `vite.qa.config.mjs`, `import.mjs` (resumable API import), `align-timestamps.mjs`, `verify.mjs`.

---

## D. Relationship map

```
Clinic ─┬─ Department ── User (doctor / nurse / staff) ── DoctorSchedule
        ├─ TreatmentMaster ── PackageType
        ├─ Medicine ── MedicineBatch ── Purchase (vendor invoice)
        │                   └─ BatchDispenseRecord ─┬─ CareOrder
        │                                           └─ RetailSaleItem ── RetailSale ── Invoice
        └─ Patient (QA-P###  ↔  app UHID)
             ├─ Appointment (slot in DoctorSchedule)
             ├─ PackagePurchase ── Invoice (package sale)
             │        └─ Visit (redeemed sitting)
             └─ PatientQueue  = one encounter (E####, token per dept/day)
                  ├─ assess → Visit (day-book: treatment, diagnosis, trend) ── Invoice (Collect Payment, 1 per visit)
                  ├─ CareOrder (MEDICINE/INJECTION → pharmacy; TREATMENT/OTHER → service desk)
                  ├─ EncounterBill PATIENT (PB-) and PHARMACY (PH-) → payment status, mode, details
                  ├─ PatientDocument (photos, consent placeholders, reports)
                  └─ Admission ── Bed ── Ward
                        ├─ ProgressNote (doctor / nurse vitals)
                        └─ MedicationOrder ── MedicationAdministration (MAR)
```

Dataset keys → app keys: `QA-P###` → `Patient.uhid`; `E####` → `PatientQueue.id` (+ token);
`PB-REF/PH-REF` → `EncounterBill.billNumber`; `GI-####` → `Invoice.invoiceNumber`;
`ADM-QA-##` → `Admission.id`; batch refs are stored verbatim as `MedicineBatch.batchNumber`. The
importer writes the mapping to `register/test-data-register.csv` (step 10).

---

## E. Test-scenario matrix

`Sup` = app support found during inspection: ✅ supported · ⚠️ partial / workaround · ❌ unsupported.
"Expected" is the correct behaviour; where inspection predicts the app differs, it says so.

| # | Area | Dataset rows | Scenario | Expected | Sup |
|---|---|---|---|---|---|
| R1 | Reception | 12_patients | Register 50 patients, UHID auto-assigned | 50 UHIDs, searchable by name/phone/UHID | ✅ |
| R2 | Reception | 13 probes | Exact duplicate / spelling variant / shared family phone | Warn or block duplicates | ❌ no duplicate check (predicted to accept) |
| R3 | Reception | 14 BOOKED/WALK_IN | Book vs walk-in, assign department + doctor, token per dept/day | Tokens restart per dept per day | ✅ |
| R4 | Reception | 14 rescheduled_from | Reschedule appointment | New slot, history kept | ⚠️ PATCH overwrites — no history |
| R5 | Reception | 14 Cancelled/No-Show | Cancel / no-show frees the slot | Slot reusable | ✅ |
| R6 | Reception | 15 probes | Double-book, outside session, no session day, Sunday | Rejected | ✅ |
| R7 | Reception | 15 DOCTOR_ON_LEAVE, 04 | Book on leave day | Rejected | ❌ no leave model |
| R8 | Reception | 16 reception_complaint | Complaint without diagnosis | Free text only | ✅ |
| R9 | Reception | 16 LIVE_* | Live queue board: waiting / with doctor / awaiting service / left | Board and counts correct | ✅ |
| C1 | Clinical | 16 NEW | Full structured consult record | CC, Hx, O/E, Dx, plan stored | ⚠️ only diagnosis + free-text notes fields |
| C2 | Clinical | 16 diagnosis_status | Provisional vs confirmed | Flag stored | ❌ no field (in text only) |
| C3 | Clinical | 16 FU condition_trend | Improving/same/worsening over visits | Trend history per patient | ✅ |
| C4 | Clinical | 33 templates | Apply a doctor's Rx template | Orders filled in one click | ✅ |
| O1 | OPD-only | TE_OPD, TINEA, PSORIASIS… | Consult + Rx, no procedure | Consult bill, pharmacy bill separate | ✅ |
| O2 | OPD-only | 17 SAVED_NOT_DISPENSED (9) | Rx saved but patient buys outside | Rx printable; not dispensed; **not billed** | ⚠️ pharmacy bill includes undispensed items |
| O3 | OPD-only | 25 UNPAID / PARTIAL | Outstanding balance | Balance tracked | ⚠️ PAID/UNPAID only — partial ❌ |
| P1 | Procedure | 18 COMPLETED | Procedure with indication, contraindication review, consent, checklist, notes, consumables, post-care | All recorded | ⚠️ notes/staff fields only; consent/checklist ❌ |
| P2 | Procedure | 18 PENDING_CONSENT | Procedure must not proceed without consent | Blocked | ❌ no consent gate (deferral simulated by not billing) |
| P3 | Procedure | 18 POSTPONED | Postponed (flare) | Re-booked, not billed | ✅ by data |
| P4 | Procedure | 18 AWAITING_STAFF_SIGN_OFF | Tech sign-off pending | Visible as pending | ⚠️ care order ORDERED vs DONE only |
| P5 | Procedure | 18 MISSING_DOCUMENTATION | Consent document missing | Flagged | ❌ |
| P6 | Procedure | 24 SCAN_IMAGE | Pre-procedure photos | Upload, view | ✅ images/PDF · ❌ video |
| P7 | Procedure | 30 PROCEDURE_CONSUMABLE | Consumables reduce stock | Stock and ledger reduced | ⚠️ via manual adjustment |
| I1 | IPD | 20 STSG_BURN / STSG_TRAUMA | Admit → op → MAR → notes → discharge | Complete chain | ✅ (no OT/anaesthesia record) |
| I2 | IPD | 20 SCAR_REVISION | Pending documentation, still admitted | Visible as incomplete | ⚠️ no documentation status |
| I3 | IPD | 20 FLAP_BLOCKED | Admit without consent | **Blocked** | ❌ predicted to allow |
| I4 | IPD | 23 Given/Missed/Refused | MAR statuses | Recorded per dose | ✅ |
| I5 | IPD | 21 NEEDS_ATTENTION | Status escalation from a note | Dashboard shows attention | ✅ |
| I6 | IPD | 17 TR19 | Bed charges per day on bill | Itemised | ⚠️ workaround: bed as treatment item (care orders cannot take a price) |
| I7 | IPD | 20 | Admission number | Human-readable number | ❌ UUID only |
| F1 | Pharmacy | 08 M18 | Prescribe zero-stock item | Doctor/pharmacist alerted; not dispensable | ⚠️ dispense rejected; prescriber alert to verify |
| F2 | Pharmacy | 17 M19 | Prescribed qty > stock | Dispense rejected with message | ✅ |
| F3 | Pharmacy | 11 CET-A1, 17 EXPIRED_BATCH | Expired batch present | Never dispensed; next valid batch used | ❌ **defect: FEFO takes expired batch first** |
| F4 | Pharmacy | 11 ADA-A1/A2 | First batch exhausted | Next batch used, traceable | ✅ |
| F5 | Pharmacy | 17 CLARIFICATION | Non-stocked item, substitution needs approval | No silent substitution | ⚠️ free-text only, no approval workflow |
| F6 | Pharmacy | 08 M13 | Low-stock alert | Shown on dashboard | ✅ |
| F7 | Pharmacy | 11 near-expiry | Expiry dashboard (60 days) | BPO-A1, PCM-A1 listed | ✅ |
| F8 | Pharmacy | 30 ADJ-01..04 | Return to supplier, patient return, write-off, count correction | Stock + batch reconcile | ⚠️ adjustments don't touch batches |
| F9 | Pharmacy | 10 / 11 | Purchases → receipts → ITC (IGST for inter-state vendor) | ITC summary correct | ✅ |
| F10 | Pharmacy | 28 | Retail POS with card/UPI/cash details | Receipt shows details | ✅ |
| S1 | Schedules | 03 | Doctor sessions drive slots | Slots match sessions | ✅ |
| S2 | Schedules | 05 | Nurse roster, OT, procedure room | Bookable | ❌ |
| K1 | Packages | 19 | Purchase, redeem, remaining sittings | Counters correct | ✅ |
| K2 | Packages | 25 app_differs | Redeemed session on patient bill | ₹0 for covered session | ❌ **defect: session charged again** |
| K3 | Packages | 19 discount | Discounted sale | Discount, reason, who — visible | ✅ |
| K4 | Packages | 29 | Expiry, cancellation, refund | Supported | ❌ |
| B1 | Billing | 25 mixed_invoice | Taxable + exempt lines on one bill | Correct split | ✅ patient bill · ❌ GST invoice is single-line |
| B2 | Billing | 27 details_json | Cash/UPI/card/online details on bill | Printed | ✅ |
| B3 | Billing | 29 DUPLICATE_INVOICE | Bill same visit twice | 409 | ✅ |
| B4 | Billing | 29 CANCELLED_INVOICE | Cancel with audit/credit note | Audit trail | ⚠️ hard delete |
| B5 | Billing | 29 ADVANCE / REFUND | Advance, refund, credit note | Supported | ❌ |
| G1 | GST | 26 | Register totals (taxable/exempt/CGST/SGST) | Match reconciliation §6 | ✅ to verify |
| G2 | GST | 06 / 08 | Rates configurable per item | No hard-coding | ⚠️ consultation fee hard-coded exempt |
| G3 | GST | QA-P017 | Out-of-state patient (place of supply) | Professional decision; IGST if applicable | ❌ CGST/SGST only |
| G4 | GST | 29 GSTR1_EXPORT | GSTR-1 test export | Matches register | ❌ no export — use invoices CSV + accounts summary |

---

## F. Missing or unsupported application fields

| Area | Field / capability | Where the dataset keeps it instead |
|---|---|---|
| Patient | **E-mail** — accepted by the API but never saved (defect) | `email_synthetic` |
| Patient | Emergency contact, guardian for minors, medical history (structured), status, assigned doctor, consent & privacy preferences | `12_patients.csv` columns |
| Patient | Duplicate detection | `13_duplicate_registration_probes.csv` |
| Appointment | Reschedule history, cancellation/no-show reason | `rescheduled_from`, `reason` |
| Clinical | Separate chief complaint / history / examination / assessment fields; provisional vs confirmed flag; ICD codes | Combined into doctor notes on import |
| Procedure | Consent status, procedure checklist, contraindication review, staff sign-off, procedure scheduling/room, video | `18_procedures.csv` |
| IPD | Admission number, OT record, operating team, anaesthesia record, pre-op checklist, investigations, structured discharge medication, consent gate | `20_admissions.csv` |
| Pharmacy | Supplier master (vendor is free text), returns workflow, expiry block, substitution approval, batch-aware adjustments | `09_vendors`, `30_stock_adjustments` |
| Schedules | Leave, nurse roster, OT and room schedules; more than one session per doctor per day (DB is unique on doctor + weekday) | `04`, `05` |
| Finance | Partial payment, advance, refund/credit note, invoice cancellation audit, multi-line GST invoice, bill-of-supply document type, IGST on sales, GSTR-1 export, package expiry/cancel/refund, package-sale payment mode details, free-priced care order, back-dated invoice/payment dates | `25–29` |

### Defects found during inspection (to confirm in QA — no code was changed)
1. **Expired stock is dispensed** — `backend/src/common/decrement-stock.ts` sorts batches by expiry
   and takes the earliest, including expired ones (F3).
2. **Package session charged again** — a redeemed visit keeps `treatmentPrice`, and the patient
   bill (`queue.service.ts` `getBill`) charges it (K2).
3. **Pharmacy bill includes undispensed orders** — `getPharmacyBill` bills every non-cancelled
   medicine order (O2).
4. **Patient e-mail dropped** — `patients.service.ts` `create` never writes `email`.
5. **No duplicate-patient check** on registration (R2).
6. **Invoice delete is a hard delete** — no audit trail or credit note (B4).
7. **Manual stock adjustments don't change batch quantities** — batch totals drift from stock;
   a positive adjustment followed by a full dispense can hit the "Invariant violation" error (F8).
8. **Consultation fee is hard-coded GST-exempt** in `getBill` (G2).

---

## G. Reconciliation report
See **`reports/reconciliation.md`** (regenerated by `validate.mjs`): 42 checks (all passing),
record counts, duplicate checks, missing references, workload by day, bill/payment/outstanding
totals (correct rule vs app formula), payment totals by mode and by target, GST register totals
by source, line-level taxable vs exempt turnover, per-medicine stock movement, expected batch
balances, and the 30:20 count.

---

## H. Safe import plan

### H.1 Environment (isolated — nothing touches `dev.db` or your running servers)
| Piece | Value |
|---|---|
| Database | **new** SQLite file `test-data/derm-qa/runtime/qa-derm.db` (absolute `DATABASE_URL`) |
| Backend | second instance from `backend/dist`, **port 4100**, working directory `test-data/derm-qa/runtime` (so uploads go to `runtime/uploads/`, not your dev uploads) |
| Frontend | second Vite dev server on **port 3100** using a QA-only config file in `runtime/` that proxies `/api` → 4100 (no change to `frontend/vite.config.ts`) |
| Outbound | none — the backend has no e-mail/SMS/WhatsApp integration |
| Clean-up | stop the two processes and delete `runtime/` |

### H.2 Bootstrap (the only direct database write besides H.4)
`prisma db push` creates the empty schema in `qa-derm.db`. A small script inserts **one** test
clinic and **one** SUPER_ADMIN test account (`s00.super_admin@aurora-qa.test`). The repo's
`seed.ts` is **not** used (it creates the A2K demo clinic and demo data).

### H.3 API import (everything else, as the right role, in date order)
1. As admin: departments → 13 staff users → doctor schedules → treatments → package types →
   medicines (stock 0) → wards/beds (`QA Surgical Ward` B1–B4) → purchases with stock lines
   (receipts create the batches) → prescription templates.
2. As reception: 50 patients (capture UHIDs). Duplicate probes are **not** imported — they are QA steps.
3. Day by day across the window, per encounter: appointment (create / reschedule / cancel /
   no-show) → check-in with `queueDate` → doctor assess (as that doctor) → package sale +
   redemption → care orders → perform (staff) / dispense (pharmacist) → patient & pharmacy bill
   payment status with mode + details → Collect Payment invoice → admission (`admissionDate`),
   progress notes (nurse/doctor), medication orders + administrations, discharge → document
   uploads (placeholder files) → stock adjustments → retail sales → follow-up calls.
4. Scenario steps that must be **attempted, not forced** (results recorded, never worked around):
   flap admission without consent, expired-batch dispense, zero/insufficient stock dispense,
   duplicate invoice, invalid invoice, appointment-rule probes.
5. Import-day rows: live queue (waiting / with doctor / awaiting service / left).

### H.4 Timestamp alignment (direct write to the QA database only)
The API stamps invoices, bill payments, dispenses, care orders, notes, administrations and stock
movements with the import time, which would put four weeks of money and stock into one day and
make every date-range report meaningless. After the API import, one script updates **only those
timestamp columns in `qa-derm.db`** to the dataset's date/time for each record, logs every change
to `runtime/timestamp-alignment.log`, and never touches amounts, quantities or statuses.

### H.5 Verification (steps 8–10)
- API: counts per entity, UHIDs, bill/invoice totals, stock per medicine and batch, compared
  against `reports/reconciliation.md`; differences listed with the record IDs.
- UI (via the 3100 instance, as each role): reception queue and search, doctor assessment, pharmacy
  counter and expiry dashboard, IPD board, accounts summary, packages register, invoice prints.
- Output: `register/test-data-register.csv` (QA-P### ↔ UHID, encounters ↔ tokens/bill numbers,
  GI refs ↔ invoice numbers) and `reports/import-results.md` (failures, unsupported features,
  discrepancies). Nothing is reported as imported until it is read back from the app.

### H.6 Approvals needed before step 7
| # | Step | Why it needs approval |
|---|---|---|
| 1 | Create `runtime/qa-derm.db`, run a second backend (4100) and frontend (3100) | New database + processes on your machine |
| 2 | Direct insert of 1 clinic + 1 SUPER_ADMIN (H.2) | Bypasses the API (no endpoint can create the first admin) |
| 3 | Create 13 more **test** user accounts with the shared test password in that DB | User accounts, even fictional |
| 4 | Timestamp alignment (H.4) | Direct UPDATE of timestamp columns in the QA DB |
| 5 | Delete one invoice in the QA DB (cancelled-invoice scenario) | Destructive (QA DB only) |
| 6 | Upload ~60 placeholder files to `runtime/uploads/` | File writes |
