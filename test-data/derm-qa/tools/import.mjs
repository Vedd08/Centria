#!/usr/bin/env node
/**
 * [TEST DATA] Step H.3 — populate the isolated QA environment through the application's
 * own API, as the role that does each job (reception checks in, doctors assess and order,
 * staff perform, the pharmacist dispenses, nurses chart).
 *
 * Resumable: every finished unit of work is recorded in runtime/import-state.json, so a
 * re-run skips it. Every API outcome is appended to runtime/import-log.jsonl.
 * For each record created, the intended (dataset) timestamp is recorded for align-timestamps.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { API, QA_DIR, RUNTIME, importDay, loadState, prisma, readCsv, saveState } from './env.mjs';

const state = loadState();
const S = (k) => (state[k] ||= {});
const save = () => saveState(state);
const LOG = path.join(RUNTIME, 'import-log.jsonl');
const log = (entry) => fs.appendFileSync(LOG, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
const db = prisma();

// ───────── data ─────────
const cfg = readCsv('00_')[0];
const PASSWORD = cfg.testPassword;
const LIVE = importDay();
const depts = readCsv('01_'), staff = readCsv('02_'), sched = readCsv('03_'), treatments = readCsv('06_');
const pkgTypes = readCsv('07_'), meds = readCsv('08_'), vendors = readCsv('09_'), purchases = readCsv('10_'), batches = readCsv('11_');
const patients = readCsv('12_'), appts = readCsv('14_'), probes = readCsv('15_'), encs = readCsv('16_'), orders = readCsv('17_');
const procs = readCsv('18_'), pps = readCsv('19_'), adms = readCsv('20_'), pnotes = readCsv('21_'), mos = readCsv('22_'), mas = readCsv('23_');
const docs = readCsv('24_'), bills = readCsv('25_'), gst = readCsv('26_'), pays = readCsv('27_'), retail = readCsv('28_');
const adjs = readCsv('30_'), calls = readCsv('32_'), templates = readCsv('33_'), hist = readCsv('34_');
const STAFF = Object.fromEntries(staff.map((s) => [s.staff_id, s]));
const P = Object.fromEntries(patients.map((p) => [p.patient_id, p]));
const by = (rows, k) => rows.reduce((m, r) => ((m[r[k]] ||= []).push(r), m), {});
const ordersByEnc = by(orders, 'encounter_id'), procsByEnc = by(procs, 'encounter_id'), docsByEnc = by(docs, 'encounter_id');
const billsByEnc = by(bills, 'encounter_id'), gstByEnc = by(gst.filter((g) => g.source === 'COLLECT_PAYMENT'), 'encounter_id');
const apptByEnc = Object.fromEntries(appts.filter((a) => a.encounter_id).map((a) => [a.encounter_id, a]));
const ppByEnc = Object.fromEntries(pps.map((p) => [p.encounter_id, p]));
const admByEnc = Object.fromEntries(adms.filter((a) => a.encounter_id).map((a) => [a.encounter_id, a]));
const payByTarget = Object.fromEntries(pays.map((p) => [p.target_ref, p]));

const at = (date, hhmm = '09:00') => new Date(`${date}T${hhmm}:00+05:30`).toISOString();
const minus = (hhmm, m) => { const [h, mm] = hhmm.split(':').map(Number); const t = h * 60 + mm - m; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

// ───────── HTTP as a role ─────────
const tokens = S('tokens');
async function login(email) {
  const r = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }) });
  const d = await r.json();
  if (!d.accessToken) throw new Error(`login failed ${email}: ${JSON.stringify(d)}`);
  return d.accessToken;
}
async function tokenFor(who) {
  if (!tokens[who]) tokens[who] = await login(who === 'S00' ? 's00.super_admin@aurora-qa.test' : STAFF[who].email);
  return tokens[who];
}
class ApiError extends Error { constructor(status, body, msg) { super(msg); this.status = status; this.body = body; } }
async function call(who, method, url, body, { form } = {}) {
  const headers = { Authorization: `Bearer ${await tokenFor(who)}` };
  if (!form) headers['Content-Type'] = 'application/json';
  const r = await fetch(`${API}${url}`, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  if (r.status === 401 && tokens[who]) { delete tokens[who]; return call(who, method, url, body, { form }); }
  if (!r.ok) throw new ApiError(r.status, data, `${method} ${url} → ${r.status} ${JSON.stringify(data?.message ?? data)}`);
  return data;
}
/** A call whose outcome is a test result (may be rejected by design). */
async function attempt(label, expected, fn) {
  try {
    const res = await fn();
    log({ kind: 'PROBE', label, expected, outcome: 'ACCEPTED' });
    return { ok: true, res };
  } catch (e) {
    log({ kind: 'PROBE', label, expected, outcome: `REJECTED ${e.status}`, message: e.body?.message ?? e.message });
    return { ok: false, error: e };
  }
}

