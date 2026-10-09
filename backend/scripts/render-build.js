// Production build for Render (or any host running Postgres).
//
// schema.prisma targets SQLite so local development keeps using dev.db. Prisma
// cannot pick a provider from an env var, so this derives a Postgres copy of the
// schema, syncs it to DATABASE_URL, builds the app, and seeds demo data only
// when the database is empty — redeploys never overwrite what testers entered.
//
// Usage (from backend/): DATABASE_URL=postgresql://... node scripts/render-build.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const backendDir = path.join(__dirname, '..');
const run = (cmd) => execSync(cmd, { cwd: backendDir, stdio: 'inherit' });

if (!/^postgres(ql)?:/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('DATABASE_URL must be a postgresql:// connection string for a production build.');
}

const sqliteSchema = fs.readFileSync(path.join(backendDir, 'prisma', 'schema.prisma'), 'utf8');
const pgSchema = sqliteSchema.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
if (pgSchema === sqliteSchema) {
  throw new Error('Could not find provider = "sqlite" in prisma/schema.prisma.');
}
const pgSchemaPath = 'prisma/schema.postgres.prisma';
fs.writeFileSync(path.join(backendDir, pgSchemaPath), pgSchema);

run(`npx prisma generate --schema ${pgSchemaPath}`);
// No --accept-data-loss: a destructive schema change fails the deploy instead of dropping data.
run(`npx prisma db push --schema ${pgSchemaPath} --skip-generate`);
run('npm run build');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user
  .count()
  .then((users) => {
    if (users > 0) {
      console.log(`Database already has ${users} users; skipping demo seed.`);
      return;
    }
    console.log('Empty database; loading demo seed.');
    run('npm run prisma:seed');
  })
  .finally(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
