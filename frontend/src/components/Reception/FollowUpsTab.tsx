import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Phone, PhoneOff, PhoneMissed, CalendarClock, Loader2, RefreshCw } from 'lucide-react';
import { AppointmentModal } from '../Appointments/AppointmentModal';

interface Patient { id: string; name: string; phone: string; uhid: string; }
interface LastCall { outcome: string; callBackOn: string | null; attempts: number; }
interface FollowUpReason {
  kind: 'DOCTOR_FOLLOW_UP' | 'PACKAGE_SITTING';
  refId: string;
  dueDate: string | null;
  label: string;
  overdueDays: number;
  lastCall: LastCall | null;
}
interface FollowUpItem {
  patient: Patient;
  reasons: FollowUpReason[];
  dueDate: string | null;
  overdueDays: number;
  doctorName?: string;
}
interface Buckets {
  overdue: FollowUpItem[];
  today: FollowUpItem[];
  next7Days: FollowUpItem[];
  unknownDate: FollowUpItem[];
}

const OUTCOME_LABELS: Record<string, string> = {
  NO_ANSWER: 'No answer',
  CALL_BACK: 'Call back',
  DECLINED: 'Declined',
  BOOKED: 'Booked',
};

export const FollowUpsTab: React.FC = () => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();

  const [buckets, setBuckets] = useState<Buckets | null>(null);
  const [loading, setLoading] = useState(true);
  // callbackDate modal per item
  const [callbackFor, setCallbackFor] = useState<{ patient: Patient, reason: FollowUpReason } | null>(null);
  const [callbackDate, setCallbackDate] = useState('');
  const [declineFor, setDeclineFor] = useState<{ patient: Patient, reason: FollowUpReason } | null>(null);
  const [declineNote, setDeclineNote] = useState('');
  const [bookingFor, setBookingFor] = useState<{ patient: Patient, reason: FollowUpReason } | null>(null);
  const [acting, setActing] = useState<string | null>(null); // refId of item being acted on

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/follow-ups');
      if (res.ok) setBuckets(await res.json());
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { load(); }, [load]);

  const logCall = async (patient: Patient, reason: FollowUpReason, outcome: string, extra?: { note?: string; callBackOn?: string }) => {
    setActing(reason.refId);
    try {
      const res = await apiFetch('/api/follow-ups/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.id,
          kind: reason.kind,
          refId: reason.refId,
          dueDate: reason.dueDate ?? 'unknown',
          outcome,
          ...extra,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Failed to log call');
      }
      addToast('success', `Logged: ${OUTCOME_LABELS[outcome]}`);
      await load();
    } catch (e: any) {
      addToast('error', e.message);
    } finally {
      setActing(null);
    }
  };

  const handleBook = (patient: Patient, reason: FollowUpReason) => setBookingFor({ patient, reason });

  const handleBookSaved = async () => {
    if (bookingFor) {
      await logCall(bookingFor.patient, bookingFor.reason, 'BOOKED');
    }
    setBookingFor(null);
  };

  const handleCallBack = async () => {
    if (!callbackFor || !callbackDate) return;
    await logCall(callbackFor.patient, callbackFor.reason, 'CALL_BACK', { callBackOn: callbackDate });
    setCallbackFor(null);
    setCallbackDate('');
  };

  const handleDecline = async () => {
    if (!declineFor) return;
    await logCall(declineFor.patient, declineFor.reason, 'DECLINED', { note: declineNote || undefined });
    setDeclineFor(null);
    setDeclineNote('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-ink-secondary text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading follow-ups…
      </div>
    );
  }

  if (!buckets) return null;

  const total = buckets.overdue.length + buckets.today.length + buckets.next7Days.length + buckets.unknownDate.length;

  const RowActions = ({ patient, reason }: { patient: Patient, reason: FollowUpReason }) => (
    <div className="flex items-center gap-1 flex-wrap mt-2">
      <button
        onClick={() => handleBook(patient, reason)}
        disabled={!!acting}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-brand hover:bg-brand-deep rounded-md cursor-pointer disabled:opacity-50"
      >
        <CalendarClock className="w-3 h-3" /> Book
      </button>
      <button
        onClick={() => logCall(patient, reason, 'NO_ANSWER')}
        disabled={!!acting}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-ink-secondary bg-surface-page hover:bg-border rounded-md cursor-pointer disabled:opacity-50 border border-border"
      >
        <PhoneMissed className="w-3 h-3" />
        No answer {reason.lastCall?.outcome === 'NO_ANSWER' ? `(${reason.lastCall.attempts} attempt${reason.lastCall.attempts > 1 ? 's' : ''})` : ''}
      </button>
      <button
        onClick={() => { setCallbackFor({ patient, reason }); setCallbackDate(''); }}
        disabled={!!acting}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-ink-secondary bg-surface-page hover:bg-border rounded-md cursor-pointer disabled:opacity-50 border border-border"
      >
        <Phone className="w-3 h-3" /> Call back
      </button>
      <button
        onClick={() => { setDeclineFor({ patient, reason }); setDeclineNote(''); }}
        disabled={!!acting}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-status-danger/70 hover:text-status-danger bg-surface-page rounded-md cursor-pointer disabled:opacity-50 border border-border"
      >
        <PhoneOff className="w-3 h-3" /> Declined
      </button>
    </div>
  );

  const FollowUpRow = ({ item }: { item: FollowUpItem }) => (
    <div className={`p-3.5 rounded-lg border ${item.overdueDays > 0 ? 'border-status-danger/30 bg-status-danger/5' : 'border-border bg-surface-card'}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-ink-primary">{item.patient.name}</span>
            <span className="font-mono text-[11px] text-brand bg-brand/10 px-1.5 py-0.5 rounded">{item.patient.uhid}</span>
            <span className="text-[11px] text-ink-secondary">{item.patient.phone}</span>
          </div>
          <div className="mt-2 space-y-4">
            {item.reasons.map((r, i) => (
              <div key={i} className="space-y-1 pb-3 border-b border-border/50 last:border-0 last:pb-0">
                <p className="text-xs text-ink-secondary font-medium">{r.label}</p>
                {r.lastCall && (
                  <p className="text-[11px] text-ink-tertiary">
                    Last: {OUTCOME_LABELS[r.lastCall.outcome] ?? r.lastCall.outcome}
                    {r.lastCall.attempts > 1 && ` (${r.lastCall.attempts}×)`}
                    {r.lastCall.callBackOn && ` — call back ${r.lastCall.callBackOn}`}
                  </p>
                )}
                <div className="pt-1">
                  {acting === r.refId ? (
                    <div className="flex items-center gap-1 text-[11px] text-ink-secondary">
                      <Loader2 className="w-3 h-3 animate-spin" /> Saving…
                    </div>
                  ) : (
                    <RowActions patient={item.patient} reason={r} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="shrink-0 text-right">
          {item.dueDate ? (
            <>
              <p className="text-xs font-medium text-ink-secondary">{item.dueDate}</p>
              {item.overdueDays > 0 && (
                <p className="text-[11px] font-bold text-status-danger">{item.overdueDays}d overdue</p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-ink-tertiary">Date unknown</p>
          )}
        </div>
      </div>
    </div>
  );

  const Section = ({ title, items, emptyMsg }: { title: string; items: FollowUpItem[]; emptyMsg: string }) => (
    <div className="space-y-2">
      <h4 className="text-xs font-bold text-ink-secondary uppercase tracking-wider flex items-center gap-2">
        {title}
        {items.length > 0 && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-brand/10 text-brand font-bold">{items.length}</span>
        )}
      </h4>
      {items.length === 0 ? (
        <p className="text-xs text-ink-tertiary py-2">{emptyMsg}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => <FollowUpRow key={item.patient.id} item={item} />)}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-ink-primary">Follow-ups Worklist</h3>
          <p className="text-xs text-ink-secondary mt-0.5">
            {total === 0 ? 'No follow-ups due.' : `${total} patient${total !== 1 ? 's' : ''} to follow up on`}
          </p>
        </div>
        <button
          onClick={load}
          className="p-1.5 rounded-md text-ink-secondary hover:bg-surface-page cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <Section title="Overdue" items={buckets.overdue} emptyMsg="No overdue follow-ups." />
      <Section title="Today" items={buckets.today} emptyMsg="Nobody is due for a follow-up today." />
      <Section title="Next 7 days" items={buckets.next7Days} emptyMsg="Nothing scheduled for the next 7 days." />
      <Section title="Date unknown — call to schedule" items={buckets.unknownDate} emptyMsg="No items without a date." />

      {/* Call Back Date Picker Modal */}
      {callbackFor && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface-card rounded-[10px] border border-border shadow-xl p-5 max-w-sm w-full space-y-4">
            <h3 className="text-sm font-bold text-ink-primary">Schedule Call Back</h3>
            <p className="text-xs text-ink-secondary">For <strong>{callbackFor.patient.name}</strong></p>
            <input
              type="date"
              value={callbackDate}
              onChange={e => setCallbackDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setCallbackFor(null)} className="px-4 py-1.5 text-xs text-ink-secondary hover:text-ink-primary rounded-md cursor-pointer">Cancel</button>
              <button
                onClick={handleCallBack}
                disabled={!callbackDate}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-brand hover:bg-brand-deep rounded-md cursor-pointer disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Note Modal */}
      {declineFor && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface-card rounded-[10px] border border-border shadow-xl p-5 max-w-sm w-full space-y-4">
            <h3 className="text-sm font-bold text-ink-primary">Mark as Declined</h3>
            <p className="text-xs text-ink-secondary">Patient: <strong>{declineFor.patient.name}</strong></p>
            <textarea
              value={declineNote}
              onChange={e => setDeclineNote(e.target.value)}
              placeholder="Reason (optional)"
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeclineFor(null)} className="px-4 py-1.5 text-xs text-ink-secondary hover:text-ink-primary rounded-md cursor-pointer">Cancel</button>
              <button
                onClick={handleDecline}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-status-danger hover:bg-status-danger/80 rounded-md cursor-pointer"
              >
                Confirm Declined
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Book Appointment Modal */}
      {bookingFor && (
        <AppointmentModal
          isOpen={true}
          onClose={() => setBookingFor(null)}
          onSaved={handleBookSaved}
          appointment={null}
          initialSlot={null}
          prefill={{
            patientId: bookingFor.patient.id,
            reason: bookingFor.reason.label,
          }}
        />
      )}
    </div>
  );
};