// ───────── timestamp capture ─────────
// Before an event we note the time; afterwards every row created since then gets the
// dataset's intended timestamp recorded per model (applied later by align-timestamps.mjs).
const align = (state.align ||= []);
const ALIGN_MODELS = ['patient', 'visit', 'patientQueue', 'careOrder', 'batchDispenseRecord', 'stockMovement', 'invoice', 'encounterBill',
  'packagePurchase', 'appointment', 'patientDocument', 'admission', 'progressNote', 'medicationOrder', 'medicationAdministration',
  'commissionRecord', 'followUpCall', 'purchase', 'medicineBatch', 'retailSale', 'prescription'];
/** For timestamps an update sets on an existing row (seenAt, dispensedAt, paidAt…). */
const alignRow = (model, idOrWhere, times) => {
  align.push(typeof idOrWhere === 'string' ? { model, id: idOrWhere, times } : { model, where: idOrWhere, times });
  save();
};
async function captured(times, fn) {
  const since = new Date(Date.now() - 5);
  const res = await fn();
  await new Promise((r) => setTimeout(r, 5));
  for (const model of ALIGN_MODELS) {
    if (!db[model]) continue;
    const rows = await db[model].findMany({ where: { createdAt: { gte: since } }, select: { id: true } });
    for (const { id } of rows) align.push({ model, id, times });
  }
  save();
  return res;
}

// ───────── 1. setup ─────────
async function setup() {
  const done = S('setup');
  const ids = S('ids');
  if (!done.departments) {
    for (const d of depts) ids[d.dept_id] = (await call('S00', 'POST', '/departments', { name: d.name, code: d.code, description: d.description })).id;
    done.departments = true; save();
  }
  if (!done.users) {
    // Doctors first, so nurses/staff can be linked to their doctor.
    const ordered = [...staff.filter((s) => s.role === 'DOCTOR'), ...staff.filter((s) => s.role !== 'DOCTOR')];
    for (const s of ordered) {
      if (ids[s.staff_id]) continue;
      const u = await call('S00', 'POST', '/users', {
        email: s.email, password: PASSWORD, name: s.name, role: s.role,
        departmentId: s.dept_id ? ids[s.dept_id] : undefined, assignedDoctorId: s.assigned_doctor ? ids[s.assigned_doctor] : undefined,
      });
      ids[s.staff_id] = u.id; save();
    }
    done.users = true; save();
  }
  if (!done.schedules) {
    for (const doc of [...new Set(sched.map((s) => s.doctor))]) {
      await call('S01', 'PATCH', `/appointments/schedule/${ids[doc]}`, {
        schedules: sched.filter((s) => s.doctor === doc).map((s) => ({ dayOfWeek: Number(s.day_of_week), startTime: s.start_time, endTime: s.end_time, slotDurationInMinutes: Number(s.slot_minutes) })),
      });
    }
    done.schedules = true; save();
  }
  if (!done.treatments) {
    for (const t of treatments) {
      if (ids[t.treatment_id]) continue;
      ids[t.treatment_id] = (await call('S01', 'POST', '/treatments', { name: t.name, isGstTaxable: t.is_gst_taxable === 'YES', price: Number(t.price), hsnCode: t.sac_code, taxRate: Number(t.tax_rate) })).id;
      save();
    }
    done.treatments = true; save();
  }
  if (!done.packageTypes) {
    for (const p of pkgTypes) {
      if (ids[p.package_type_id]) continue;
      ids[p.package_type_id] = (await call('S01', 'POST', '/packages/types', {
        name: p.name, description: p.description, price: Number(p.price), totalSittings: Number(p.total_sittings),
        isGstTaxable: p.is_gst_taxable === 'YES', sittingGapDays: Number(p.sitting_gap_days), treatmentId: ids[p.treatment_id], doctorId: ids[p.doctor],
      })).id;
      save();
    }
    done.packageTypes = true; save();
  }
  if (!done.medicines) {
    for (const m of meds) {
      if (ids[m.medicine_id]) continue;
      ids[m.medicine_id] = (await call('S12', 'POST', '/medicines', {
        name: m.name, unit: m.unit, stockQty: 0, reorderPoint: Number(m.reorder_point), unitPrice: Number(m.unit_price),
        isGstTaxable: m.is_gst_taxable === 'YES', hsnCode: m.hsn_code, taxRate: Number(m.tax_rate), shelf: m.shelf,
      })).id;
      save();
    }
    done.medicines = true; save();
  }
  if (!done.ward) {
    const ward = await call('S01', 'POST', '/wards', { name: 'QA Surgical Ward', floor: '1 (TEST)' });
    ids.WARD = ward.id;
    for (const b of ['B1', 'B2', 'B3', 'B4']) ids[`BED-${b}`] = (await call('S01', 'POST', `/wards/${ward.id}/beds`, { bedNumber: b })).id;
    done.ward = true; save();
  }
  if (!done.templates) {
    for (const t of templates) {
      await call(t.doctor, 'POST', '/prescription-templates', {
        name: t.name, condition: t.condition, diagnosis: t.condition,
        items: t.items.split(';').map((m) => ({ orderType: 'MEDICINE', medicineId: ids[m], description: meds.find((x) => x.medicine_id === m).name, quantity: 1 })),
      });
    }
    done.templates = true; save();
  }
  console.log('setup done');
}

