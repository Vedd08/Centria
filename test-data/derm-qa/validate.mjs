#!/usr/bin/env node
/**
 * [TEST DATA] Independent validator for the derm-qa dataset.
 *
 * Re-reads the CSVs (it shares no code with generate.mjs), recomputes every total and
 * checks references, scheduling rules and stock, then writes reports/reconciliation.md.
 * Exit code 1 if any hard check fails.
 *
 * Usage:  node test-data/derm-qa/validate.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, 'data');
const REPORTS = path.join(HERE, 'reports');
fs.mkdirSync(REPORTS, { recursive: true });

// ── tiny RFC-4180 CSV reader ──
function readCsv(name) {
  const text = fs.readFileSync(path.join(DATA, name), 'utf8').replace(/^﻿/, '');
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1 || r[0] !== '');
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
const num = (v) => (v === '' || v === undefined ? 0 : Number(v));
const r2 = (n) => Math.round(n * 100) / 100;
const money = (n) => `₹${r2(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const dow = (s) => new Date(`${s}T00:00:00Z`).getUTCDay();

const F = Object.fromEntries(fs.readdirSync(DATA).filter((f) => f.endsWith('.csv')).map((f) => [f, readCsv(f)]));
const get = (prefix) => F[Object.keys(F).find((k) => k.startsWith(prefix))];

const cfg = get('00_')[0];
const staff = get('02_'), sched = get('03_'), leave = get('04_'), treatments = get('06_'), pkgTypes = get('07_');
const meds = get('08_'), purchases = get('10_'), batches = get('11_'), patients = get('12_'), appts = get('14_');
const encs = get('16_'), orders = get('17_'), procs = get('18_'), pps = get('19_'), adms = get('20_');
const pnotes = get('21_'), mos = get('22_'), mas = get('23_'), docs = get('24_'), bills = get('25_');
const gst = get('26_'), pays = get('27_'), retail = get('28_'), adjs = get('30_'), ledger = get('31_');

const results = []; // [section, check, ok, detail]
const check = (section, name, ok, detail = '') => results.push({ section, name, ok: !!ok, detail });
const byId = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r]));
const P = byId(patients, 'patient_id'), S = byId(staff, 'staff_id'), E = byId(encs, 'encounter_id');
const M = byId(meds, 'medicine_id'), TRm = byId(treatments, 'treatment_id'), PK = byId(pkgTypes, 'package_type_id');

// ───────── 1. Patients ─────────
check('Patients', 'Exactly 50 patients', patients.length === 50, `${patients.length}`);
const uniq = (arr) => new Set(arr).size === arr.length;
check('Patients', 'Unique patient IDs', uniq(patients.map((p) => p.patient_id)));
check('Patients', 'Unique names', uniq(patients.map((p) => p.full_name)));
check('Patients', 'Unique phone numbers', uniq(patients.map((p) => p.phone)));
check('Patients', 'All marked test data', patients.every((p) => p.test_data === 'YES' && p.full_name.includes('(Test)')));
check('Patients', 'No government ID values', patients.every((p) => /NOT COLLECTED/.test(p.govt_id_placeholder)));
const taxable = patients.filter((p) => p.tax_test_category === 'TAXABLE_TEST').length;
const exempt = patients.filter((p) => p.tax_test_category === 'EXEMPT_TEST').length;
check('Patients', '30:20 test classification', taxable === 30 && exempt === 20, `TAXABLE_TEST=${taxable}, EXEMPT_TEST=${exempt}`);
const minors = patients.filter((p) => num(p.age_at_window) < 18);
check('Patients', 'Every minor has a guardian entry', minors.every((p) => p.guardian_for_minor), `${minors.length} minors`);
const hist = get('34_');
const firstEnc = {}; for (const e of encs) if (e.date !== cfg.liveDay && (!firstEnc[e.patient_id] || e.date < firstEnc[e.patient_id])) firstEnc[e.patient_id] = e.date;
check('Patients', 'Registration date on every patient, not after first visit', patients.every((p) => p.registration_date && (!firstEnc[p.patient_id] || p.registration_date <= firstEnc[p.patient_id])));
const returning = patients.filter((p) => p.first_visit_or_returning.startsWith('RETURNING'));
check('Patients', 'Returning patients have history before the window', returning.length > 0 && returning.every((p) => hist.some((h) => h.patient_id === p.patient_id && h.date < cfg.windowStart)), `${returning.length} returning, ${hist.length} historical visits`);
check('Patients', 'Every patient has a status', patients.every((p) => p.patient_status));
const withEnc = new Set(encs.map((e) => e.patient_id));
check('Patients', 'Every patient has at least one encounter', patients.every((p) => withEnc.has(p.patient_id)), `${withEnc.size}/50`);

// ───────── 2. References ─────────
const missing = [];
const ref = (label, ok, v) => { if (!ok) missing.push(`${label}: ${v}`); };
for (const e of encs) { ref('encounter.patient', P[e.patient_id], e.patient_id); ref('encounter.doctor', S[e.doctor], e.doctor); if (e.treatment_id) ref('encounter.treatment', TRm[e.treatment_id], e.treatment_id); }
for (const o of orders) { ref('order.encounter', E[o.encounter_id], o.encounter_id); if (o.medicine_id) ref('order.medicine', M[o.medicine_id], o.medicine_id); if (o.treatment_id) ref('order.treatment', TRm[o.treatment_id], o.treatment_id); if (o.performed_by) ref('order.performer', S[o.performed_by], o.performed_by); }
for (const pr of procs) { ref('procedure.encounter', E[pr.encounter_id], pr.encounter_id); ref('procedure.treatment', TRm[pr.treatment_id], pr.treatment_id); ref('procedure.staff', S[pr.assigned_staff], pr.assigned_staff); }
for (const pp of pps) { ref('package.patient', P[pp.patient_id], pp.patient_id); ref('package.type', PK[pp.package_type_id], pp.package_type_id); ref('package.encounter', E[pp.encounter_id], pp.encounter_id); }
const PP = byId(pps, 'purchase_ref');
for (const e of encs) for (const k of ['package_purchase_ref', 'redeem_package_ref']) if (e[k]) { ref(`encounter.${k}`, PP[e[k]], e[k]); if (PP[e[k]]) ref('package belongs to patient', PP[e[k]].patient_id === e.patient_id, e.encounter_id); }
for (const a of adms) { ref('admission.patient', P[a.patient_id], a.patient_id); if (a.encounter_id) ref('admission.encounter', E[a.encounter_id], a.encounter_id); }
const A = byId(adms, 'admission_ref');
for (const n of pnotes) ref('progress_note.admission', A[n.admission_ref], n.admission_ref);
const MO = byId(mos, 'mo_ref');
for (const m of mos) { ref('med_order.admission', A[m.admission_ref], m.admission_ref); ref('med_order.medicine', M[m.medicine_id], m.medicine_id); }
for (const m of mas) ref('administration.order', MO[m.mo_ref], m.mo_ref);
for (const d of docs) { ref('document.patient', P[d.patient_id], d.patient_id); ref('document.encounter', E[d.encounter_id], d.encounter_id); }
for (const a of appts) { ref('appointment.patient', P[a.patient_id], a.patient_id); ref('appointment.doctor', S[a.doctor], a.doctor); if (a.encounter_id) ref('appointment.encounter', E[a.encounter_id], a.encounter_id); }
const B = byId(bills, 'bill_ref'), G = byId(gst, 'invoice_ref');
for (const b of bills) ref('bill.encounter', E[b.encounter_id], b.encounter_id);
for (const p of pays) ref('payment.target', p.target_type.endsWith('BILL') ? B[p.target_ref] : G[p.target_ref], p.target_ref);
for (const b of batches) ref('batch.medicine', M[b.medicine_id], b.medicine_id);
check('References', 'No missing references', missing.length === 0, missing.slice(0, 8).join('; ') || `all resolved`);
for (const [label, rows, key] of [['encounters', encs, 'encounter_id'], ['orders', orders, 'order_id'], ['appointments', appts, 'appointment_ref'], ['bills', bills, 'bill_ref'], ['invoices', gst, 'invoice_ref'], ['payments', pays, 'payment_ref'], ['batches', batches, 'batch_ref']]) {
  check('References', `Unique ${label} IDs`, uniq(rows.map((r) => r[key])));
}

// ───────── 3. Scheduling ─────────
const S2 = {}; for (const s of sched) (S2[s.doctor] ||= {})[s.day_of_week] = s;
const onLeave = (doc, date) => leave.some((l) => l.staff_id === doc && date >= l.from && date <= l.to);
const windowEncs = encs.filter((e) => e.date !== cfg.liveDay);
const badDay = windowEncs.filter((e) => e.care_type !== 'IPD' && (!S2[e.doctor]?.[dow(e.date)] || onLeave(e.doctor, e.date)));
check('Scheduling', 'OPD encounters only on the doctor\'s session days (not on leave)', badDay.length === 0, badDay.map((e) => e.encounter_id).join(', ') || `${windowEncs.length} encounters`);
check('Scheduling', 'No encounters on Sunday (clinic closed)', windowEncs.every((e) => dow(e.date) !== 0));
check('Scheduling', 'A patient is in a day\'s queue at most once', uniq(encs.map((e) => `${e.patient_id}|${e.date}`)));
check('Scheduling', 'All encounters inside the 4-week window', windowEncs.every((e) => e.date >= cfg.windowStart && e.date <= cfg.windowEnd));
const slotOk = (a) => { const s = S2[a.doctor]?.[dow(a.date)]; if (!s) return false; const t = toMin(a.start_time); return t >= toMin(s.start_time) && t + num(s.slot_minutes) <= toMin(s.end_time) && (t - toMin(s.start_time)) % num(s.slot_minutes) === 0; };
const badSlots = appts.filter((a) => !slotOk(a));
check('Scheduling', 'Every appointment is a valid slot in the doctor\'s session', badSlots.length === 0, badSlots.map((a) => a.appointment_ref).join(', ') || `${appts.length} appointments`);
const live = appts.filter((a) => !['Cancelled', 'No-Show'].includes(a.status));
const slotKeys = live.map((a) => `${a.doctor}|${a.date}|${a.start_time}`);
check('Scheduling', 'No double-booked slots (active appointments)', uniq(slotKeys));
const perDay = {}; for (const e of windowEncs) perDay[e.date] = (perDay[e.date] || 0) + 1;
const loads = Object.values(perDay);
const statusCounts = (rows, k) => rows.reduce((m, r) => ((m[r[k]] = (m[r[k]] || 0) + 1), m), {});

// ───────── 4. Clinical coherence ─────────
const newEncs = encs.filter((e) => e.visit_kind === 'NEW');
check('Clinical', 'Every new consultation has complaint, history, exam, diagnosis and plan', newEncs.every((e) => e.chief_complaint && e.history && e.examination && e.diagnosis && e.plan));
const dxWords = /(vulgaris|dermatitis|psoriasis|melasma|alopecia|effluvium|tinea|verruca|keratos|naevus|cyst|hirsutism|scarring|contracture)/i;
const dxInComplaint = encs.filter((e) => dxWords.test(e.reception_complaint));
check('Clinical', 'Reception complaint never states a diagnosis', dxInComplaint.length === 0, dxInComplaint.map((e) => `${e.encounter_id}: ${e.reception_complaint}`).slice(0, 4).join('; '));
check('Clinical', 'Next appointment is after the visit date', encs.filter((e) => e.next_appointment_date && e.date !== cfg.liveDay).every((e) => e.next_appointment_date > e.date));
const procMismatch = procs.filter((pr) => { const e = E[pr.encounter_id]; return ['COMPLETED', 'AWAITING_STAFF_SIGN_OFF', 'MISSING_DOCUMENTATION'].includes(pr.state) && e.care_type === 'OPD' && e.treatment_id !== pr.treatment_id; });
check('Clinical', 'Performed OPD procedures match the encounter treatment', procMismatch.length === 0, procMismatch.map((p) => p.procedure_ref).join(', '));
const deferredBilled = procs.filter((pr) => ['POSTPONED', 'PENDING_CONSENT'].includes(pr.state) && E[pr.encounter_id].treatment_id);
check('Clinical', 'Deferred procedures are not billed', deferredBilled.length === 0);
check('Clinical', 'No consent recorded as genuinely signed', procs.every((p) => !/signed by patient/i.test(p.consent_status)) && adms.every((a) => !/signed by patient/i.test(a.consent_status)));
const notStockedSilent = orders.filter((o) => o.not_stocked === 'YES' && o.dispensed === 'YES');
check('Pharmacy', 'Non-stocked / clarification orders are never dispensed', notStockedSilent.length === 0);

// ───────── 5. Billing ─────────
// Recompute patient-bill totals from encounters, orders and masters (correct business rules).
const billMismatch = [];
for (const b of bills.filter((x) => x.kind === 'PATIENT')) {
  const e = E[b.encounter_id];
  let sub = 0, tx = 0, cg = 0;
  const add = (amt, taxable, rate) => { sub += amt; if (taxable) { tx += amt; cg += amt * rate / 200; } };
  add(num(e.consultation_fee), false, 0);
  if (e.treatment_id) { const t = TRm[e.treatment_id]; add(e.redeem_package_ref ? 0 : num(t.price), t.is_gst_taxable === 'YES', num(t.tax_rate)); }
  for (const o of orders.filter((x) => x.encounter_id === e.encounter_id && x.final_status !== 'CANCELLED')) {
    if (e.care_type === 'OPD' && ['MEDICINE', 'INJECTION'].includes(o.order_type)) continue;
    const m = M[o.medicine_id], t = TRm[o.treatment_id];
    add(num(o.total_price), m ? m.is_gst_taxable === 'YES' : t ? t.is_gst_taxable === 'YES' : false, m ? num(m.tax_rate) : t ? num(t.tax_rate) : 0);
  }
  const total = r2(r2(sub) + 2 * r2(cg));
  if (Math.abs(total - num(b.total)) > 0.01) billMismatch.push(`${b.bill_ref} expected ${total} got ${b.total}`);
}
for (const b of bills.filter((x) => x.kind === 'PHARMACY')) {
  let sub = 0, cg = 0;
  for (const o of orders.filter((x) => x.encounter_id === b.encounter_id && x.dispensed === 'YES' && ['MEDICINE', 'INJECTION'].includes(x.order_type) && x.medicine_id)) {
    const m = M[o.medicine_id]; sub += num(o.total_price); if (m.is_gst_taxable === 'YES') cg += num(o.total_price) * num(m.tax_rate) / 200;
  }
  const total = r2(r2(sub) + 2 * r2(cg));
  if (Math.abs(total - num(b.total)) > 0.01) billMismatch.push(`${b.bill_ref} expected ${total} got ${b.total}`);
}
check('Billing', 'Every bill total recomputes from its lines', billMismatch.length === 0, billMismatch.slice(0, 5).join('; ') || `${bills.length} bills`);
const payBy = {}; for (const p of pays) payBy[p.target_ref] = r2((payBy[p.target_ref] || 0) + num(p.amount));
const payMismatch = bills.filter((b) => Math.abs((payBy[b.bill_ref] || 0) - num(b.amount_paid)) > 0.01);
check('Billing', 'Payments allocated to each bill equal its amount paid', payMismatch.length === 0, payMismatch.map((b) => b.bill_ref).slice(0, 5).join(', '));
const balMismatch = bills.filter((b) => Math.abs(r2(num(b.total) - num(b.amount_paid)) - num(b.outstanding)) > 0.01);
check('Billing', 'Outstanding = total − paid on every bill', balMismatch.length === 0);
const invPayMismatch = gst.filter((g) => g.source !== 'COLLECT_PAYMENT' && Math.abs((payBy[g.invoice_ref] || 0) - num(g.total)) > 0.01);
check('Billing', 'Package and retail invoices fully paid', invPayMismatch.length === 0, invPayMismatch.map((g) => g.invoice_ref).join(', '));
const gstCalc = gst.filter((g) => g.tax_rate !== 'mixed' && Math.abs(r2(num(g.taxable_value) * num(g.tax_rate) / 200) - num(g.cgst)) > 0.01);
check('GST', 'CGST = SGST = taxable × rate/2 on single-rate invoices', gstCalc.length === 0, gstCalc.map((g) => g.invoice_ref).join(', '));
check('GST', 'Invoice total = taxable + CGST + SGST', gst.every((g) => Math.abs(r2(num(g.taxable_value) + num(g.cgst) + num(g.sgst)) - num(g.total)) < 0.011));
const encInvoices = gst.filter((g) => g.source === 'COLLECT_PAYMENT').map((g) => g.encounter_id);
check('GST', 'At most one Collect-Payment invoice per visit (duplicate guard)', uniq(encInvoices));
const gstTotals = (rows) => rows.reduce((s, g) => {
  const isTx = g.is_gst_taxable === 'YES';
  s.taxable += isTx ? num(g.taxable_value) : 0; s.exempt += isTx ? 0 : num(g.taxable_value);
  s.cgst += num(g.cgst); s.sgst += num(g.sgst); s.total += num(g.total); s.n++; return s;
}, { n: 0, taxable: 0, exempt: 0, cgst: 0, sgst: 0, total: 0 });
// Line-level turnover from the bills (the correct basis — not the 30:20 patient split).
const lineTurnover = { PATIENT: { taxable: 0, exempt: 0, tax: 0 }, PHARMACY: { taxable: 0, exempt: 0, tax: 0 } };
for (const b of bills) { const t = lineTurnover[b.kind]; t.taxable += num(b.taxable_value); t.exempt += num(b.exempt_value); t.tax += num(b.cgst) + num(b.sgst); }

// GSTR-1 test export must reconcile with the register it was built from.
const b2cs = get('35_'), exemptRows = get('36_'), hsn = get('37_');
const regTaxable = gst.filter((g) => g.is_gst_taxable === 'YES').reduce((s, g) => s + num(g.taxable_value), 0);
const regExempt = gst.filter((g) => g.is_gst_taxable !== 'YES').reduce((s, g) => s + num(g.taxable_value), 0);
const regTax = gst.reduce((s, g) => s + num(g.cgst), 0);
check('GST', 'GSTR-1 B2CS taxable = register taxable value', Math.abs(b2cs.reduce((s, b) => s + num(b.taxable_value), 0) - regTaxable) < 0.01, `${r2(regTaxable)}`);
check('GST', 'GSTR-1 exempt table = register exempt value', Math.abs(exemptRows.reduce((s, b) => s + num(b.exempted), 0) - regExempt) < 0.01, `${r2(regExempt)}`);
check('GST', 'GSTR-1 HSN/SAC summary = register taxable + exempt and CGST', Math.abs(hsn.reduce((s, h) => s + num(h.taxable_value), 0) - regTaxable - regExempt) < 0.01 && Math.abs(hsn.reduce((s, h) => s + num(h.cgst), 0) - regTax) < 0.05);
check('GST', 'Every GSTR-1 test file is labelled TEST FILE', [...b2cs, ...exemptRows, ...hsn, ...get('38_')].every((r) => /TEST FILE/.test(r.file_label)));

// ───────── 6. Stock ─────────
const moves = [];
for (const b of batches) moves.push({ date: b.received_date, m: b.medicine_id, d: num(b.qty_received), t: 'RECEIPT' });
for (const o of orders.filter((x) => x.dispensed === 'YES' && x.medicine_id)) moves.push({ date: E[o.encounter_id].date, m: o.medicine_id, d: -num(o.quantity), t: 'DISPENSE' });
for (const r of retail) for (const it of r.items.split(';')) { const [m, q] = it.split('x'); moves.push({ date: r.date, m, d: -num(q), t: 'RETAIL' }); }
for (const a of adjs) moves.push({ date: a.date, m: a.medicine_id, d: num(a.delta), t: a.source === 'MANUAL' ? 'ADJUST' : 'CONSUMED' });
moves.sort((a, b) => a.date.localeCompare(b.date) || b.d - a.d);
const stock = {}; const negatives = [];
const summary = Object.fromEntries(meds.map((m) => [m.medicine_id, { RECEIPT: 0, DISPENSE: 0, RETAIL: 0, ADJUST: 0, CONSUMED: 0 }]));
for (const mv of moves) { stock[mv.m] = (stock[mv.m] || 0) + mv.d; summary[mv.m][mv.t] += mv.d; if (stock[mv.m] < 0) negatives.push(`${mv.m} on ${mv.date}`); }
check('Stock', 'Stock never goes negative on any date', negatives.length === 0, negatives.length ? `${negatives.length} dates: ${negatives.slice(0, 6).join(', ')}` : '');
const ledgerFinal = {}; for (const l of ledger) ledgerFinal[l.medicine_id] = num(l.balance_after);
const ledgerDiff = meds.filter((m) => (stock[m.medicine_id] || 0) !== (ledgerFinal[m.medicine_id] || 0));
check('Stock', 'Recomputed closing stock matches the expected ledger', ledgerDiff.length === 0, ledgerDiff.map((m) => m.medicine_id).join(', '));
const zero = meds.filter((m) => (stock[m.medicine_id] || 0) === 0).map((m) => m.medicine_id);
const low = meds.filter((m) => (stock[m.medicine_id] || 0) > 0 && (stock[m.medicine_id] || 0) <= num(m.reorder_point)).map((m) => m.medicine_id);
check('Stock', 'Zero-stock scenario present (M18)', zero.includes('M18'));
check('Stock', 'Low-stock scenario present (M13)', low.includes('M13'));
const expired = batches.filter((b) => b.expiry_state_on_2026_10_12 === 'EXPIRED');
const near = batches.filter((b) => b.expiry_state_on_2026_10_12.startsWith('NEAR'));
check('Stock', 'Expired and near-expiry batches present', expired.length > 0 && near.length > 0, `${expired.length} expired, ${near.length} near-expiry`);
const insuff = orders.filter((o) => o.scenario === 'INSUFFICIENT_STOCK');
check('Stock', 'Insufficient-stock prescriptions exceed available stock', insuff.every((o) => num(o.quantity) > (stock[o.medicine_id] || 0)), `${insuff.length} orders`);

// Batch-level expectation with the CORRECT policy (FEFO, never an expired batch).
const batchLeft = Object.fromEntries(batches.map((b) => [b.batch_ref, num(b.qty_received)]));
const fefoNotes = [];
for (const mv of moves.filter((x) => x.d < 0)) {
  let need = -mv.d;
  const usable = batches.filter((b) => b.medicine_id === mv.m && b.received_date <= mv.date && batchLeft[b.batch_ref] > 0)
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));
  for (const b of usable) {
    if (need <= 0) break;
    if (mv.t !== 'ADJUST' && b.expiry_date < mv.date) continue; // never dispense expired stock
    const take = Math.min(need, batchLeft[b.batch_ref]); batchLeft[b.batch_ref] -= take; need -= take;
  }
  if (need > 0) fefoNotes.push(`${mv.m} ${mv.t} on ${mv.date}: ${need} unit(s) not coverable by non-expired batches received by that date`);
}

// ───────── report ─────────
const failed = results.filter((r) => !r.ok);
const gAll = gstTotals(gst);
const bySource = ['COLLECT_PAYMENT', 'PACKAGE_SALE', 'RETAIL_SALE'].map((s) => [s, gstTotals(gst.filter((g) => g.source === s))]);
const payByMode = pays.reduce((m, p) => ((m[p.mode] = r2((m[p.mode] || 0) + num(p.amount))), m), {});
const payByType = pays.reduce((m, p) => ((m[p.target_type] = r2((m[p.target_type] || 0) + num(p.amount))), m), {});
const billSum = (k, f = () => true) => r2(bills.filter(f).reduce((s, b) => s + num(b[k]), 0));
const tbl = (head, rows) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

const md = `# Reconciliation report — [TEST DATA] derm-qa dataset

Generated by \`validate.mjs\` from the CSVs in \`data/\`. All figures are synthetic test data.
Window: ${cfg.windowStart} → ${cfg.windowEnd} (Mon–Sat; clinic closed Sundays) plus live-queue rows dated \`${cfg.liveDay}\`.

**Result: ${failed.length === 0 ? 'ALL CHECKS PASSED' : `${failed.length} CHECK(S) FAILED`}** (${results.length} checks)

## 1. Checks
${tbl(['Area', 'Check', 'Result', 'Detail'], results.map((r) => [r.section, r.name, r.ok ? 'PASS' : '**FAIL**', r.detail.replace(/\|/g, '/')]))}

## 2. Record counts
${tbl(['File', 'Rows'], Object.entries(F).map(([f, rows]) => [f, rows.length]))}

## 3. Patients and the 30:20 test classification
${tbl(['Category', 'Patients'], [['TAXABLE_TEST', taxable], ['EXEMPT_TEST', exempt], ['Total', patients.length], ['of which minors (guardian)', minors.length]])}

The patient category is a **test label only**. Turnover below is computed from classified bill / invoice **lines**, never from this split.

Pathways: ${Object.entries(statusCounts(patients, 'pathway')).map(([k, v]) => `${k} ${v}`).join(' · ')}

## 4. Workload
- Encounters in window: **${windowEncs.length}** on ${loads.length} operating days — min ${Math.min(...loads)}, max ${Math.max(...loads)}, mean ${r2(windowEncs.length / loads.length)} per day.
- Live-queue rows for import day: ${encs.length - windowEncs.length} (${Object.entries(statusCounts(encs.filter((e) => e.date === cfg.liveDay), 'final_queue_status')).map(([k, v]) => `${k} ${v}`).join(', ')}).
- Reception mode: ${Object.entries(statusCounts(encs, 'reception_mode')).map(([k, v]) => `${k} ${v}`).join(', ')}.
- Visit kinds: ${Object.entries(statusCounts(encs, 'visit_kind')).map(([k, v]) => `${k} ${v}`).join(', ')}.
- Appointments: ${Object.entries(statusCounts(appts, 'status')).map(([k, v]) => `${k} ${v}`).join(', ')}; rescheduled: ${appts.filter((a) => a.rescheduled_from).length}.

${tbl(['Date', 'Day', 'Encounters'], Object.entries(perDay).sort().map(([d, n]) => [d, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow(d)], n]))}

## 5. Bills, payments and outstanding balances
${tbl(['Measure', 'Patient bills', 'Pharmacy bills'], [
  ['Count', bills.filter((b) => b.kind === 'PATIENT').length, bills.filter((b) => b.kind === 'PHARMACY').length],
  ['Sub-total', money(billSum('sub_total', (b) => b.kind === 'PATIENT')), money(billSum('sub_total', (b) => b.kind === 'PHARMACY'))],
  ['CGST + SGST', money(billSum('cgst', (b) => b.kind === 'PATIENT') + billSum('sgst', (b) => b.kind === 'PATIENT')), money(billSum('cgst', (b) => b.kind === 'PHARMACY') + billSum('sgst', (b) => b.kind === 'PHARMACY'))],
  ['Total billed (correct rule)', money(billSum('total', (b) => b.kind === 'PATIENT')), money(billSum('total', (b) => b.kind === 'PHARMACY'))],
  ['Total per app formula', money(billSum('app_formula_total', (b) => b.kind === 'PATIENT')), money(billSum('app_formula_total', (b) => b.kind === 'PHARMACY'))],
  ['Collected', money(billSum('amount_paid', (b) => b.kind === 'PATIENT')), money(billSum('amount_paid', (b) => b.kind === 'PHARMACY'))],
  ['Outstanding', money(billSum('outstanding', (b) => b.kind === 'PATIENT')), money(billSum('outstanding', (b) => b.kind === 'PHARMACY'))],
])}

Bill status: ${Object.entries(statusCounts(bills, 'payment_status')).map(([k, v]) => `${k} ${v}`).join(', ')}. Mixed (taxable + exempt) bills: ${bills.filter((b) => b.mixed_invoice === 'YES').length}. Bills where the app formula is expected to differ from the correct rule: ${bills.filter((b) => b.app_differs.startsWith('YES')).length} (difference ${money(billSum('app_formula_total') - billSum('total'))}).

${tbl(['Payment mode', 'Amount'], Object.entries(payByMode).map(([k, v]) => [k, money(v)]))}

${tbl(['Paid against', 'Amount'], Object.entries(payByType).map(([k, v]) => [k, money(v)]))}

Total payments: **${money(pays.reduce((s, p) => s + num(p.amount), 0))}** across ${pays.length} payment rows (partial payments: ${pays.filter((p) => p.kind.startsWith('PARTIAL')).length} — not recordable in the app).

## 6. GST invoice register (expected)
${tbl(['Source', 'Invoices', 'Taxable value', 'Exempt value', 'CGST', 'SGST', 'Total'], [...bySource, ['ALL', gAll]].map(([s, t]) => [s, t.n, money(t.taxable), money(t.exempt), money(t.cgst), money(t.sgst), money(t.total)]))}

Line-level turnover from the classified bill lines (the correct basis for encounters):

${tbl(['Basis', 'Taxable value', 'Exempt value', 'CGST + SGST'], [
  ['Patient bills — lines', money(lineTurnover.PATIENT.taxable), money(lineTurnover.PATIENT.exempt), money(lineTurnover.PATIENT.tax)],
  ['Collect-Payment invoices (app register)', money(bySource[0][1].taxable), money(bySource[0][1].exempt), money(bySource[0][1].cgst + bySource[0][1].sgst)],
  ['Pharmacy bills — lines (no GST invoice in app)', money(lineTurnover.PHARMACY.taxable), money(lineTurnover.PHARMACY.exempt), money(lineTurnover.PHARMACY.tax)],
])}

The Collect-Payment register cannot match the patient-bill lines: the app's invoice is single-line per visit, so consultation fees on procedure visits are left off, and IPD bills are posted as one exempt line (their taxable medicines lose GST). Pharmacy bills (PH-) never reach the GST invoice register. Partial-paid and unpaid bills have no invoice. These gaps are expected findings, not dataset errors — see the notes column of \`26_gst_invoice_register.csv\`. **Every classification is test configuration and must be confirmed by a qualified Indian GST professional.**

## 7. Stock movements
${tbl(['Medicine', 'Name', 'Received', 'Dispensed', 'Retail', 'Consumed', 'Adjust', 'Closing', 'Reorder', 'State'], meds.map((m) => {
  const s = summary[m.medicine_id]; const c = stock[m.medicine_id] || 0;
  return [m.medicine_id, m.name.replace(' (Test)', ''), s.RECEIPT, -s.DISPENSE, -s.RETAIL, -s.CONSUMED, s.ADJUST, c, m.reorder_point, c === 0 ? 'ZERO' : c <= num(m.reorder_point) ? 'LOW' : 'OK'];
}))}

Expected batch behaviour (correct policy: earliest-expiry first, **never an expired batch**):
${tbl(['Batch', 'Medicine', 'Expiry', 'Received', 'Expected remaining'], batches.map((b) => [b.batch_ref, b.medicine_id, b.expiry_date + (b.expiry_state_on_2026_10_12 === 'OK' ? '' : ` (${b.expiry_state_on_2026_10_12.split(' ')[0]})`), b.qty_received, batchLeft[b.batch_ref]]))}

${fefoNotes.length ? `Batch coverage notes:\n${fefoNotes.map((n) => `- ${n}`).join('\n')}` : 'All dispenses are coverable by non-expired batches.'}

> Known app behaviour to verify: the app's stock deduction picks the earliest expiry **including expired batches**, and manual stock adjustments do not touch batch quantities. Compare the app's batch trace for M14 (CET-A1 expired 2026-09-30) with the table above.

## 8. Duplicates and integrity
- Duplicate patient IDs / names / phones: ${uniq(patients.map((p) => p.patient_id)) && uniq(patients.map((p) => p.full_name)) && uniq(patients.map((p) => p.phone)) ? 'none' : 'FOUND'}.
- Missing references: ${missing.length ? missing.length : 'none'}.
- Deliberate duplicate-registration probes (not imported as patients): see \`13_duplicate_registration_probes.csv\`.
`;
fs.writeFileSync(path.join(REPORTS, 'reconciliation.md'), md, 'utf8');

console.log(`[TEST DATA] ${results.length} checks, ${failed.length} failed`);
for (const r of failed) console.log(`  FAIL ${r.section} — ${r.name}: ${r.detail}`);
console.log(`Encounters/day: min ${Math.min(...loads)} max ${Math.max(...loads)} | bills ${bills.length} | payments ${money(pays.reduce((s, p) => s + num(p.amount), 0))}`);
if (fefoNotes.length) console.log('FEFO notes:', fefoNotes);
console.log('Report:', path.join(REPORTS, 'reconciliation.md'));
process.exit(failed.length ? 1 : 0);
