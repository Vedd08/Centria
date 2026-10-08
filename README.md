# Hospital-Management-System

## Documentation

Project docs live in [`docs/`](docs/):

- [PRD.md](docs/PRD.md) — what we're building, who for, and the feature set
- [Architecture.md](docs/Architecture.md) — app flow, multi-tenancy model, folder structure
- [rules.md](docs/rules.md) — libraries, conventions, error handling, AI agent boundaries
- [phase.md](docs/phase.md) — the project broken into phases
- [Design.md](docs/Design.md) — the "Ward Board" color, type, and design system
- [memory.md](docs/memory.md) — running log of what's done and what's in progress

## Deployment

The backend server relies on the Indian Standard Time (IST) timezone. Ensure that `TZ=Asia/Kolkata` is set in the environment variables where the backend is deployed (e.g. `.env`, Dockerfile, or cloud host configuration).

## Database Schema Changes (Development)

Until the first PostgreSQL production deploy, `prisma db push` is the only mechanism for schema changes on `dev.db`.
Follow this strict workflow for schema changes:
1. Edit `schema.prisma`.
2. Back up `dev.db`.
3. Preview changes with:
   `prisma migrate diff --from-url file:<dev.db> --to-schema-datamodel prisma/schema.prisma --script`
4. If the preview contains `DROP`, `RedefineTables`, or `new_` tables, **STOP and report** before applying anything.
5. Otherwise, apply changes with `npm run prisma:push` (which runs `prisma db push`).
6. Run the idempotent backfill scripts:
   - `npx ts-node scripts/backfill-opening-sittings.ts`
   - `npx ts-node scripts/fix-slotkey.ts`

Note: Do not create a migration baseline now. That will happen once at the first PostgreSQL deploy.