// ───────── 2. patients + history ─────────
async function registerPatients() {
  const pid = S('patients'), uhid = S('uhid');
  for (const p of patients) {
    if (pid[p.patient_id]) continue;
    const created = await captured({ createdAt: at(p.registration_date, '09:05') }, () => call('S02', 'POST', '/patients', {
      name: p.full_name, phone: p.phone, email: p.email_synthetic, dob: p.dob, gender: p.gender, address: p.address,
      allergyNotes: p.allergies, referringDoctor: p.referring_doctor || undefined, howHeardAboutUs: p.referral_source,
    }));
    pid[p.patient_id] = created.id; uhid[p.patient_id] = created.uhid; save();
  }
  const hv = S('historical');
  for (const h of hist) {
    if (hv[h.hv_ref]) continue;
    const v = await captured({ createdAt: at(h.date, '11:00') }, () => call(h.doctor, 'POST', '/visits', {
      patientId: pid[h.patient_id], doctorId: S('ids')[h.doctor], operator: STAFF[h.doctor].name, diagnosis: h.diagnosis,
      remarks: h.remarks, cashAmount: Number(h.cash_amount), bankAmount: 0, status: h.status, date: h.date, visitType: h.visit_type,
    }));
    hv[h.hv_ref] = v.id; save();
  }
  console.log(`patients: ${Object.keys(pid).length}, historical visits: ${Object.keys(hv).length}`);
}

// ───────── 3. timeline ─────────
function buildTimeline() {
  const ev = [];
  for (const p of purchases) ev.push({ type: 'PURCHASE', key: p.purchase_ref, date: p.invoice_date, time: '08:00', row: p });
  for (const e of encs) if (e.date !== cfg.liveDay) ev.push({ type: 'ENCOUNTER', key: e.encounter_id, date: e.date, time: e.check_in_time, row: e });
  for (const a of appts.filter((x) => !x.encounter_id)) ev.push({ type: 'APPOINTMENT', key: a.appointment_ref, date: a.date, time: '07:00', row: a });
  for (const a of adjs) ev.push({ type: 'ADJUST', key: a.ref, date: a.date, time: a.source === 'MANUAL' ? '18:30' : (encs.find((e) => e.encounter_id && a.reason.includes(e.patient_id) && e.date === a.date)?.completed_time || '18:00'), row: a });
  for (const r of retail) ev.push({ type: 'RETAIL', key: r.retail_ref, date: r.date, time: '17:15', row: r });
  for (const a of adms.filter((x) => x.discharge_date)) ev.push({ type: 'DISCHARGE', key: a.admission_ref, date: a.discharge_date, time: '11:30', row: a });
  for (const c of calls) ev.push({ type: 'CALL', key: c.call_ref, date: c.due_date, time: '18:45', row: c });
  // Receipts before anything else that day; manual adjustments after the day's dispensing.
  const rank = { PURCHASE: 0, APPOINTMENT: 1, ENCOUNTER: 2, ADJUST: 3, RETAIL: 3, DISCHARGE: 4, CALL: 5 };
  return ev.sort((a, b) => a.date.localeCompare(b.date) || rank[a.type] - rank[b.type] || a.time.localeCompare(b.time));
}

async function doPurchase(p) {
  const ids = S('ids');
  const lines = batches.filter((b) => b.purchase_ref === p.purchase_ref);
  const vendor = vendors.find((v) => v.vendor_id === p.vendor_id);
  await captured({ createdAt: at(p.invoice_date, '08:00') }, () => call('S12', 'POST', '/purchases', {
    vendorName: vendor.name, vendorGstn: vendor.gstin, invoiceNumber: p.vendor_invoice_no, invoiceDate: p.invoice_date,
    itemDescription: `[TEST] Medicine stock — ${lines.length} lines`, inputClassification: 'Medicine Stock', itcEligibility: 'Full',
    taxableValue: Number(p.taxable_value), igst: Number(p.igst), cgst: Number(p.cgst), sgst: Number(p.sgst),
    items: lines.map((b) => ({ medicineId: ids[b.medicine_id], batchNumber: b.batch_ref, expiryDate: b.expiry_date, quantity: Number(b.qty_received), costPrice: Number(b.cost_price) })),
  }));
}

