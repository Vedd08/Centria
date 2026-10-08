# Project Memory

**Purpose:** a running log of what's done and what's currently being touched, so a new
session (human or AI) can pick up context fast without re-reading the whole diff
history. This file is intentionally light at project start — it earns its keep once
work is in flight. Update it at the end of any meaningful chunk of work.

**Format:** newest entry at the top. Keep entries short — a sentence or two per file,
not a diff summary. Link to [phase.md](phase.md) for the larger arc.

---

## Currently Being Worked On

_(update this section as work moves — this is the "where do I resume" section)_

- (Nothing currently active — Phases 8–10 just closed out)

## Completed

- **2026-09-17 — Phase 8** — Analytics depth: Money & GST, Doctors & RM, Pharmacy and
  Patient-flow reports, each with chart + table + CSV, plus one printable clinic report.
  Chart primitives in `components/Analytics/charts.tsx` (no charting library).
- **2026-09-17 — Phase 10** — Letterheads now come from the clinic record via
  `GET /api/clinics/me` (name/address/contact from the `Clinic` row, GSTIN and state code
  from settings). Printing goes through `PrintPortal`, which fixed documents printing the
  screen behind them.
- **2026-09-15 — Phase 10** — Centria branding — palette resampled from
  `frontend/src/assets/CENTRIA.jpeg` (navy chrome, blue→teal brand), transparent logo cuts
  in `src/assets/brand/`, shown via `BrandLogo` in the nav, login, loading screen, footer
  and every print footer. See [Design.md](Design.md) §2.
- **Phase 9** — Pharmacy retail counter, batch traceability, expiry dashboard, stock
  refill and shelf view.

**Not committed on purpose:** `backend/update_passwords.ts` — a local scratch script that
resets every user's password to a hardcoded string. Keep it out of git.

- **Phase 7** — Pharmacy Module Expansion: Exclusive Pharmacy Billing (independent Pharmacist invoices), OPD vs IPD Ward Queue filtering, and exact CGST/SGST breakdowns for dispensed medicines.

- **Phase 6** — Billing & Appointment Slots: Dynamic HSN/SAC and itemized GST percentages in billing, plus Doctor Schedule configuration enforcing slotted appointments.

- **Phase 5** — Hardening: Scaffolded automated testing (Jest/Vitest), enforced strict TypeScript rules, and drafted the production checklist.

- **Phase 4** — OPD → IPD admission-request flow and ward patient-condition tracking.
- **2026-08-20:** Authored the six project docs in `docs/` (`PRD.md`,
  `Architecture.md`, `rules.md`, `phase.md`, `Design.md`, this file) from the actual
  codebase state — not aspirational, reflects what's built as of this date.
- **Phase 3** — RM desk + per-browser-tab session isolation. See `git log` commit
  `096cc89`.
- **Phase 2** — Ward Board design tokens + A2K branding applied app-wide. See commit
  `68141ab`, and [Design.md](Design.md) for the resulting system.
- **Phase 1** — Clinical pipeline (OPD/IPD, wards, admissions, MAR, progress notes,
  care orders, prescription templates), admin panels, money/stock correctness fixes.
  See commit `e3e386e`.
- **Phase 0** — Initial scaffold: NestJS + Prisma + React, core patient/visit/billing
  model, JWT auth, 9-role model, multi-clinic tenancy. See commit `aa18dd7`.

---

_When closing out a phase: move its summary here in one or two lines, mark it ✅ Done
in [phase.md](phase.md), and clear the "Currently Being Worked On" section for the
next thing._
