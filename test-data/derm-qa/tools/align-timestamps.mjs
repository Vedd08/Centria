#!/usr/bin/env node
/**
 * [TEST DATA] Step H.4 — move the "now" timestamps the API stamped during import to the
 * dataset's intended date/time, so date-range reports cover the 4-week window.
 *
 * Approved by the user. Writes ONLY to runtime/qa-derm.db, ONLY to the timestamp columns
 * listed in FIELDS (never amounts, quantities or statuses), and logs every change to
 * runtime/timestamp-alignment.log. Safe to re-run (it re-applies the same values).
 */
import fs from 'node:fs';
import path from 'node:path';
import { RUNTIME, loadState, prisma } from './env.mjs';

const FIELDS = {
  patient: ['createdAt'], visit: ['createdAt'], patientQueue: ['createdAt', 'checkedInAt', 'seenAt', 'completedAt'],
  careOrder: ['createdAt', 'performedAt', 'dispensedAt'], batchDispenseRecord: ['createdAt'], stockMovement: ['createdAt'],
  invoice: ['createdAt', 'issuedAt'], encounterBill: ['createdAt', 'paidAt'], packagePurchase: ['createdAt'], appointment: ['createdAt'],
  patientDocument: ['createdAt'], admission: ['createdAt', 'dischargeDate'], progressNote: ['createdAt', 'recordedAt'],
  medicationOrder: ['createdAt'], medicationAdministration: ['createdAt', 'administeredAt'], commissionRecord: ['createdAt'],
  followUpCall: ['createdAt'], purchase: ['createdAt'], medicineBatch: ['createdAt'], retailSale: ['createdAt'], prescription: ['createdAt'],
};

const state = loadState();
const entries = state.align || [];
const db = prisma();
const logFile = path.join(RUNTIME, 'timestamp-alignment.log');
const out = fs.createWriteStream(logFile, { flags: 'w' });
out.write(`# [TEST DATA] timestamp alignment run ${new Date().toISOString()} — QA database only\n`);

let applied = 0, skipped = 0;
for (const e of entries) {
  const allowed = FIELDS[e.model];
  if (!allowed) { skipped++; continue; }
  const data = {};
  for (const [k, v] of Object.entries(e.times)) if (allowed.includes(k) && v) data[k] = new Date(v);
  if (!Object.keys(data).length) { skipped++; continue; }
  if (e.id) {
    const before = await db[e.model].findUnique({ where: { id: e.id }, select: Object.fromEntries(Object.keys(data).map((k) => [k, true])) });
    if (!before) { skipped++; continue; }
    // Only fill timestamps the app actually set (e.g. never invent a dispensedAt).
    for (const k of Object.keys(data)) if (k !== 'createdAt' && before[k] === null) delete data[k];
    if (!Object.keys(data).length) { skipped++; continue; }
    await db[e.model].update({ where: { id: e.id }, data });
    out.write(`${e.model}\t${e.id}\t${Object.entries(data).map(([k, v]) => `${k}: ${before[k]?.toISOString?.() ?? before[k]} -> ${v.toISOString()}`).join('; ')}\n`);
  } else {
    const rows = await db[e.model].findMany({ where: e.where, select: { id: true, ...Object.fromEntries(Object.keys(data).map((k) => [k, true])) } });
    for (const r of rows) {
      const d = { ...data };
      for (const k of Object.keys(d)) if (k !== 'createdAt' && r[k] === null) delete d[k];
      if (!Object.keys(d).length) continue;
      await db[e.model].update({ where: { id: r.id }, data: d });
      out.write(`${e.model}\t${r.id}\t${Object.entries(d).map(([k, v]) => `${k}: ${r[k]?.toISOString?.() ?? r[k]} -> ${v.toISOString()}`).join('; ')}\n`);
    }
  }
  applied++;
}
out.end();
await db.$disconnect();
console.log(`[TEST DATA] aligned ${applied} entries (${skipped} skipped — no applicable field). Log: ${logFile}`);