const iso = (date, time) => `${date}T${time}:00+05:30`;
async function bookAppointment(a, { complete } = {}) {
  const ids = S('ids'), pid = S('patients'), ap = S('appointments');
  if (ap[a.appointment_ref]) return ap[a.appointment_ref];
  const [odate, otime] = a.rescheduled_from ? a.rescheduled_from.split(' ') : [a.date, a.start_time];
  const created = await captured({ createdAt: at(odate < a.date ? odate : a.date, '07:30') }, () => call('S02', 'POST', '/appointments', {
    patientId: pid[a.patient_id], doctorId: ids[a.doctor], startTime: iso(odate, otime), reasonForVisit: a.reason, status: 'Scheduled',
  }));
  if (a.rescheduled_from) await call('S02', 'PATCH', `/appointments/${created.id}`, { startTime: iso(a.date, a.start_time) });
  if (['Cancelled', 'No-Show'].includes(a.status)) await call('S02', 'PATCH', `/appointments/${created.id}`, { status: a.status });
  ap[a.appointment_ref] = created.id; save();
  return created.id;
}

function doctorNotes(e, p) {
  const lines = ['[SIMULATED CLINICAL RECORD — TEST DATA, NOT MEDICAL ADVICE]'];
  if (e.chief_complaint) lines.push(`Chief complaint: ${e.chief_complaint}`);
  if (e.history) lines.push(`History: ${e.history}${e.visit_kind === 'NEW' ? ` Past history: ${p.medical_history}. Allergies: ${p.allergies}.` : ''}`);
  if (e.examination) lines.push(`Examination: ${e.examination}`);
  if (e.diagnosis) lines.push(`Diagnosis (${e.diagnosis_status || 'CONFIRMED'}): ${e.diagnosis}`);
  if (e.assessment) lines.push(`Assessment: ${e.assessment}`);
  if (e.plan) lines.push(`Plan: ${e.plan}`);
  if (e.notes_extra) lines.push(`Note: ${e.notes_extra}`);
  lines.push(`Follow-up: ${e.follow_up_recommendation || 'as advised'}`);
  return lines.join('\n');
}

const receptionFor = (doc) => (doc === 'D1' || doc === 'D4' ? 'S02' : 'S03');

