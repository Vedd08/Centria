import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { X, CalendarClock, AlertTriangle, CheckCircle2, Circle, History, RotateCcw } from 'lucide-react';
import { PackagePlan, PackageAdjustment, STATE_STYLE, fmtDate, addDaysStr, todayStr, expiryText } from './packagePlan';

interface Props {
  purchaseId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

const ADJ_LABEL: Record<PackageAdjustment['kind'], string> = {
  DOCTOR_DELAY: 'Delay by doctor / clinic',
  PATIENT_LAPSE: 'Missed by patient — lapsed',
  RESCHEDULE: 'Plan changed',
  REINSTATE: 'Reinstated',
  SITTING_UNDONE: 'Sitting undone',
};

/**
 * Sitting plan of one sold package, managed by the doctor/admin: schedule, next
 * sitting, expiry, and who caused a delay — the doctor (red notice, extended at no
 * charge) or the patient (package lapses, buy again).
 */
export const PackagePlanModal: React.FC<Props> = ({ purchaseId, onClose, onChanged }) => {
  const { apiFetch, hasRole } = useAuth();
  const { addToast } = useToast();
  const canManage = hasRole('DOCTOR', 'MASTER', 'SUPER_ADMIN');
  // Reception records sittings (after the nurse has done the treatment); doctor/admin can too.
  const canRecord = hasRole('RECEPTION', 'RM', 'DOCTOR', 'MASTER', 'SUPER_ADMIN');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nextDate, setNextDate] = useState('');
  const [expiry, setExpiry] = useState('');
  const [delayDays, setDelayDays] = useState('7');
  const [delayNote, setDelayNote] = useState('');
  const [lapseNote, setLapseNote] = useState('');
  const [confirmLapse, setConfirmLapse] = useState(false);

