# Engineering Rules

**Last updated:** 2026-08-20
**Audience:** contributors and AI agents working in this repo

---

## 1. What to Use

**Backend**
- NestJS module pattern for every feature: `module.ts` + `controller.ts` +
  `service.ts` + `dto/*.dto.ts`. Don't put logic directly in controllers — controllers
  parse/authorize, services do the work.
- Prisma Client for **all** database access. No raw SQL, no query builders.
- `class-validator` / `class-transformer` DTOs on every request body — the global
  `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true`) rejects anything
  that isn't declared, so an undeclared field is a bug, not a pass-through.
- `@Roles(...)` + `RolesGuard` on every endpoint that isn't meant to be universally
  accessible. Mirror the same restriction in `frontend/src/config/navigation.ts`
  (`allowedRoles`) — the two must never drift apart.
- `clinicId` scoping on every query touching a tenant-owned model. See
  [Architecture.md](Architecture.md) §Multi-tenancy.
- `@CurrentUser()` decorator to read the authenticated user, not manual JWT parsing.

**Frontend**
- Function components + hooks only.
- Tailwind utility classes, using the tokens defined in `tailwind.config.js`
  (`brand`, `shell`, `surface`, `ink`, `triage`, `status`, `border`) — see
  [Design.md](Design.md). Don't reach for arbitrary hex values in `className` when a
  token already exists for that purpose.
- `lucide-react` for icons — don't add a second icon library.
- `AuthContext` / `ToastContext` for auth state and user-facing error/success
  messages. Don't invent a parallel global-state mechanism for something that fits an
  existing context.
- `react-big-calendar` + `date-fns` for anything calendar/scheduling-shaped.

## 2. What to Avoid

- **Raw SQL or `$queryRaw`** unless a Prisma query genuinely cannot express the
  need — and even then, flag it for review rather than reaching for it by default.
- **Skipping `clinicId` on a query.** This is not a style preference — an unscoped
  query is a cross-tenant data leak. Treat it the same severity as an auth bypass.
- **Hardcoding specialty/department lists** in code. `Department` is a per-clinic,
  dynamic model on purpose (a 50-doctor hospital and a 3-specialty clinic both need to
  configure their own). See `project_specialty_scope` context: the current *content*
  priority is Dermatology / Pediatrics / Plastic Surgery, but that's a prioritization
  choice, not a schema constraint — don't bake it into the data model.
- **Introducing a new role** without updating all three places it's referenced:
  `schema.prisma` (`User.role` comment), `frontend/src/config/navigation.ts`
  (`NavTab`, `allowedRoles`, `DEFAULT_TAB_BY_ROLE`), and `prisma/seed.ts`.
- **Ad-hoc error handling that duplicates `PrismaExceptionFilter`.** Don't wrap
  Prisma calls in try/catch to re-map error codes per-service — the global filter
  already does this centrally (P2002 duplicate, P2003 FK violation, P2025 not found,
  P2028 txn timeout). Add new mappings there, not locally.
- **Flipping `strictNullChecks` / `noImplicitAny` on in `backend/tsconfig.json`**
  without a dedicated cleanup pass. They're off deliberately for now; turning them on
  incidentally as part of an unrelated change will produce a wall of unrelated errors.
- **Premature abstraction.** Follow the top-level repo convention: three similar
  lines beat a speculative shared helper; don't design for hypothetical future
  specialties, roles, or modules that haven't been asked for.
- **Comments that explain "what."** This codebase's existing comments (see
  `schema.prisma`, `clinic-context.interceptor.ts`) explain *why* — a non-obvious
  constraint or the reason a shortcut exists — never what the next line of code
  visibly does. Match that style.

## 3. Libraries — Current Set

Don't add a new library for something an existing dependency already covers. Current
inventory (see `backend/package.json` / `frontend/package.json` for exact versions):

- **Backend:** `@nestjs/*`, `@prisma/client` + `prisma`, `bcrypt`, `passport` +
  `passport-jwt` + `@nestjs/jwt`, `class-validator` + `class-transformer`, `rxjs`.
- **Frontend:** `react` + `react-dom`, `vite`, `tailwindcss`, `lucide-react`,
  `react-big-calendar`, `date-fns`.
- **No test framework is configured yet** in either package (no `*.spec.ts`, no Jest
  config). If a task requires tests, that's a setup decision to raise with the user
  first — don't silently bootstrap a test runner as a side effect of an unrelated
  change.
- **No UI component library** beyond Tailwind + hand-built components in
  `components/common/`. Don't introduce one (MUI, Chakra, shadcn, etc.) without
  discussing it — it would conflict with the custom "Ward Board" design system.

## 4. Error Handling

- **Backend:** validation errors surface automatically via `ValidationPipe`. Domain
  errors (not found, conflict, etc.) should be thrown as Nest `HttpException`
  subclasses (`NotFoundException`, `ConflictException`, `ForbiddenException`, ...) in
  services; Prisma-level errors are caught centrally by `PrismaExceptionFilter` — do
  not duplicate that mapping in individual services.
- **Frontend:** surface errors to the user via `ToastContext`, not `alert()` or
  silent console-only failures. `ErrorBoundary` (in `components/common/`) exists for
  render-time failures — wrap new top-level screens if they're not already covered by
  an ancestor boundary.

## 5. Boundaries for AI Agents

- **Never** write a Prisma query against a tenant-owned model without a `clinicId`
  filter (directly, or transitively through a relation that's already scoped).
- **Never** relax `forbidNonWhitelisted`/`whitelist` on the global `ValidationPipe`,
  or add `@Allow()` escape hatches, to make an integration "just work" — fix the DTO
  instead.
- **Ask before** any Prisma migration that could be destructive (dropping/renaming a
  column, changing a type in a way that loses data) — see the repo-wide git safety
  rules; this applies doubly to schema changes since they're much harder to undo once
  deployed against a real hospital's data.
- **Ask before** touching billing-adjacent calculation logic without flagging it
  explicitly: GST split (CGST/SGST), commission calculation
  (`CommissionRule`/`CommissionRecord`), subscription billing, package
  sittings-remaining math, and stock decrement logic
  (`common/decrement-stock.ts`). These are the places where a subtle bug becomes a
  real invoice or a real stock discrepancy, not just a UI glitch.
- **Don't** widen the current specialty/content scope (Dermatology, Pediatrics,
  Plastic Surgery) into generic multi-specialty content unless the user asks —
  the architecture already supports it; the product content does not need to yet.
- **Do** keep `docs/phase.md` and `docs/memory.md` current when you complete
  meaningful chunks of work — they are how continuity across sessions is maintained.