async function doEncounter(e) {
  const ids = S('ids'), pid = S('patients'), q = S('queue'), done = S('encDone');
  if (done[e.encounter_id]) return;
  const p = P[e.patient_id];
  const T = { checkin: at(e.date, e.check_in_time), seen: at(e.date, e.seen_time || e.check_in_time), done: at(e.date, e.completed_time || e.seen_time || e.check_in_time) };
  const reception = receptionFor(e.doctor);
  const st = (q[e.encounter_id] ||= {});

  // Appointment (booked / rescheduled) — created before the visit.
  const appt = apptByEnc[e.encounter_id];
  if (appt && !st.appt) { st.appt = await bookAppointment(appt); save(); }

  // Check-in
  if (!st.queueId) {
    const entry = await captured({ createdAt: T.checkin, checkedInAt: T.checkin }, () => call(reception, 'POST', '/queue', {
      patientId: pid[e.patient_id], complaint: e.reception_complaint, departmentId: ids[e.department], doctorId: ids[e.doctor], queueDate: e.date,
    }));
    st.queueId = entry.id; st.token = entry.tokenNumber; save();
  }

  // Package sale at reception before the session
  const pp = ppByEnc[e.encounter_id];
  if (pp && !S('packages')[pp.purchase_ref]) {
    const sale = await captured({ createdAt: T.checkin, issuedAt: T.checkin }, () => call('S02', 'POST', '/packages/purchases', {
      patientId: pid[e.patient_id], packageTypeId: ids[pp.package_type_id], amountPaid: Number(pp.amount_paid),
      discountReason: pp.discount_reason || undefined, purchaseDate: pp.purchase_date, paymentMethod: pp.payment_method,
    }));
    S('packages')[pp.purchase_ref] = sale.id; save();
  }

  // Doctor's assessment
  if (!st.assessed) {
    const body = {
      careType: e.care_type, diagnosis: e.diagnosis, doctorNotes: doctorNotes(e, p), patientNotes: e.patient_notes || undefined,
      staffNotes: e.staff_notes || undefined, consultationFee: Number(e.consultation_fee),
      ...(e.condition_trend ? { conditionTrend: e.condition_trend } : {}),
      ...(/^\d{4}-\d{2}-\d{2}$/.test(e.next_appointment_date) ? { nextAppointmentDate: e.next_appointment_date } : {}),
      ...(e.treatment_id ? { treatmentId: ids[e.treatment_id] } : {}),
      ...(e.redeem_package_ref ? { usePackagePurchaseId: S('packages')[e.redeem_package_ref] } : {}),
    };
    const res = await captured({ createdAt: T.seen }, () => call(e.doctor, 'PATCH', `/queue/${st.queueId}/assess`, body));
    alignRow('patientQueue', st.queueId, { seenAt: T.seen });
    st.assessed = true; st.visitId = res.visitId; save();
  }

  // Orders: medicines/treatments from the dataset, plus a procedure record for OPD procedures.
  const ordRows = ordersByEnc[e.encounter_id] || [];
  const om = (st.orders ||= {});
  for (const o of ordRows) {
    if (om[o.order_id]) continue;
    const created = await captured({ createdAt: T.seen }, () => call(e.doctor, 'POST', '/care-orders', {
      queueId: st.queueId, orderType: o.order_type,
      ...(o.medicine_id ? { medicineId: ids[o.medicine_id] } : {}), ...(o.treatment_id ? { treatmentId: ids[o.treatment_id] } : {}),
      ...(o.not_stocked === 'YES' ? { notStocked: true, description: o.description } : {}),
      dosage: o.dosage || undefined, route: o.route || undefined, frequency: o.frequency || undefined,
      instructions: [o.instructions, o.scenario ? `[TEST scenario: ${o.scenario}]` : ''].filter(Boolean).join(' ') || undefined,
      quantity: Number(o.quantity),
    }));
    om[o.order_id] = created.id; save();
  }
  const procRows = (procsByEnc[e.encounter_id] || []).filter(() => e.care_type === 'OPD');
  for (const pr of procRows) {
    if (om[pr.procedure_ref]) continue;
    const created = await captured({ createdAt: T.seen }, () => call(e.doctor, 'POST', '/care-orders', {
      queueId: st.queueId, orderType: 'OTHER', description: `Procedure record — ${pr.procedure} [${pr.state}]`,
      instructions: `[TEST] Indication: ${pr.indication}. Contraindication review: ${pr.contraindication_review}. Consent: ${pr.consent_status}. Checklist: ${pr.checklist}. Media: ${pr.pre_procedure_media}.`,
      quantity: 1,
    }));
    om[pr.procedure_ref] = created.id; save();
  }

  // Perform / dispense / cancel
  const pf = (st.performed ||= {});
  for (const o of ordRows) {
    if (pf[o.order_id]) continue;
    const id = om[o.order_id];
    const performer = o.performed_by && ['DOCTOR', 'NURSE', 'STAFF'].includes(STAFF[o.performed_by]?.role) ? o.performed_by : null;
    if (o.dispensed === 'YES') {
      await captured({ createdAt: T.done }, () => call('S12', 'PATCH', `/care-orders/${id}/dispense`));
      alignRow('careOrder', id, { dispensedAt: T.done });
    } else if (['INSUFFICIENT_STOCK', 'UNAVAILABLE_ZERO_STOCK'].includes(o.scenario)) {
      await attempt(`dispense ${o.order_id} (${o.scenario})`, 'REJECT — not enough stock', () => call('S12', 'PATCH', `/care-orders/${id}/dispense`));
    }
    if (o.final_status === 'DONE' && performer) {
      const pr = (procsByEnc[e.encounter_id] || []).find((x) => x.treatment_id === o.treatment_id);
      await call(performer, 'PATCH', `/care-orders/${id}/perform`, {
        performNotes: pr ? `${pr.procedure_notes} Consumables: ${pr.consumables_used}. Post-op: ${pr.post_procedure_instructions}` : `[TEST] ${o.description} given/applied as ordered.`,
      });
      alignRow('careOrder', id, { performedAt: T.done });
    }
    pf[o.order_id] = true; save();
  }
  for (const pr of procRows) {
    if (pf[pr.procedure_ref]) continue;
    const id = om[pr.procedure_ref];
    if (['COMPLETED', 'MISSING_DOCUMENTATION'].includes(pr.state)) {
      await call(pr.assigned_staff, 'PATCH', `/care-orders/${id}/perform`, {
        performNotes: `${pr.procedure_notes} Consumables: ${pr.consumables_used || 'none'}. Post-procedure: ${pr.post_procedure_instructions}`,
      });
      alignRow('careOrder', id, { performedAt: T.done });
    } else if (['PENDING_CONSENT', 'POSTPONED'].includes(pr.state)) {
      await call(e.doctor, 'PATCH', `/care-orders/${id}/cancel`);
    } // AWAITING_STAFF_SIGN_OFF stays ORDERED on purpose
    pf[pr.procedure_ref] = true; save();
  }

  // Documents
  const dd = (st.docs ||= {});
  for (const d of docsByEnc[e.encounter_id] || []) {
    if (dd[d.doc_ref] || d.admission_ref) continue; // admission documents are uploaded after admitting
    await uploadDoc(d, st.visitId, null, T.done);
    dd[d.doc_ref] = true; save();
  }

  // Admission (IPD): completes the queue entry.
  const adm = admByEnc[e.encounter_id];
  if (adm && !S('admissions')[adm.admission_ref]) await admit(adm, st, e);

  // Bills and payments
  const bb = (st.bills ||= {});
  for (const b of billsByEnc[e.encounter_id] || []) {
    if (bb[b.bill_ref]) continue;
    const path = b.kind === 'PHARMACY' ? 'pharmacy-bill' : 'bill';
    const opened = await captured({ createdAt: T.done }, () => call(b.kind === 'PHARMACY' ? 'S12' : receptionFor(e.doctor), 'GET', `/queue/${st.queueId}/${path}`));
    st[`${b.kind}_billNumber`] = opened.billNumber;
    st[`${b.kind}_appTotal`] = opened.totalAmount;
    if (b.payment_status === 'PAID') {
      const pay = payByTarget[b.bill_ref];
      await call(b.kind === 'PHARMACY' ? 'S12' : receptionFor(e.doctor), 'PATCH', `/queue/${st.queueId}/${path}/payment`, {
        status: 'PAID', mode: pay.mode, details: JSON.parse(pay.details_json || '{}'),
      });
      alignRow('encounterBill', { queueId: st.queueId, kind: b.kind }, { paidAt: T.done });
    } else if (b.payment_status === 'PARTIAL') {
      log({ kind: 'UNSUPPORTED', label: `${b.bill_ref} partial payment ₹${b.amount_paid} of ₹${b.total}`, outcome: 'left UNPAID — app has no partial payments' });
    }
    bb[b.bill_ref] = true; save();
  }

  // GST invoice via Collect Payment (one per visit)
  const gg = (st.invoices ||= {});
  for (const g of gstByEnc[e.encounter_id] || []) {
    if (gg[g.invoice_ref]) continue;
    const bill = (billsByEnc[e.encounter_id] || []).find((b) => b.kind === 'PATIENT');
    const pay = bill && payByTarget[bill.bill_ref];
    const payment = pay?.mode ? { paymentMode: pay.mode, paymentDetails: JSON.parse(pay.details_json || '{}') } : { paymentMethod: 'bank' };
    const body = { visitId: st.visitId, taxableValue: Number(g.taxable_value), ...payment };
    if (!state.cancelledInvoiceDone && Number(g.taxable_value) > 0 && e.date >= cfg.windowStart) {
      // CANCELLED_INVOICE scenario: issue with a wrong amount, cancel (delete), re-issue.
      const wrong = await captured({ createdAt: T.done, issuedAt: T.done }, () => call('S02', 'POST', '/invoices', { ...body, taxableValue: Number(g.taxable_value) * 10 }));
      await call('S01', 'DELETE', `/invoices/${wrong.id}`);
      log({ kind: 'SCENARIO', label: 'CANCELLED_INVOICE', ref: g.invoice_ref, outcome: `issued ${wrong.invoiceNumber} with ₹${Number(g.taxable_value) * 10}, hard-deleted, re-issued` });
      state.cancelledInvoice = { ref: g.invoice_ref, wrongNumber: wrong.invoiceNumber };
      state.cancelledInvoiceDone = true;
    }
    const inv = await captured({ createdAt: T.done, issuedAt: T.done }, () => call('S02', 'POST', '/invoices', body));
    S('invoiceMap')[g.invoice_ref] = { id: inv.id, number: inv.invoiceNumber };
    if (state.cancelledInvoice?.ref === g.invoice_ref) {
      state.cancelledInvoice.reissuedNumber = inv.invoiceNumber;
      log({ kind: 'PROBE', label: 'INVOICE_NUMBER_REUSE', expected: 'cancelled number never reused', outcome: inv.invoiceNumber === state.cancelledInvoice.wrongNumber ? `REUSED ${inv.invoiceNumber}` : `new number ${inv.invoiceNumber}` });
    }
    gg[g.invoice_ref] = true; save();
  }

  // Close the encounter and its appointment
  if (!st.closed) {
    if (!adm) {
      await call(reception, 'PATCH', `/queue/${st.queueId}/status`, { status: 'COMPLETED' });
      alignRow('patientQueue', st.queueId, { completedAt: T.done });
    }
    if (st.appt) await call(reception, 'PATCH', `/appointments/${st.appt}`, { status: 'Completed' });
    st.closed = true; save();
  }
  done[e.encounter_id] = true; save();
}

