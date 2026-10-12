#!/usr/bin/env node
/**
 * [TEST DATA] Steps 8–10 — read the imported records back through the application's API
 * (as the role that would normally look at them), compare with the dataset, and write:
 *   reports/import-results.md          — what matched, what didn't, probe outcomes, gaps
 *   register/test-data-register.csv     — QA-P### ↔ app UHID, for the manual QA checklist
 *   register/encounters-register.csv    — E#### ↔ token, bill numbers, invoice numbers
 *   reports/gstr1_TEST_from_app.csv     — GSTR-1 style test summary rebuilt from app invoices
 * Read-only against the QA database (opening a bill only reads its existing number).
 */
import fs from 'node:fs';
import path from 'node:path';
import { API, QA_DIR, RUNTIME, loadState, readCsv } from './env.mjs';

const state = loadState();
const cfg = readCsv('00_')[0];
const staff = readCsv('02_'), patients = readCsv('12_'), appts = readCsv('14_'), encs = readCsv('16_'), orders = readCsv('17_');
const pps = readCsv('19_'), adms = readCsv('20_'), pnotes = readCsv('21_'), mas = readCsv('23_'), docs = readCsv('24_');
const bills = readCsv('25_'), gst = readCsv('26_'), meds = readCsv('08_'), batches = readCsv('11_'), ledger = readCsv('31_');
const retail = readCsv('28_'), adjs = readCsv('30_'), b2csExp = readCsv('35_'), exemptExp = readCsv('36_');
const STAFF = Object.fromEntries(staff.map((s) => [s.staff_id, s]));
const REGISTER = path.join(QA_DIR, 'register'), REPORTS = path.join(QA_DIR, 'reports');
fs.mkdirSync(REGISTER, { recursive: true });

