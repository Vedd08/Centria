# Product Requirements Document

**Product:** HMS — Hospital / Clinic Management System
**Reference deployment:** A2K Clinic
**Status:** Living document — updated phase by phase as scope is confirmed
**Last updated:** 2026-08-20

---

## 1. What We're Building

A multi-tenant clinic operations platform: one system of record that carries a patient
from front-desk check-in through consultation, ward stay, pharmacy, and billing —
without re-keying data at each handoff.

It is **multi-tenant by design**: a single deployment serves multiple hospitals/clinics
(`Clinic` is the tenant boundary), with a vendor-level platform layer sitting above
individual clinics for onboarding and subscription billing.

It is not a generic EHR and not aiming for one. The product is scoped to the workflows
a small-to-mid-size clinic actually runs day to day: queueing, OPD consultation, IPD
admission, pharmacy dispense, and GST-correct billing.

## 2. Targeted Users

The system is role-based. Each role gets its own landing screen and navigation — see
[Architecture.md](Architecture.md) for how roles map to routes.

| Role | Who they are | Primary job in the system |
|---|---|---|
| `SUPER_ADMIN` | Platform vendor / software owner | Onboards hospitals, manages subscriptions, cross-clinic support |
| `MASTER` | Hospital/clinic owner or admin | Full control of their one clinic — the "owner" role |
| `DOCTOR` | Consulting physician | Sees queue, consults, prescribes, orders care, admits/discharges |
| `RM` | Relationship Manager | Patient acquisition, referrals, commission tracking |
| `RECEPTION` | Front desk | Registration, check-in, appointments, billing intake |
| `PHARMACY` | Pharmacy counter staff | Dispenses prescriptions/care orders, manages stock |
| `ACCOUNT` | Accounts/finance staff | Invoices, purchases, commissions, reconciliation |
| `NURSE` | Ward nursing staff | IPD care tasks, medication administration, vitals/progress notes |
| `STAFF` | General service staff | OPD-side care tasks (procedures, dressing, etc.) |

**Current specialty focus:** clinical content (departments, prescription templates,
treatment masters) is prioritized for **Dermatologist, Pediatrician, and Plastic
Surgeon** practices first. The schema itself is specialty-agnostic (`Department` is a
free-form, per-clinic model) — this is a content/priority decision, not a hard
constraint, and widens as the product does.

## 3. Features (as built)

Grouped by the part of the patient/clinic journey they serve.

### Front desk & scheduling
- Patient registration with per-clinic UHID
- Appointments calendar (booking, check-in, no-show, completion)
- Reception desk: check-in, payments panel, printable patient bill

### Patient flow / queue
- Unified patient queue (`PatientQueue`) — the spine that ties reception → doctor →
  nurse/staff → pharmacy together for a single day's encounter
- Per-department daily token numbering
- Doctor routing decision (OPD continue vs. IPD admission request)

### OPD (outpatient)
- Doctor consultation workflow, diagnosis and notes
- Prescriptions, with per-doctor **prescription templates** ("saved recipes" for
  conditions treated often)
- Care orders (medicine / injection / treatment / other) ordered by the doctor and
  fulfilled by staff and pharmacy

### IPD (inpatient)
- Ward & bed management (availability, maintenance state)
- Admissions (admit, discharge, discharge summary)
- Medication orders + Medication Administration Record (MAR)
- Progress notes with vitals (BP, pulse, temperature, SpO2) and patient condition
  status (stable / needs attention / critical)
- IPD board (ward occupancy view)

### Pharmacy & inventory
- Medicine master with stock quantity, reorder point, GST flag
- Stock movements (in/out) with audit trail
- Pharmacy counter for dispensing prescriptions and care orders
- Purchases log with GST input tax classification (ITC eligibility)

### Billing & finance
- GST-correct invoicing (CGST/SGST split, taxable vs. exempt items)
- Treatment master (pricing, GST taxability per treatment)
- Packages (multi-sitting treatment packages, sittings used/remaining)
- Commissions (RM / operator / doctor / referring doctor, percentage or fixed)
- Accounts dashboard, purchases, reconciliation notes on invoices
- Visits log / day-book (the OPD/IPD financial+clinical ledger)

### Patient record
- Patient documents (lab reports, scan images, prescription scans, discharge
  summaries) with upload/download
- Patient history panel across visits, admissions, documents

### Platform / admin
- Platform console for the vendor (`SUPER_ADMIN`): manage hospitals, view per-hospital
  reports, step into a client hospital's data via clinic-context switch
- Per-clinic subscription (plan, billing day, status, payment history) — what the
  hospital pays the platform, kept separate from the clinic's own patient billing
- Admin panel (clinic owner): departments, users, treatments, wards
- Analytics dashboard
- Relationship Manager desk (RM's own book of business)

## 4. Non-Goals (for now)

- Not a general-purpose EHR with configurable clinical templates for every specialty
- Not handling insurance/TPA claims processing
- Not a telemedicine/video consultation product

## 5. Open / Phase-Wise Additions

This section grows as new requirements are confirmed with the user — do not assume a
feature is in scope just because it would be natural; add it here first, then build it.

- _(empty — add future feature asks here before implementing)_