async function uploadDoc(d, visitId, admissionId, when) {
  const pid = S('patients');
  const file = path.join(QA_DIR, d.file);
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)], { type: d.mime_type }), path.basename(file));
  form.append('patientId', pid[d.patient_id]);
  form.append('category', d.category);
  form.append('title', d.title);
  form.append('description', '[TEST DATA] Synthetic placeholder — no real person, not a signed document');
  if (visitId) form.append('visitId', visitId);
  if (admissionId) form.append('admissionId', admissionId);
  await captured({ createdAt: when }, () => call(d.uploaded_by, 'POST', '/patient-documents', null, { form }));
}

async function admit(adm, st, e) {
  const ids = S('ids'), pid = S('patients'), A = S('admissions');
  alignRow('patientQueue', st.queueId, { completedAt: at(adm.admission_date, '08:30') });
  const admission = await captured({ createdAt: at(adm.admission_date, '08:30') }, () => call('D4', 'POST', '/admissions', {
    patientId: pid[adm.patient_id], doctorId: ids.D4, bedId: ids[`BED-${adm.bed}`], admissionDate: adm.admission_date, queueId: st.queueId,
    reasonForAdmission: `[${adm.admission_ref}] ${adm.indication}. Planned: ${adm.planned_procedure}. Consent: ${adm.consent_status}. Pre-op: ${adm.preop_checklist}. Anaesthesia: ${adm.anaesthesia}. Care team: ${adm.care_team}.`,
  }));
  A[adm.admission_ref] = admission.id; save();
  for (const n of pnotes.filter((x) => x.admission_ref === adm.admission_ref)) {
    const t = at(...n.recorded_at.split(' '));
    await captured({ createdAt: t, recordedAt: t }, () => call(n.author, 'POST', `/admissions/${admission.id}/progress-notes`, {
      note: n.note, noteType: n.note_type, ...(n.status ? { status: n.status } : {}),
      ...(n.blood_pressure ? { bloodPressure: n.blood_pressure, pulse: Number(n.pulse), temperature: Number(n.temperature) } : {}),
    }));
  }
  for (const m of mos.filter((x) => x.admission_ref === adm.admission_ref)) {
    const mo = await captured({ createdAt: at(m.start_date, '08:45') }, () => call('D4', 'POST', '/medication-orders', {
      admissionId: admission.id, medicineId: ids[m.medicine_id], dosage: m.dosage, route: m.route, frequency: m.frequency,
      startDate: m.start_date, endDate: m.end_date || undefined, doctorId: ids.D4, instructions: '[TEST] As charted',
    }));
    for (const a of mas.filter((x) => x.mo_ref === m.mo_ref)) {
      const t = at(...a.administered_at.split(' '));
      await captured({ createdAt: t, administeredAt: t }, () => call(a.by, 'POST', `/medication-orders/${mo.id}/administrations`, { status: a.status, notes: a.notes || undefined }));
    }
  }
  for (const d of docs.filter((x) => x.admission_ref === adm.admission_ref)) {
    if (d.category === 'DISCHARGE_SUMMARY') continue; // uploaded at discharge
    await uploadDoc(d, null, admission.id, at(adm.admission_date, '10:00'));
  }
}