const tokens = {};
async function get(who, url) {
  if (!tokens[who]) {
    const email = who === 'S00' ? 's00.super_admin@aurora-qa.test' : STAFF[who].email;
    const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: cfg.testPassword }) });
    tokens[who] = (await r.json()).accessToken;
  }
  const r = await fetch(`${API}${url}`, { headers: { Authorization: `Bearer ${tokens[who]}` } });
  const d = await r.json();
  if (!r.ok) throw new Error(`${url} → ${r.status} ${JSON.stringify(d.message)}`);
  return d;
}
const list = (d) => (Array.isArray(d) ? d : d.data);
const num = (v) => Number(v ?? 0);
const r2 = (n) => Math.round(n * 100) / 100;
const money = (n) => `₹${r2(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ist = (d) => new Date(new Date(d).getTime() + 5.5 * 3600e3).toISOString().slice(0, 10);
const csv = (rows) => { const cols = Object.keys(rows[0]); const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n'; };
const tbl = (head, rows) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

const checks = []; const issues = [];
const check = (area, name, ok, detail = '') => checks.push({ area, name, ok, detail });

// ── Counts ──
const appPatients = list(await get('S02', '/patients?pageSize=200'));
const uhidById = Object.fromEntries(appPatients.map((p) => [p.id, p]));
check('Counts', 'Patients', appPatients.length === 50, `${appPatients.length}/50`);
check('Counts', 'Patients carry e-mail (sent on import)', appPatients.every((p) => p.email), `${appPatients.filter((p) => p.email).length}/50 have e-mail — defect if 0`);
const appUsers = await get('S01', '/users');
check('Counts', 'Staff accounts (incl. bootstrap admin)', list(appUsers).length === staff.length + 1, `${list(appUsers).length}/${staff.length + 1}`);
const appAppts = await get('S02', '/appointments?from=2026-09-01&to=2026-12-31');
const apptStatus = appAppts.reduce((m, a) => ((m[a.status] = (m[a.status] || 0) + 1), m), {});
const expStatus = appts.reduce((m, a) => ((m[a.status] = (m[a.status] || 0) + 1), m), {});
check('Counts', 'Appointments by status', JSON.stringify(Object.entries(apptStatus).sort()) === JSON.stringify(Object.entries(expStatus).sort()), `app ${JSON.stringify(apptStatus)} · expected ${JSON.stringify(expStatus)}`);

const opDays = [...new Set(encs.filter((e) => e.date !== cfg.liveDay).map((e) => e.date))].sort();
let queueCount = 0; const perDay = {};
for (const d of opDays) { const q = await get('S02', `/queue?date=${d}`); queueCount += q.length; perDay[d] = q.length; }
const expWindow = encs.filter((e) => e.date !== cfg.liveDay).length;
check('Counts', 'Queue encounters in window', queueCount === expWindow, `${queueCount}/${expWindow}`);
const liveDay = Object.values(state.queue).length ? new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10) : '';
const live = await get('S02', `/queue?date=${liveDay}`);
const liveStatus = live.reduce((m, q) => ((m[q.status] = (m[q.status] || 0) + 1), m), {});
check('Counts', `Live queue on ${liveDay}`, live.length === 6, JSON.stringify(liveStatus));
const visits = await get('S02', '/visits?pageSize=1');
check('Counts', 'Day-book visits (window + 8 historical + live assessed)', (visits.total ?? list(visits).length) >= expWindow + 8, `${visits.total ?? list(visits).length}`);

// ── Encounter register, bills ──
const encReg = []; let billChecked = 0;
const billRows = [];
for (const e of encs) {
  const st = state.queue[e.encounter_id];
  if (!st?.queueId) { issues.push(`${e.encounter_id} not imported`); continue; }
  const row = { encounter_id: e.encounter_id, patient_id: e.patient_id, date: e.date === cfg.liveDay ? liveDay : e.date, token: st.token, queue_id: st.queueId, visit_id: st.visitId || '', patient_bill_no: '', pharmacy_bill_no: '', gst_invoice_no: '', admission_ref: e.admission_ref };
  for (const b of bills.filter((x) => x.encounter_id === e.encounter_id)) {
    const app = await get(b.kind === 'PHARMACY' ? 'S12' : 'S02', `/queue/${st.queueId}/${b.kind === 'PHARMACY' ? 'pharmacy-bill' : 'bill'}`);
    billChecked++;
    row[b.kind === 'PHARMACY' ? 'pharmacy_bill_no' : 'patient_bill_no'] = app.billNumber;
    const appTotal = num(app.totalAmount), correct = num(b.total), formula = num(b.app_formula_total);
    const expectStatus = b.payment_status === 'PAID' ? 'PAID' : 'UNPAID';
    billRows.push({ bill: b.bill_ref, kind: b.kind, number: app.billNumber, app: appTotal, correct, formula, statusOk: app.paymentStatus === expectStatus, modeOk: b.payment_status !== 'PAID' || app.paymentMode === b.payment_mode, detailsOk: b.payment_status !== 'PAID' || Object.keys(app.paymentDetails || {}).length > 0 || b.payment_mode === 'CASH' });
  }
  encReg.push(row);
}
const mismatchFormula = billRows.filter((b) => Math.abs(b.app - b.formula) > 0.01);
const defectBills = billRows.filter((b) => Math.abs(b.app - b.correct) > 0.01);
check('Billing', 'App bill totals = expected app formula', mismatchFormula.length === 0, mismatchFormula.slice(0, 6).map((b) => `${b.bill} app ${b.app} vs ${b.formula}`).join('; ') || `${billRows.length} bills`);
check('Billing', 'App bill totals = correct business rule', defectBills.length === 0, `${defectBills.length} bills differ, overcharge ${money(defectBills.reduce((s, b) => s + b.app - b.correct, 0))} (package re-charge + undispensed medicines)`);
check('Billing', 'Payment status per bill', billRows.every((b) => b.statusOk), `${billRows.filter((b) => !b.statusOk).length} mismatches`);
check('Billing', 'Payment mode + details per paid bill', billRows.every((b) => b.modeOk && b.detailsOk), `${billRows.filter((b) => !b.modeOk || !b.detailsOk).length} mismatches`);

// ── GST invoices ──
const appInv = list(await get('S01', '/invoices?pageSize=1000'));
const invById = Object.fromEntries(appInv.map((i) => [i.id, i]));
const invIssues = [];
for (const g of gst) {
  const m = state.invoiceMap?.[g.invoice_ref];
  let inv = m && invById[m.id];
  if (!inv && g.source === 'PACKAGE_SALE') {
    const pp = pps.find((p) => p.purchase_ref && g.encounter_id === p.encounter_id && g.date === p.purchase_date);
    const ppId = pp && state.packages?.[pp.purchase_ref];
    inv = appInv.find((i) => i.packagePurchaseId === ppId);
  }
  if (!inv) { invIssues.push(`${g.invoice_ref} missing`); continue; }
  const enc = encReg.find((r) => r.encounter_id === g.encounter_id);
  if (enc && g.source === 'COLLECT_PAYMENT') enc.gst_invoice_no = inv.invoiceNumber;
  if (Math.abs(num(inv.taxableValue) - num(g.taxable_value)) > 0.01 || Math.abs(num(inv.totalAmount) - num(g.total)) > 0.05) invIssues.push(`${g.invoice_ref} ${inv.invoiceNumber}: app taxable ${inv.taxableValue}/total ${inv.totalAmount} vs ${g.taxable_value}/${g.total}`);
  if (ist(inv.issuedAt) !== g.date) invIssues.push(`${g.invoice_ref} dated ${ist(inv.issuedAt)} vs ${g.date}`);
  g._app = inv;
}
check('GST', 'Every expected invoice exists with matching value, total and date', invIssues.length === 0, invIssues.slice(0, 6).join('; ') || `${gst.length} invoices`);
check('GST', 'No extra invoices in the app', appInv.length === gst.length, `app ${appInv.length} vs expected ${gst.length}`);
const nums = appInv.map((i) => i.invoiceNumber).sort();
check('GST', 'Invoice numbers unique', new Set(nums).size === nums.length, `${nums[0]} … ${nums[nums.length - 1]}`);
const appTotals = appInv.reduce((s, i) => { const tx = i.isGstTaxable && num(i.cgst) + num(i.sgst) > 0; s.taxable += tx ? num(i.taxableValue) : 0; s.exempt += tx ? 0 : num(i.taxableValue); s.tax += num(i.cgst) + num(i.sgst); s.total += num(i.totalAmount); return s; }, { taxable: 0, exempt: 0, tax: 0, total: 0 });
const expTaxable = b2csExp.reduce((s, b) => s + num(b.taxable_value), 0), expExempt = exemptExp.reduce((s, b) => s + num(b.exempted), 0);
check('GST', 'GSTR-1 test totals rebuilt from app invoices = expected', Math.abs(appTotals.taxable - expTaxable) < 0.01 && Math.abs(appTotals.exempt - expExempt) < 0.01, `taxable ${money(appTotals.taxable)} vs ${money(expTaxable)}; exempt ${money(appTotals.exempt)} vs ${money(expExempt)}`);

// GSTR-1 style test summary from the app's own invoice register.
const gRows = {};
for (const i of appInv) {
  const rate = i.retailSaleId ? 'mixed (retail)' : i.isGstTaxable && num(i.cgst) > 0 ? num(i.cgstRate) + num(i.sgstRate) : 0;
  const k = `${rate}`;
  const g = (gRows[k] ||= { table: rate === 0 ? '8 — Exempt (B2C)' : '7 — B2C Others', rate, invoices: 0, taxable_value: 0, cgst: 0, sgst: 0, igst: 0, invoice_value: 0, file_label: 'TEST FILE — DO NOT FILE' });
  g.invoices++; g.taxable_value = r2(g.taxable_value + num(i.taxableValue)); g.cgst = r2(g.cgst + num(i.cgst)); g.sgst = r2(g.sgst + num(i.sgst)); g.invoice_value = r2(g.invoice_value + num(i.totalAmount));
}
fs.writeFileSync(path.join(REPORTS, 'gstr1_TEST_from_app.csv'), csv(Object.values(gRows)));

// ── Accounts summary for the window ──
let accounts = null;
try { accounts = await get('S13', `/accounts/summary?from=${cfg.windowStart}&to=${cfg.windowEnd}`); } catch (e) { issues.push(`accounts summary: ${e.message}`); }

// ── Packages ──
const appPP = await get('S13', '/packages/purchases');
const ppIssues = [];
for (const p of pps) {
  const a = appPP.find((x) => x.id === state.packages?.[p.purchase_ref]);
  if (!a) { ppIssues.push(`${p.purchase_ref} missing`); continue; }
  if (Math.abs(num(a.discountAmount) - num(p.discount_amount)) > 0.01) ppIssues.push(`${p.purchase_ref} discount ${a.discountAmount} vs ${p.discount_amount}`);
  const redeemed = encs.filter((e) => e.redeem_package_ref === p.purchase_ref).length;
  if (num(a.sittingsUsed) !== redeemed) ppIssues.push(`${p.purchase_ref} sittings used ${a.sittingsUsed} vs ${redeemed}`);
}
check('Packages', 'Package sales, discounts and sittings used', ppIssues.length === 0, ppIssues.slice(0, 5).join('; ') || `${pps.length} purchases`);

// ── Stock ──
const appMeds = await get('S12', '/medicines');
const closing = {}; for (const l of ledger) closing[l.medicine_id] = num(l.balance_after);
const stockIssues = [];
for (const m of meds) {
  const a = appMeds.find((x) => x.id === state.ids[m.medicine_id]);
  if ((a?.stockQty ?? -1) !== (closing[m.medicine_id] ?? 0)) stockIssues.push(`${m.medicine_id} app ${a?.stockQty} vs ${closing[m.medicine_id] ?? 0}`);
}
check('Stock', 'Closing stock per medicine', stockIssues.length === 0, stockIssues.slice(0, 6).join('; ') || `${meds.length} medicines`);
// The app also deducts one unit for every MAR dose marked "Given" — on top of the pharmacy's
// care-order dispense. If that alone explains the gap, say so.
const mos = readCsv('22_');
const marGiven = {};
for (const a of mas.filter((x) => x.status === 'Given')) { const mo = mos.find((m) => m.mo_ref === a.mo_ref); marGiven[mo.medicine_id] = (marGiven[mo.medicine_id] || 0) + 1; }
const unexplained = meds.filter((m) => { const a = appMeds.find((x) => x.id === state.ids[m.medicine_id]); return a.stockQty !== (closing[m.medicine_id] ?? 0) - (marGiven[m.medicine_id] || 0); });
check('Stock', 'Gap fully explained by MAR "Given" doses deducting stock a second time', unexplained.length === 0, Object.entries(marGiven).map(([m, n]) => `${m}: ${n} doses`).join(', '));
// Batch level: expected with the correct policy (FEFO, never an expired batch).
const moves = [];
for (const o of orders.filter((x) => x.dispensed === 'YES' && x.medicine_id)) moves.push({ date: encs.find((e) => e.encounter_id === o.encounter_id).date, m: o.medicine_id, q: num(o.quantity) });
for (const r of retail) for (const it of r.items.split(';')) { const [m, q] = it.split('x'); moves.push({ date: r.date, m, q: num(q) }); }
moves.sort((a, b) => a.date.localeCompare(b.date));
const left = Object.fromEntries(batches.map((b) => [b.batch_ref, num(b.qty_received)]));
for (const mv of moves) {
  let need = mv.q;
  for (const b of batches.filter((x) => x.medicine_id === mv.m && x.received_date <= mv.date && left[x.batch_ref] > 0 && x.expiry_date >= mv.date).sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))) {
    const t = Math.min(need, left[b.batch_ref]); left[b.batch_ref] -= t; need -= t; if (!need) break;
  }
}
const appBatches = await get('S12', '/medicines/batches/expiring?days=5000');
const batchDiff = batches.map((b) => { const a = appBatches.find((x) => x.batchNumber === b.batch_ref); return { batch: b.batch_ref, medicine: b.medicine_id, expiry: b.expiry_date, expected: left[b.batch_ref], app: a ? a.currentQty : 0 }; }).filter((x) => x.expected !== x.app);
check('Stock', 'Batch quantities match correct FEFO (no expired batch dispensed)', batchDiff.length === 0, batchDiff.map((b) => `${b.batch} app ${b.app} vs ${b.expected}`).join('; '));

// ── IPD ──
const appAdm = list(await get('D4', '/admissions?pageSize=50'));
const admIssues = [];
let notesApp = 0, adminsApp = 0;
for (const a of adms.filter((x) => x.encounter_id)) {
  const x = appAdm.find((y) => y.id === state.admissions?.[a.admission_ref]);
  if (!x) { admIssues.push(`${a.admission_ref} missing`); continue; }
  const expStatus = a.status_expected === 'ADMITTED' ? 'ADMITTED' : 'DISCHARGED';
  if (x.status !== expStatus) admIssues.push(`${a.admission_ref} ${x.status} vs ${expStatus}`);
  notesApp += (await get('D4', `/admissions/${x.id}/progress-notes`)).length;
  for (const mo of await get('D4', `/medication-orders?admissionId=${x.id}`)) adminsApp += (await get('D4', `/medication-orders/${mo.id}/administrations`)).length;
}
const expNotes = pnotes.filter((n) => state.admissions?.[n.admission_ref]).length;
check('IPD', 'Admissions imported with expected status (blocked case not admitted)', admIssues.length === 0 && !state.admissions?.['ADM-QA-04'], admIssues.join('; ') || `${appAdm.length} admissions`);
check('IPD', 'Progress notes', notesApp === expNotes, `${notesApp}/${expNotes}`);
check('IPD', 'Medication administrations (MAR)', adminsApp === mas.length, `${adminsApp}/${mas.length}`);

// ── Documents ──
let docCount = 0;
for (const p of patients) docCount += (await get('D4', `/patient-documents?patientId=${state.patients[p.patient_id]}`)).length;
check('Documents', 'Placeholder documents uploaded', docCount === docs.length, `${docCount}/${docs.length}`);

// ── Outputs ──
fs.writeFileSync(path.join(REGISTER, 'test-data-register.csv'), csv(patients.map((p) => {
  const a = uhidById[state.patients[p.patient_id]];
  return { patient_id: p.patient_id, app_uhid: a?.uhid, name: p.full_name, phone: p.phone, pathway: p.pathway, tax_test_category: p.tax_test_category, primary_doctor: STAFF[p.primary_doctor].name, registration: p.first_visit_or_returning, status: p.patient_status, encounters: encReg.filter((r) => r.patient_id === p.patient_id).map((r) => r.encounter_id).join(' '), app_patient_id: state.patients[p.patient_id], test_data: 'YES' };
})));
fs.writeFileSync(path.join(REGISTER, 'encounters-register.csv'), csv(encReg));

const log = fs.readFileSync(path.join(RUNTIME, 'import-log.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const probes = log.filter((l) => l.kind === 'PROBE' || l.kind === 'SCENARIO');
const failed = checks.filter((c) => !c.ok);
const md = `# Import results — [TEST DATA] derm-qa → isolated QA environment

