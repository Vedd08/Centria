# Project Phases

**Last updated:** 2026-08-20
**How to read this file:** each phase is a coherent chunk of the product, not a fixed
calendar slice. Mark a phase `✅ Done`, `🔄 In Progress`, or `⏳ Planned`. When a phase
completes, update this file and reflect the summary in [memory.md](memory.md).

---

## Phase 0 — Foundation ✅ Done
*Commit: `aa18dd7` Initial commit*

- NestJS + Prisma + SQLite backend scaffolded, module-per-feature structure
- React + Vite + Tailwind frontend scaffolded
- Core data model: Patient, Visit, TreatmentMaster, Prescription, Medicine, Invoice
- JWT auth, role-based guard, 9-role user model
- Multi-clinic (`Clinic`) tenant boundary established from day one

## Phase 1 — Clinical Pipeline & Correctness ✅ Done
*Commit: `e3e386e` Add clinical pipeline, admin panels, and fix money/stock correctness*

- OPD/IPD split, wards & beds, admissions, medication orders + MAR, progress notes
- Patient documents, patient queue as the cross-module workflow spine
- Care orders (medicine/injection/treatment) bridging doctor → staff → pharmacy
- Prescription templates (doctor's saved recipes)
- Admin panels (departments, users, treatments, wards)
- Money/stock correctness fixes: GST split accuracy, stock decrement correctness

## Phase 2 — Visual Identity ✅ Done
*Commit: `68141ab` Apply Ward Board design tokens and A2K branding*

- "Ward Board" design system defined (dark chrome / light data-card inversion,
  triage-language status colors) — see [Design.md](Design.md)
- A2K Clinic branding applied across the app
- Archivo + IBM Plex Sans/Mono typography system

## Phase 3 — Relationship Management & Session Isolation ✅ Done
*Commit: `096cc89` Add the relationship manager's desk, and isolate sessions per browser tab*

- RM desk: relationship manager's book of business and commission visibility
- Per-tab session isolation (multiple staff logins in the same browser without
  clobbering each other's auth state)

## Phase 4 — OPD → IPD Admission Requests & Ward Condition Tracking ✅ Done
*Commit: pending*

- Doctors can flag an OPD queue entry as an admission request.
- Patient condition-status vocabulary (stable / needs attention / critical) surfaced on the IPD board and progress notes.


## Phase 5 — Hardening ✅ Done
*Commit: pending*

- Automated tests established (Backend Jest/e2e scaffold, Frontend Vitest/RTL component test scaffold)
- Re-enabled `strictNullChecks` / `noImplicitAny` in `backend/tsconfig.json` (codebase remains 100% clean)
- Production deployment checklist added (`docs/production-checklist.md`)

## Phase 6 — Billing & Appointment Slots ✅ Done
*Commit: pending*

- Dynamic Tax Rates & HSN: HSN/SAC codes and item-specific tax rates applied to TreatmentMaster and MedicineMaster.
- Billing UI updated to itemize HSN/SAC and dynamic GST percentages in the Patient Bill and Invoice Modals.
- Doctor Appointment Scheduling System: Replaced free-form datetime with configured time slots restricted to DoctorSchedule boundaries and duration rules.

## Phase 7 — Pharmacy Module Expansion ✅ Done
*Commit: pending*

- Exclusive Pharmacy Billing: Pharmacists manage billing for all medicines/injections separately from Reception.
- OPD vs IPD filtering in Pharmacy queue.
- Walk-ins (OPD) use a new "Bill & Dispense" flow to generate an independent Pharmacy Tax Invoice.
- Admitted patients (IPD) use a "Dispense to Ward" flow where medicines are dispensed and charged to their final discharge bill.

## Phase 8 — Analytics & Reporting Depth ✅ Done
*Commit: pending*

- Four report areas behind tabs on `AnalyticsDashboard`, each with a chart, a table
  view and a CSV export: **Money & GST** (daily collections by payment mode, GST
  totals by filing rate, unreconciled, what was sold), **Doctors & RM** (visits and
  revenue per doctor, commission per beneficiary), **Pharmacy** (stock valuation,
  expiry windows, fast/slow movers, below reorder point), **Patient flow** (wait
  times, OPD/IPD load, queue outcomes, follow-up adherence).
- Backing endpoints: `/api/analytics/collections`, `/doctors`, `/pharmacy`,
  `/patient-flow` — each clinic-scoped and role-gated.
- One printable clinic report on the clinic's letterhead covering every section the
  role may see.
- Chart primitives live in `components/Analytics/charts.tsx`; no charting library —
  see [Design.md](Design.md) §3 for the validated series palette.
- Fixed: date ranges started a day early (`toISOString()` shifts a local midnight to
  the previous day east of Greenwich).

## Phase 9 — Pharmacy Retail Counter & Batch Traceability ✅ Done
*Commit: pending*

- Retail POS for over-the-counter sales (`RetailPOS`), independent of a patient
  encounter, issuing its own tax invoice via the `retail-sales` module.
- Batch-level stock: `MedicineBatch` / `BatchDispenseRecord`, FEFO deduction through
  `decrement-stock`, batch trace from a dispensed unit back to its purchase.
- Expiry dashboard, stock refill flow (`refill-stock.dto`), and a shelf view of the
  catalogue as it is physically arranged.

## Phase 10 — Centria Identity & Document Letterheads ✅ Done
*Commit: pending*

- The software is branded **Centria**: palette resampled from the logo (navy chrome,
  blue→teal brand), transparent logo cuts in `frontend/src/assets/brand/`, shown via
  `BrandLogo` in the nav, login, loading screen, footer, print footers and favicon.
- Printed documents take their letterhead from the clinic record
  (`GET /api/clinics/me`, merged with the GST identifiers in settings) instead of a
  hardcoded clinic name, so each tenant prints as itself.
- Printing fixed: documents render through `PrintPortal` as a sibling of `#root`, so
  the screen behind a modal no longer prints with the bill; modal documents fill the
  sheet rather than printing as a grey box.

---

_Add new phases at the bottom as they're identified. Don't reorder completed phases —
this file is a history as much as a plan._