async function doDischarge(a) {
  const A = S('admissions'), dz = S('discharged');
  if (dz[a.admission_ref] || !A[a.admission_ref]) return;
  await call('D4', 'PATCH', `/admissions/${A[a.admission_ref]}/discharge`, { dischargeSummary: a.discharge_summary });
  alignRow('admission', A[a.admission_ref], { dischargeDate: at(a.discharge_date, '11:30') });
  for (const d of docs.filter((x) => x.admission_ref === a.admission_ref && x.category === 'DISCHARGE_SUMMARY')) await uploadDoc(d, null, A[a.admission_ref], at(a.discharge_date, '11:45'));
  dz[a.admission_ref] = true; save();
}

async function doAdjust(a, time) {
  const ids = S('ids'), dn = S('adjustments');
  if (dn[a.ref]) return;
  await captured({ createdAt: at(a.date, time) }, () => call('S12', 'PATCH', `/medicines/${ids[a.medicine_id]}/stock`, { delta: Number(a.delta), reason: a.reason }));
  dn[a.ref] = true; save();
}

async function doRetail(r) {
  const ids = S('ids'), dn = S('retail');
  if (dn[r.retail_ref]) return;
  const pay = pays.find((p) => p.target_type === 'RETAIL_INVOICE' && p.date === r.date);
  const items = r.items.split(';').map((it) => { const [m, qty] = it.split('x'); return { medicineId: ids[m], quantity: Number(qty), unitPrice: Number(meds.find((x) => x.medicine_id === m).unit_price) }; });
  const inv = await captured({ createdAt: at(r.date, '17:15'), issuedAt: at(r.date, '17:15') }, () => call('S12', 'POST', '/retail-sales', {
    customerName: r.customer, customerPhone: r.customer_phone || undefined, paymentMode: r.payment_mode, paymentDetails: JSON.parse(pay?.details_json || '{}'), items,
  }));
  const gref = gst.find((g) => g.source === 'RETAIL_SALE' && g.date === r.date)?.invoice_ref;
  if (gref) S('invoiceMap')[gref] = { id: inv.id, number: inv.invoiceNumber };
  dn[r.retail_ref] = true; save();
}

async function doCall(c) {
  const dn = S('calls');
  if (dn[c.call_ref]) return;
  const visit = await db.visit.findFirst({ where: { patientId: S('patients')[c.patient_id] }, orderBy: { date: 'desc' }, select: { id: true } });
  if (!visit) { log({ kind: 'SKIP', label: `${c.call_ref} no visit to reference` }); dn[c.call_ref] = true; save(); return; }
  await captured({ createdAt: at(c.due_date, '18:45') }, () => call(c.called_by, 'POST', '/follow-ups/calls', {
    patientId: S('patients')[c.patient_id], kind: c.kind, refId: visit.id, dueDate: c.due_date, outcome: c.outcome, note: c.note,
    // The app only accepts a call-back date from today onwards (real clock), so a back-dated
    // call cannot carry its historical call-back date.
    ...(c.outcome === 'CALL_BACK' ? { callBackOn: new Date(Date.now() + 2 * 86400e3 + 5.5 * 3600e3).toISOString().slice(0, 10) } : {}),
  }));
  if (c.outcome === 'CALL_BACK') log({ kind: 'LIMITATION', label: `${c.call_ref} callBackOn`, outcome: 'set to import day + 2 — app rejects past call-back dates' });
  dn[c.call_ref] = true; save();
}