Verified by reading back through the application's API (\`tools/verify.mjs\`) on ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.
Environment: \`test-data/derm-qa/runtime/qa-derm.db\`, backend http://localhost:4100. Your \`dev.db\` was not touched.

**${checks.length - failed.length}/${checks.length} checks match the dataset.** Failures below are findings about the application (the dataset was validated separately — see \`reconciliation.md\`).

## 1. Read-back checks
${tbl(['Area', 'Check', 'Result', 'Detail'], checks.map((c) => [c.area, c.name, c.ok ? 'PASS' : '**FAIL**', String(c.detail).replace(/\|/g, '/')]))}

## 2. Probe and scenario outcomes
${tbl(['Probe', 'Expected', 'App outcome', 'Message'], probes.map((p) => [p.label, p.expected || '—', p.outcome, String(p.message ?? '').replace(/\|/g, '/').slice(0, 120)]))}

## 3. Bills where the app differs from the correct rule
${defectBills.length ? tbl(['Bill', 'Kind', 'App number', 'App total', 'Correct total', 'Over-charge'], defectBills.map((b) => [b.bill, b.kind, b.number, money(b.app), money(b.correct), money(b.app - b.correct)])) : 'None.'}

## 4. Batches where the app differs from correct FEFO
${batchDiff.length ? tbl(['Batch', 'Medicine', 'Expiry', 'App remaining', 'Expected remaining'], batchDiff.map((b) => [b.batch, b.medicine, b.expiry, b.app, b.expected])) : 'None.'}

## 5. Accounts summary for ${cfg.windowStart} → ${cfg.windowEnd} (as Accounts)
\`\`\`json
${JSON.stringify(accounts, null, 2)?.slice(0, 2500)}
\`\`\`

## 6. GSTR-1 style test summary rebuilt from the app (\`gstr1_TEST_from_app.csv\`)
${tbl(['Table', 'Rate', 'Invoices', 'Taxable value', 'CGST', 'SGST', 'Invoice value'], Object.values(gRows).map((g) => [g.table, g.rate, g.invoices, money(g.taxable_value), money(g.cgst), money(g.sgst), money(g.invoice_value)]))}

Expected (from dataset): taxable ${money(expTaxable)}, exempt ${money(expExempt)}. TEST FILE — not for filing.

## 7. Import limitations and unsupported items logged
${log.filter((l) => ['UNSUPPORTED', 'LIMITATION', 'SKIP'].includes(l.kind)).map((l) => `- ${l.kind}: ${l.label} — ${l.outcome ?? ''}`).join('\n')}
- Blocked admission (ADM-QA-04): **not imported** — the app has no consent field, so it cannot block an admission without consent. Manual QA step.
- Duplicate-registration probes: **not imported** (QA steps — the app is expected to accept them).

## 8. Workload in the app (queue entries per day)
${tbl(['Date', 'Entries'], Object.entries(perDay).map(([d, n]) => [d, n]))}

${issues.length ? `## 9. Other issues\n${issues.map((i) => `- ${i}`).join('\n')}` : ''}
`;
fs.writeFileSync(path.join(REPORTS, 'import-results.md'), md);
console.log(`[TEST DATA] ${checks.length - failed.length}/${checks.length} read-back checks match`);
for (const c of failed) console.log(`  FAIL ${c.area} — ${c.name}: ${c.detail}`);
console.log('bills checked', billChecked, '| reports/import-results.md, register/*.csv written');