  const load = async () => {
    if (!purchaseId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/packages/purchases/${purchaseId}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || 'Could not load the package');
      setData(d);
      setNextDate(d.plan?.nextSittingDate || '');
      setExpiry(d.expiryDate || '');
    } catch (err: any) {
      addToast('error', err.message || 'Could not load the package');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setData(null);
    setDelayNote('');
    setLapseNote('');
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseId]);

  if (!purchaseId) return null;

  const act = async (path: string, method: string, body: any, success: string) => {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/packages/purchases/${purchaseId}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(Array.isArray(d.message) ? d.message.join(', ') : d.message || 'Could not update the package');
      setData(d);
      setNextDate(d.plan?.nextSittingDate || '');
      setExpiry(d.expiryDate || '');
      addToast('success', success);
      onChanged?.();
      return true;
    } catch (err: any) {
      addToast('error', err.message || 'Could not update the package');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const plan: PackagePlan | undefined = data?.plan;
  const adjustments: PackageAdjustment[] = data?.adjustments || [];
  const lastDelay = adjustments.find((a) => a.kind === 'DOCTOR_DELAY');
  const style = plan ? STATE_STYLE[plan.state] : null;
  const isOpenPackage = plan && !['COMPLETED', 'LAPSED'].includes(plan.state);
  const today = todayStr();

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget && !confirmLapse) onClose(); }}
    >
      <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-3xl w-full my-4 overflow-hidden" data-testid="package-plan-modal">
        <div className="bg-brand-deep px-6 py-4 text-white flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold">{data?.packageName || 'Package plan'}</h2>
            <p className="text-xs text-white/80 mt-0.5">
              {data?.patient?.name}{data?.patient?.uhid ? ` · ${data.patient.uhid}` : ''}{data?.patient?.phone ? ` · ${data.patient.phone}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 cursor-pointer" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading || !data || !plan ? (
          <div className="p-10 text-center text-xs text-ink-secondary">Loading…</div>
        ) : (
          <div className="p-5 sm:p-6 space-y-5">
            {/* Notices */}
            {plan.extendedDays > 0 && plan.state !== 'LAPSED' && (
              <div className="flex gap-2.5 p-3 rounded-lg bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Extended +{plan.extendedDays} days — delay caused by the doctor / clinic</p>
                  <p className="mt-0.5 text-status-danger/90">
                    Remaining sittings are covered by this package at no extra charge.
                    {lastDelay && ` Last: ${lastDelay.byName} — "${lastDelay.note}".`}
                  </p>
                </div>
              </div>
            )}
            {plan.state === 'LAPSED' && (
              <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs">
                <div className="flex gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Lapsed on {fmtDate(data.lapsedAt)} — missed by the patient</p>
                    <p className="mt-0.5 text-status-danger/90">
                      {data.sittingsRemaining} remaining sitting(s) forfeited. The patient has to buy the package again.
                      {data.lapseNote && ` Note: ${data.lapseNote}`}
                    </p>
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={() => act('/reinstate', 'POST', {}, 'Package reinstated')}
                    disabled={busy}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-ink-primary bg-surface-card border border-border rounded-md cursor-pointer disabled:opacity-50 shrink-0"
                    title="Undo a lapse marked by mistake"
                  >
                    <RotateCcw className="w-3 h-3" /> Reinstate
                  </button>
                )}
              </div>
            )}
            {plan.state === 'EXPIRED' && (
              <div className="flex gap-2.5 p-3 rounded-lg bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Expired on {fmtDate(plan.expiryDate)} with {data.sittingsRemaining} sitting(s) left</p>
                  <p className="mt-0.5 text-status-danger/90">
                    {canManage
                      ? 'Decide below who caused it: the doctor/clinic (extend, no charge) or the patient (lapse — buy again).'
                      : 'The doctor or admin needs to decide: extend it (clinic delay) or lapse it (patient missed).'}
                  </p>
                </div>
              </div>
            )}
            {plan.sittingsPlannedAfterExpiry > 0 && !['EXPIRED', 'LAPSED'].includes(plan.state) && (
              <div className="flex gap-2.5 p-3 rounded-lg bg-status-warning/10 border border-status-warning/30 text-status-warning text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  {plan.sittingsPlannedAfterExpiry} planned sitting(s) fall after the expiry ({fmtDate(plan.expiryDate)}). Bring the next
                  sitting forward, or extend the package if the clinic is causing the delay.
                </p>
              </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-surface-page border border-border">
                <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">Status</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded border text-[11px] font-semibold ${style!.className}`}>{style!.label}</span>
              </div>
              <div className="p-3 rounded-lg bg-surface-page border border-border">
                <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">Sittings</p>
                <p className="mt-1 font-semibold text-ink-primary">{data.sittingsUsed} of {data.totalSittings} done</p>
                <p className="text-[11px] text-ink-secondary">{data.sittingsRemaining} left{data.sittingGapDays ? ` · every ${data.sittingGapDays} days` : ''}</p>
              </div>
              <div className="p-3 rounded-lg bg-surface-page border border-border">
                <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">Validity</p>
                <p className="mt-1 font-semibold text-ink-primary">{plan.expiryDate ? fmtDate(plan.expiryDate) : 'No expiry'}</p>
                <p className={`text-[11px] ${plan.daysToExpiry !== null && plan.daysToExpiry < 0 ? 'text-status-danger font-semibold' : 'text-ink-secondary'}`}>
                  {expiryText(plan)}{data.validityDays ? ` · ${data.validityDays}-day package` : ''}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-surface-page border border-border">
                <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">Next sitting</p>
                <p className={`mt-1 font-semibold ${plan.overdueDays > 0 ? 'text-status-warning' : 'text-ink-primary'}`}>
                  {plan.nextSittingDate ? fmtDate(plan.nextSittingDate, true) : '—'}
                </p>
                <p className="text-[11px] text-ink-secondary">
                  {plan.overdueDays > 0 ? `${plan.overdueDays} day(s) overdue` : plan.nextIsDoctorPlanned ? 'Planned by doctor' : plan.nextSittingDate ? 'Regular gap' : ''}
                </p>
              </div>
            </div>

            {canRecord && isOpenPackage && plan.state !== 'EXPIRED' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-brand/30 bg-brand-soft/50">
                <p className="text-xs text-brand-deep">
                  <span className="font-semibold">Patient here for a sitting today?</span> Record it once the nurse has done the treatment — it counts against today's visit.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act('/record-sitting', 'POST', {}, 'Sitting recorded')}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-brand hover:bg-brand-deep rounded-md cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Record today's sitting
                </button>
              </div>
            )}

            <p className="text-[11px] text-ink-secondary">
              Bought {fmtDate(data.purchaseDate)} ·{' '}
              {data.skipSundays === false ? 'Sundays count as working days' : 'Sittings never fall on a Sunday'} ·{' '}
              {data.skipHolidays === false ? 'clinic holidays are ignored' : 'clinic holidays are skipped'}
            </p>

            {/* Schedule */}
            <div>
              <h3 className="text-xs font-bold text-ink-primary mb-2 flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-brand" /> Sitting schedule
              </h3>
              <ol className="border border-border rounded-lg divide-y divide-border/60">
                {plan.schedule.map((s) => (
                  <li key={s.number} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                    <span className="flex items-center gap-2">
                      {s.status === 'DONE'
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-status-success" />
                        : <Circle className="w-3.5 h-3.5 text-ink-secondary/60" />}
                      <span className="font-semibold text-ink-primary">Sitting {s.number}</span>
                    </span>
                    <span className="flex items-center gap-2 text-right">
                      {s.shifted && <span className="text-[10px] text-ink-secondary">moved off Sunday/holiday</span>}
                      {s.afterExpiry && <span className="text-[10px] font-semibold text-status-danger">after expiry</span>}
                      <span className={s.status === 'DONE' ? 'text-ink-secondary' : 'text-ink-primary font-medium'}>
                        {s.date ? fmtDate(s.date, true) : s.status === 'DONE' ? 'Done (before records)' : plan.state === 'LAPSED' ? 'Forfeited' : 'Not planned'}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${s.status === 'DONE' ? 'bg-status-success/10 text-status-success border-status-success/20' : 'bg-surface-page text-ink-secondary border-border'}`}>
                        {s.status === 'DONE' ? 'Done' : 'Planned'}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Doctor / admin controls */}
            {canManage && isOpenPackage && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-border space-y-2.5">
                  <h4 className="text-xs font-bold text-ink-primary">Plan the next sitting</h4>
                  <input type="date" value={nextDate} min={today} onChange={(e) => setNextDate(e.target.value)} className={inputClass} />
                  <div className="flex flex-wrap gap-1.5">
                    {[7, 15, 20, 30].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setNextDate(addDaysStr(today, d))}
                        className="px-2 py-1 text-[11px] rounded border border-border bg-surface-page hover:bg-border/40 cursor-pointer"
                      >
                        +{d} days
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between gap-2 pt-1">
                    {plan.nextIsDoctorPlanned ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act('/plan', 'PATCH', { plannedNextSitting: null }, 'Back to the regular gap')}
                        className="text-[11px] text-ink-secondary hover:text-ink-primary cursor-pointer disabled:opacity-50"
                      >
                        Reset to regular gap
                      </button>
                    ) : <span />}
                    <button
                      type="button"
                      disabled={busy || !nextDate || nextDate === plan.nextSittingDate}
                      onClick={() => act('/plan', 'PATCH', { plannedNextSitting: nextDate }, `Next sitting planned for ${fmtDate(nextDate)}`)}
                      className="px-3 py-1.5 text-[11px] font-semibold text-white bg-brand hover:bg-brand-deep rounded-md cursor-pointer disabled:opacity-50"
                    >
                      Save date
                    </button>
                  </div>
                  <p className="text-[10px] text-ink-secondary">
                    Later sittings follow every {data.sittingGapDays || '—'} days from this date. Reception and nurses get it in their follow-ups.
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-border space-y-2.5">
                  <h4 className="text-xs font-bold text-ink-primary">Package validity</h4>
                  <input type="date" value={expiry} min={data.purchaseDate} onChange={(e) => setExpiry(e.target.value)} className={inputClass} />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={busy || !expiry || expiry === data.expiryDate}
                      onClick={() => act('/plan', 'PATCH', { expiryDate: expiry }, `Expiry set to ${fmtDate(expiry)}`)}
                      className="px-3 py-1.5 text-[11px] font-semibold text-ink-primary bg-surface-page border border-border hover:bg-border/40 rounded-md cursor-pointer disabled:opacity-50"
                    >
                      Correct expiry
                    </button>
                  </div>
                  <p className="text-[10px] text-ink-secondary">
                    Use this only to correct the date. If the doctor/clinic caused a delay, use "Delay caused by doctor" so it shows as a notice.
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-status-danger/30 bg-status-danger/5 space-y-2.5">
                  <h4 className="text-xs font-bold text-status-danger">Delay caused by doctor / clinic</h4>
                  <p className="text-[11px] text-ink-secondary">Extends the package and pushes the plan. No charge to the patient. Shown as a red notice.</p>
                  <div className="flex gap-2">
                    <input type="number" min="1" max="365" value={delayDays} onChange={(e) => setDelayDays(e.target.value)} className={`${inputClass} w-24`} title="Days" />
                    <input type="text" value={delayNote} onChange={(e) => setDelayNote(e.target.value)} placeholder="Reason, e.g. doctor on leave" className={inputClass} />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={busy || !Number(delayDays) || !delayNote.trim()}
                      onClick={async () => {
                        if (await act('/doctor-delay', 'POST', { days: Math.floor(Number(delayDays)), note: delayNote.trim() }, `Extended by ${delayDays} days — no charge`)) setDelayNote('');
                      }}
                      className="px-3 py-1.5 text-[11px] font-semibold text-white bg-status-danger hover:opacity-90 rounded-md cursor-pointer disabled:opacity-50"
                    >
                      Extend +{Number(delayDays) || 0} days
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-border space-y-2.5">
                  <h4 className="text-xs font-bold text-ink-primary">Missed by patient</h4>
                  <p className="text-[11px] text-ink-secondary">
                    The package lapses: the {data.sittingsRemaining} remaining sitting(s) are forfeited and the patient buys again. Reception is told to offer it.
                  </p>
                  <input type="text" value={lapseNote} onChange={(e) => setLapseNote(e.target.value)} placeholder="Note (optional), e.g. didn't come for 2 months" className={inputClass} />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirmLapse(true)}
                      className="px-3 py-1.5 text-[11px] font-semibold text-status-danger bg-surface-card border border-status-danger/40 hover:bg-status-danger/10 rounded-md cursor-pointer disabled:opacity-50"
                    >
                      Lapse package
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* History */}
            {adjustments.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-ink-primary mb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-brand" /> History
                </h3>
                <ul className="space-y-1.5">
                  {adjustments.map((a) => (
                    <li
                      key={a.id}
                      className={`text-[11px] px-3 py-2 rounded-md border ${a.kind === 'DOCTOR_DELAY' || a.kind === 'PATIENT_LAPSE' ? 'border-status-danger/30 bg-status-danger/5' : 'border-border bg-surface-page'}`}
                    >
                      <span className={`font-semibold ${a.kind === 'DOCTOR_DELAY' || a.kind === 'PATIENT_LAPSE' ? 'text-status-danger' : 'text-ink-primary'}`}>
                        {ADJ_LABEL[a.kind] || a.kind}{a.kind === 'DOCTOR_DELAY' ? ` (+${a.days} days)` : ''}
                      </span>
                      <span className="text-ink-secondary"> · {a.byName} · {new Date(a.createdAt).toLocaleDateString()}</span>
                      {a.note && <span className="block text-ink-secondary mt-0.5">{a.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmLapse}
        title="Lapse this package?"
        message={`Mark it as missed by the patient. The ${data?.sittingsRemaining ?? ''} remaining sitting(s) will be forfeited and the patient will have to buy the package again.`}
        confirmLabel="Lapse package"
        variant="danger"
        loading={busy}
        onConfirm={async () => {
          if (await act('/lapse', 'POST', { note: lapseNote.trim() || undefined }, 'Package lapsed — reception will offer it again')) setLapseNote('');
          setConfirmLapse(false);
        }}
        onCancel={() => setConfirmLapse(false)}
      />
    </div>
  );
};