// Package sales are counted at reception; their invoice is created by the app.
async function timeline() {
  const ev = buildTimeline();
  let n = 0;
  for (const x of ev) {
    n++;
    try {
      if (x.type === 'PURCHASE') { if (!S('purchases')[x.key]) { await doPurchase(x.row); S('purchases')[x.key] = true; save(); } }
      else if (x.type === 'ENCOUNTER') await doEncounter(x.row);
      else if (x.type === 'APPOINTMENT') await bookAppointment(x.row);
      else if (x.type === 'ADJUST') await doAdjust(x.row, x.time);
      else if (x.type === 'RETAIL') await doRetail(x.row);
      else if (x.type === 'DISCHARGE') await doDischarge(x.row);
      else if (x.type === 'CALL') await doCall(x.row);
    } catch (err) {
      log({ kind: 'ERROR', event: x.type, key: x.key, message: err.message });
      console.error(`✗ ${x.type} ${x.key} (${x.date}): ${err.message}`);
      throw err;
    }
    if (n % 25 === 0) console.log(`  … ${n}/${ev.length} events (${x.date})`);
  }
  console.log(`timeline done: ${ev.length} events`);
}

// ───────── 4. live queue on import day ─────────
async function liveQueue() {
  const ids = S('ids'), pid = S('patients'), q = S('queue');
  for (const e of encs.filter((x) => x.date === cfg.liveDay)) {
    const st = (q[e.encounter_id] ||= {});
    if (st.closed) continue;
    if (!st.queueId) {
      const entry = await call(receptionFor(e.doctor), 'POST', '/queue', { patientId: pid[e.patient_id], complaint: e.reception_complaint, departmentId: ids[e.department], doctorId: ids[e.doctor], queueDate: LIVE });
      st.queueId = entry.id; st.token = entry.tokenNumber; save();
    }
    if (e.final_queue_status === 'WITH_DOCTOR') await call(receptionFor(e.doctor), 'PATCH', `/queue/${st.queueId}/status`, { status: 'WITH_DOCTOR' });
    if (e.final_queue_status === 'CANCELLED') await call(receptionFor(e.doctor), 'PATCH', `/queue/${st.queueId}/status`, { status: 'CANCELLED' });
    if (e.final_queue_status === 'AWAITING_SERVICE') {
      const res = await call(e.doctor, 'PATCH', `/queue/${st.queueId}/assess`, { careType: 'OPD', diagnosis: e.diagnosis, doctorNotes: `[SIMULATED] ${e.plan}`, consultationFee: Number(e.consultation_fee) });
      st.visitId = res.visitId;
    }
    st.closed = true; save();
  }
  console.log(`live queue on ${LIVE}: ${encs.filter((x) => x.date === cfg.liveDay).length} entries`);
}

// ───────── 5. probes (results are test outcomes) ─────────
async function runProbes() {
  if (state.probesDone) return;
  const ids = S('ids'), pid = S('patients');
  for (const pr of probes.filter((x) => x.patient_id)) {
    const r = await attempt(`APPOINTMENT ${pr.probe}`, pr.expected, () => call('S02', 'POST', '/appointments', {
      patientId: pid[pr.patient_id], doctorId: ids[pr.doctor], startTime: iso(pr.date, pr.start_time), reasonForVisit: `[TEST PROBE] ${pr.probe}`,
    }));
    if (r.ok) await call('S02', 'DELETE', `/appointments/${r.res.id}`); // remove the probe artefact
  }
  const someVisit = Object.values(S('queue')).find((s) => s.invoices && Object.keys(s.invoices).length)?.visitId;
  await attempt('DUPLICATE_INVOICE same visit', 'REJECT 409', () => call('S02', 'POST', '/invoices', { visitId: someVisit, taxableValue: 100, paymentMode: 'CASH' }));
  await attempt('INVALID_INVOICE negative amount', 'REJECT 400', () => call('S02', 'POST', '/invoices', { visitId: someVisit, taxableValue: -50, paymentMode: 'CASH' }));
  await attempt('INVALID_INVOICE no link', 'REJECT 400', () => call('S02', 'POST', '/invoices', { taxableValue: 100, paymentMode: 'CASH' }));
  await attempt('INVALID_PAYMENT UPI without transaction id', 'REJECT 400', () => call('S02', 'POST', '/invoices', { visitId: someVisit, taxableValue: 100, paymentMode: 'UPI', paymentDetails: {} }));
  state.probesDone = true; save();
  console.log('probes done');
}

// ───────── run ─────────
fs.mkdirSync(RUNTIME, { recursive: true });
try {
  await setup();
  await registerPatients();
  await timeline();
  await liveQueue();
  await runProbes();
  console.log(`[TEST DATA] import complete. Timestamps to align: ${align.length} rows (run align-timestamps.mjs).`);
} finally {
  save();
  await db.$disconnect();
}
