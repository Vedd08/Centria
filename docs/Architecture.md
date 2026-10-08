# Architecture

**Last updated:** 2026-08-20

---

## 1. Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, Vite 5, Tailwind CSS 3 |
| Backend | NestJS 10 (Express), TypeScript |
| ORM | Prisma 5 |
| Database | SQLite (local dev) → PostgreSQL (production), switched via `DATABASE_URL` |
| Auth | JWT (`@nestjs/jwt`, `passport-jwt`), bcrypt password hashing |
| Icons | lucide-react |
| Calendar | react-big-calendar + date-fns |

No frontend state-management library beyond React Context (`AuthContext`,
`ToastContext`) — deliberate, not an oversight. No test framework is wired up yet in
either package.

## 2. App Flow

```
Browser (React SPA)
  │  fetch, JWT in Authorization header, x-clinic-id header for platform admins
  ▼
NestJS HTTP layer  (global prefix: /api)
  │
  ├─ ValidationPipe        → whitelist + forbidNonWhitelisted: unknown/invalid
  │                          fields are rejected with 400 before reaching a service
  ├─ ClinicContextInterceptor → lets SUPER_ADMIN "step into" a client hospital via
  │                             the x-clinic-id header; every other role is scoped
  │                             to their own clinicId, full stop
  ├─ DecimalSerializerInterceptor → Prisma Decimal → JSON number
  ├─ JwtAuthGuard + RolesGuard (@Roles() decorator, per-route)
  │
  ▼
Feature module (controller → service → Prisma)
  │
  ▼
PrismaExceptionFilter → maps Prisma error codes (P2002 dup, P2003 FK, P2025 not
                         found, P2028 txn timeout) to actionable HTTP responses
  │
  ▼
Prisma Client → SQLite (dev) / PostgreSQL (prod)
```

### Multi-tenancy

`Clinic` is the tenant boundary. Almost every domain model carries a `clinicId` and
every service query is expected to filter by it. There is no row-level security at the
database layer — tenant isolation is enforced entirely in application code via:

1. The JWT's `clinicId` claim, scoping normal users to their own clinic.
2. `ClinicContextInterceptor`, which allows only `SUPER_ADMIN` to override that scope
   (via `x-clinic-id`) to support a client hospital — every other role has the header
   silently ignored.

**This means every new query in every service must include a `clinicId` filter.**
Skipping it is a cross-tenant data leak, not just a bug — see [rules.md](rules.md).

### Roles

`SUPER_ADMIN`, `MASTER`, `DOCTOR`, `RM`, `RECEPTION`, `PHARMACY`, `ACCOUNT`, `NURSE`,
`STAFF` (see `backend/prisma/schema.prisma` → `User.role` comment, and
`frontend/src/config/navigation.ts` for what each role can see). `SUPER_ADMIN` is the
platform vendor and is deliberately excluded from the clinical navigation — when
working inside a client hospital it navigates as `MASTER` would
(`effectiveRoleFor()` in `navigation.ts`).

### The queue as the domain spine

`PatientQueue` is the model that ties the whole daily workflow together: reception
check-in → doctor assessment → staff/nurse service → pharmacy dispense. A queue entry
optionally resolves into a `Visit` (OPD) or an `Admission` (IPD), and carries
`CareOrder` rows (medicine/injection/treatment/other) that the doctor orders and staff
or pharmacy fulfill. When touching cross-module workflow logic, start by understanding
this model (`backend/prisma/schema.prisma`, `PatientQueue` and `CareOrder`).

## 3. Folder Structure

```
backend/
  prisma/
    schema.prisma          — single source of truth for the data model
    migrations/
    seed.ts                — demo data across all 9 roles + sample clinical data
  src/
    main.ts                — bootstrap: global pipes/guards/interceptors/filters
    app.module.ts           — module registry (one entry per feature below)
    common/
      decorators/            — cross-cutting decorators
      filters/                — PrismaExceptionFilter
      interceptors/           — ClinicContextInterceptor, DecimalSerializerInterceptor
      decrement-stock.ts      — shared stock-mutation helper
    auth/                    — login, JWT strategy, RolesGuard, @Roles()/@CurrentUser()
    prisma/                  — PrismaModule/PrismaService wrapper
    <feature>/               — one folder per domain area, each following:
                                 <feature>.module.ts
                                 <feature>.controller.ts
                                 <feature>.service.ts
                                 dto/*.dto.ts
  # Feature modules (one per bounded area of the product):
  # patients, treatments, visits, packages, commissions, invoices, users,
  # medicines, prescriptions, prescription-templates, purchases, analytics,
  # settings, clinics, appointments, wards, admissions, medication-orders,
  # patient-documents, queue, care-orders, accounts, admin, platform,
  # departments, rm, health

frontend/
  src/
    main.tsx, App.tsx        — entry point and top-level route/tab switch
    config/navigation.ts     — per-role nav items, default landing tab, icons
    context/                  — AuthContext, ToastContext
    types/                     — shared TS types (auth.ts, etc.)
    utils/                      — money.ts, exportToCsv.ts
    components/
      <Feature>/                — one folder per screen/domain, mirroring the
                                    backend's feature boundaries (Patients, Queue,
                                    IPD, OPD, Reception, Pharmacy, Invoices,
                                    Packages, Prescriptions, Templates, Purchases,
                                    Commissions, Wards, Departments, Users, Clinics,
                                    Platform, Accounts, Admin, Analytics, RM,
                                    Appointments, Calendar, DayBook, Visits, ...)
      common/                    — shared primitives (StatusBadge, ConfirmDialog,
                                    Pagination, ErrorBoundary, CareRail, ...)
```

**Convention:** a backend feature folder name (`queue`, `admissions`, `wards`, …)
should have a matching frontend component folder (`Queue`, `IPD`, `Wards`, …). When
adding a new domain area, create both sides following this pairing rather than folding
a new concept into an existing module.

## 4. Design System Reference

The visual system ("Ward Board") is documented separately in
[Design.md](Design.md) — do not restate color/typography decisions here; that file is
the source of truth and is generated from `frontend/tailwind.config.js` and
`frontend/src/index.css`.

## 5. Environments

- `.env` / `.env.example` present in both `backend/` and `frontend/` — copy the
  example and fill in secrets locally; never commit real `.env` values.
- `JWT_SECRET` must be set outside local dev — `main.ts` warns loudly and falls back
  to an insecure default if it's missing.
- Demo seeding (`prisma/seed.ts`) is blocked in `production` unless
  `ALLOW_DEMO_SEED=true` is explicitly set.
