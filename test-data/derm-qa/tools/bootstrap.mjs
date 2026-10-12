#!/usr/bin/env node
/**
 * [TEST DATA] Step H.2 — create the empty QA database and the one record the API cannot:
 * the test clinic and its first SUPER_ADMIN. Everything else is created through the API.
 * Approved by the user. Refuses to run if the QA database already has a clinic.
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { BACKEND, DB_FILE, DB_URL, backendRequire, prisma, readCsv } from './env.mjs';

if (fs.existsSync(DB_FILE)) {
  const db = prisma();
  const n = await db.clinic.count();
  await db.$disconnect();
  if (n > 0) { console.log(`QA database already bootstrapped (${n} clinic). Delete runtime/ to start over.`); process.exit(0); }
}

console.log('Creating schema in', DB_FILE);
execSync('npx prisma db push --skip-generate --accept-data-loss', {
  cwd: BACKEND, stdio: 'inherit', env: { ...process.env, DATABASE_URL: DB_URL },
});

const cfg = readCsv('00_')[0];
const bcrypt = backendRequire('bcrypt');
const db = prisma();
const clinic = await db.clinic.create({
  data: { name: cfg.clinicName, address: cfg.clinicAddress, phone: cfg.clinicPhone, email: cfg.clinicEmail },
});
await db.user.create({
  data: {
    email: 's00.super_admin@aurora-qa.test', passwordHash: await bcrypt.hash(cfg.testPassword, 10),
    name: 'QA Platform Admin (Test)', role: 'SUPER_ADMIN', clinicId: clinic.id,
  },
});
await db.$disconnect();
console.log(`[TEST DATA] Bootstrapped clinic "${clinic.name}" (${clinic.id}) + SUPER_ADMIN s00.super_admin@aurora-qa.test`);
