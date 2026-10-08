# Production Deployment Checklist

Before deploying the Hospital Management System to a production environment, ensure the following checklist is completed:

## 1. Database Migration (SQLite to PostgreSQL)
- [ ] Update `prisma/schema.prisma` to use `provider = "postgresql"`.
- [ ] Ensure the `DATABASE_URL` environment variable points to a secure PostgreSQL instance.
- [ ] Run `npx prisma migrate deploy` in the production environment (do not use `db push` for prod).

## 2. Security & Secrets
- [ ] **Rotate JWT Secret**: The default `JWT_SECRET` in `.env` must be changed to a strong, cryptographically secure random string.
- [ ] Ensure `NODE_ENV` is set to `production`.
- [ ] Disable CORS wildcards (`*`) in `backend/src/main.ts` and restrict it to your actual frontend domain.

## 3. Data Safety
- [ ] **Disable Demo Seed**: Ensure that `ALLOW_DEMO_SEED=false` in the `.env` file to prevent accidental wiping of production data on startup.
- [ ] Setup automated daily backups for your PostgreSQL database.

## 4. Performance
- [ ] Ensure both backend (`npm run build`) and frontend (`npm run build`) are built in production mode.
- [ ] Start the backend with `node dist/main` (or via a process manager like PM2), not `npm run start:dev`.
- [ ] Serve the frontend via a robust static server or CDN (e.g., Nginx, Vercel).
