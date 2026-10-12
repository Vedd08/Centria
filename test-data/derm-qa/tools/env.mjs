/**
 * [TEST DATA] Shared settings for the isolated QA environment.
 * The QA database, uploads and compiled backend all live under test-data/derm-qa/runtime/.
 * Nothing here points at backend/prisma/dev.db.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const QA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.resolve(QA_DIR, '..', '..');
export const BACKEND = path.join(REPO, 'backend');
export const RUNTIME = path.join(QA_DIR, 'runtime');
export const DATA = path.join(QA_DIR, 'data');
export const DB_FILE = path.join(RUNTIME, 'qa-derm.db');
export const DB_URL = `file:${DB_FILE.replace(/\\/g, '/')}`;
export const PORT = 4100;
export const API = `http://localhost:${PORT}/api`;

if (path.resolve(DB_FILE) === path.resolve(BACKEND, 'prisma', 'dev.db')) throw new Error('Refusing to use dev.db');

fs.mkdirSync(RUNTIME, { recursive: true });
const secretFile = path.join(RUNTIME, '.qa-secret');
if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(32).toString('hex'));
export const JWT_SECRET = fs.readFileSync(secretFile, 'utf8').trim();

/** Resolve packages (Prisma client, bcrypt) from the backend's node_modules. */
export const backendRequire = createRequire(path.join(BACKEND, 'package.json'));

export function prisma() {
  process.env.DATABASE_URL = DB_URL;
  const { PrismaClient } = backendRequire('@prisma/client');
  return new PrismaClient({ datasources: { db: { url: DB_URL } } });
}

// ── CSV reader (same rules as validate.mjs) ──
export function readCsv(name) {
  const file = fs.readdirSync(DATA).find((f) => f.startsWith(name));
  const text = fs.readFileSync(path.join(DATA, file), 'utf8').replace(/^﻿/, '');
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1 || r[0] !== '');
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

export const STATE_FILE = path.join(RUNTIME, 'import-state.json');
export const loadState = () => (fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {});
export const saveState = (s) => fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));

/** Today's date in IST — the import day for live-queue rows. */
export const importDay = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
