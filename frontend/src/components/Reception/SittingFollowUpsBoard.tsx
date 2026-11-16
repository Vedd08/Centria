import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CalendarCheck, CalendarClock, ChevronDown, ChevronUp, Clock, History, Loader2, MessageCircle,
  Phone, PhoneMissed, PhoneOff, RefreshCw, Search, UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { AppointmentModal } from '../Appointments/AppointmentModal';
import { fmtDate, fmtDateTime } from '../../utils/date';

type Status = 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'LATER' | 'NO_DATE' | 'EXPIRED' | 'LAPSED';
type FollowUp = 'IN_CLINIC' | 'BOOKED' | 'DECLINED' | 'CALL_BACK' | 'TO_CALL';

interface Call { id: string; outcome: string; note: string | null; callBackOn: string | null; dueDate: string; at: string; by: string | null }
interface Treatment {
  id: string; name: string; sittingsUsed: number; totalSittings: number; gapDays: number | null;
  nextDate: string | null; overdueDays: number;
  schedule: { number: number; date: string | null; status: 'DONE' | 'PLANNED'; afterExpiry?: boolean }[];
}
interface Row {
  purchaseId: string;
  patient: { id: string; name: string; phone: string; uhid: string };
  packageName: string; purchaseDate: string; expiryDate: string | null; daysToExpiry: number | null;
  extendedDays: number; expiringSoon: boolean;
  status: Status; followUp: FollowUp; dueDate: string | null; overdueDays: number; daysUntilDue: number | null;
  nextTreatment: string | null; nextIsDoctorPlanned: boolean;
  sittingsUsed: number; totalSittings: number; lastSittingDate: string | null; lapsedAt: string | null;
  treatments: Treatment[];
  appointment: { startTime: string; doctorName: string | null; reason: string | null } | null;
  inClinicStatus: string | null;
  attempts: number;
  lastCall: { outcome: string; callBackOn: string | null; at: string; by: string | null; note: string | null } | null;
  calls: Call[];
}
interface Board {
  today: string;
  counts: Record<'needsCall' | 'overdue' | 'dueToday' | 'upcoming' | 'expiring' | 'expiredOrLapsed' | 'booked' | 'callBack' | 'declined' | 'all', number>;
  rows: Row[];
}

type Filter = 'needsCall' | 'overdue' | 'dueToday' | 'upcoming' | 'expiring' | 'expiredOrLapsed' | 'booked' | 'callBack' | 'declined' | 'all';

const NEEDS_CALL: Status[] = ['OVERDUE', 'DUE_TODAY', 'EXPIRED', 'LAPSED', 'NO_DATE'];
const MATCH: Record<Filter, (r: Row) => boolean> = {
  needsCall: (r) => r.followUp === 'TO_CALL' && NEEDS_CALL.includes(r.status),
  overdue: (r) => r.status === 'OVERDUE',
  dueToday: (r) => r.status === 'DUE_TODAY',
  upcoming: (r) => r.status === 'UPCOMING',
  expiring: (r) => r.expiringSoon,
  expiredOrLapsed: (r) => r.status === 'EXPIRED' || r.status === 'LAPSED',
  booked: (r) => r.followUp === 'BOOKED' || r.followUp === 'IN_CLINIC',
  callBack: (r) => r.followUp === 'CALL_BACK',
  declined: (r) => r.followUp === 'DECLINED',
  all: () => true,
};

const FILTERS: { key: Filter; label: string; hint: string }[] = [
  { key: 'needsCall', label: 'Needs a call', hint: 'Missed, due today, expired or lapsed — and nobody has booked or scheduled a call back yet.' },
  { key: 'overdue', label: 'Missed / overdue', hint: 'The sitting date has passed and the patient did not come.' },
  { key: 'dueToday', label: 'Due today', hint: 'The sitting is due today.' },
  { key: 'upcoming', label: 'Next 7 days', hint: 'Call to remind and book a slot.' },
  { key: 'expiring', label: 'Expiring soon', hint: 'Package validity ends within 7 days.' },
  { key: 'expiredOrLapsed', label: 'Expired / lapsed', hint: 'Ask the doctor about an extension, or offer the package again.' },
  { key: 'booked', label: 'Booked', hint: 'Has an appointment, or is in the clinic today.' },
  { key: 'callBack', label: 'Call back later', hint: 'The patient asked to be called on a later date.' },
  { key: 'declined', label: 'Not interested', hint: 'The patient declined this sitting.' },
  { key: 'all', label: 'All packages', hint: 'Every package with sittings left — track each patient.' },
];

const OUTCOME: Record<string, string> = { NO_ANSWER: 'No answer', CALL_BACK: 'Call back', DECLINED: 'Declined', BOOKED: 'Booked' };

const STATUS_BADGE: Record<Status, (r: Row) => { text: string; cls: string }> = {
  OVERDUE: (r) => ({ text: `Missed · ${r.overdueDays} day${r.overdueDays === 1 ? '' : 's'} overdue`, cls: 'bg-status-danger/10 text-status-danger border-status-danger/30' }),
  DUE_TODAY: () => ({ text: 'Due today', cls: 'bg-status-warning/10 text-status-warning border-status-warning/30' }),
  UPCOMING: (r) => ({ text: r.daysUntilDue === 1 ? 'Due tomorrow' : `Due in ${r.daysUntilDue} days`, cls: 'bg-brand/10 text-brand-deep border-brand/30' }),
  LATER: (r) => ({ text: `Due in ${r.daysUntilDue} days`, cls: 'bg-surface-page text-ink-secondary border-border' }),
  NO_DATE: () => ({ text: 'No date — call to schedule', cls: 'bg-surface-page text-ink-secondary border-border' }),
  EXPIRED: (r) => ({ text: `Expired ${fmtDate(r.expiryDate)}`, cls: 'bg-status-danger/10 text-status-danger border-status-danger/30' }),
  LAPSED: (r) => ({ text: `Lapsed ${fmtDate(r.lapsedAt)} — sell again`, cls: 'bg-status-danger/10 text-status-danger border-status-danger/30' }),
};

/** WhatsApp link with a ready reminder; Indian 10-digit numbers get the 91 prefix. */
const whatsappLink = (r: Row) => {
  let digits = (r.patient.phone || '').replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 11) return null;
  const what = r.nextTreatment ? `${r.nextTreatment} sitting` : `${r.packageName} sitting`;
  const msg = r.status === 'OVERDUE'
    ? `Hello ${r.patient.name}, your ${what} was due on ${fmtDate(r.dueDate)}. Please let us know a convenient day so we can book your next sitting.`
    : r.status === 'DUE_TODAY'
      ? `Hello ${r.patient.name}, your ${what} is due today. Please let us know what time suits you.`
      : r.dueDate
        ? `Hello ${r.patient.name}, a reminder that your ${what} is due on ${fmtDate(r.dueDate)}. Please reply to book your slot.`
        : `Hello ${r.patient.name}, please let us know a convenient day for your next ${what}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
};

export const SittingFollowUpsBoard: React.FC<{ onCounts?: (needsCall: number) => void }> = ({ onCounts }) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('needsCall');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [modal, setModal] = useState<{ kind: 'CALL_BACK' | 'DECLINED' | 'NO_ANSWER'; row: Row } | null>(null);
  const [modalDate, setModalDate] = useState('');
  const [modalNote, setModalNote] = useState('');
  const [booking, setBooking] = useState<Row | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/follow-ups/sittings');
      if (res.ok) {
        const data: Board = await res.json();
        setBoard(data);
        onCounts?.(data.counts.needsCall);
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, onCounts]);

  useEffect(() => { load(); }, [load]);

  const logCall = async (row: Row, outcome: string, extra: { note?: string; callBackOn?: string } = {}) => {
    setActing(row.purchaseId);
    try {
      const res = await apiFetch('/api/follow-ups/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: row.patient.id,
          kind: 'PACKAGE_SITTING',
          refId: row.purchaseId,
          dueDate: row.dueDate ?? 'unknown',
          outcome,
          ...(extra.note?.trim() ? { note: extra.note.trim() } : {}),
          ...(extra.callBackOn ? { callBackOn: extra.callBackOn } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(Array.isArray(d.message) ? d.message.join(', ') : d.message || 'Could not save the call');
      }
      addToast('success', `${row.patient.name}: ${OUTCOME[outcome]}`);
      await load();
    } catch (e: any) {
      addToast('error', e.message);
    } finally {
      setActing(null);
    }
  };

  const openModal = (kind: 'CALL_BACK' | 'DECLINED' | 'NO_ANSWER', row: Row) => {
    setModal({ kind, row });
    setModalDate('');
    setModalNote('');
  };

  const saveModal = async () => {
    if (!modal) return;
    if (modal.kind === 'CALL_BACK' && !modalDate) return;
    await logCall(modal.row, modal.kind, { note: modalNote, callBackOn: modal.kind === 'CALL_BACK' ? modalDate : undefined });
    setModal(null);
  };

  const rows = useMemo(() => {
    if (!board) return [];
    const q = search.trim().toLowerCase();
    return board.rows.filter((r) => {
      if (q) {
        const hay = `${r.patient.name} ${r.patient.phone} ${r.patient.uhid} ${r.packageName} ${r.treatments.map((t) => t.name).join(' ')}`.toLowerCase();
        return hay.includes(q);
      }
      return MATCH[filter](r);
    });
  }, [board, filter, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-ink-secondary text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading package sittings…
      </div>
    );
  }
  if (!board) return <p className="text-xs text-ink-secondary py-8 text-center">Could not load package sittings.</p>;

  const c = board.counts;
  const tiles: { key: Filter; label: string; value: number; icon: React.ElementType; tone: string }[] = [
    { key: 'overdue', label: 'Missed sittings', value: c.overdue, icon: AlertTriangle, tone: c.overdue ? 'text-status-danger' : 'text-ink-faint' },
    { key: 'dueToday', label: 'Due today', value: c.dueToday, icon: Clock, tone: c.dueToday ? 'text-status-warning' : 'text-ink-faint' },
    { key: 'upcoming', label: 'Coming up (7 days)', value: c.upcoming, icon: CalendarClock, tone: 'text-brand' },
    { key: 'booked', label: 'Booked', value: c.booked, icon: CalendarCheck, tone: 'text-status-success' },
    { key: 'expiring', label: 'Expiring soon', value: c.expiring, icon: AlertTriangle, tone: c.expiring ? 'text-status-warning' : 'text-ink-faint' },
  ];
  const activeFilter = FILTERS.find((f) => f.key === filter)!;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-ink-primary">Package Sittings</h3>
          <p className="text-xs text-ink-secondary mt-0.5">
            Patients who missed a sitting or have one coming up. Call, book, and every call is kept on the patient's record.
          </p>
        </div>
        <button onClick={() => { setLoading(true); load(); }} className="p-1.5 rounded-md text-ink-secondary hover:bg-surface-page cursor-pointer" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => { setFilter(t.key); setSearch(''); }}
              className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${filter === t.key && !search ? 'border-brand bg-brand-soft' : 'border-border bg-surface-card hover:bg-surface-page'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-ink-secondary">{t.label}</span>
                <Icon className={`w-3.5 h-3.5 ${t.tone}`} />
              </div>
              <p className={`text-xl font-bold mt-1 ${t.value ? 'text-ink-primary' : 'text-ink-faint'}`}>{t.value}</p>
            </button>
          );
        })}
      </div>

      {/* Filters + search */}
      <div className="space-y-2">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setSearch(''); }}
                className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer whitespace-nowrap ${
                  filter === f.key && !search ? 'bg-brand text-white border-brand' : 'bg-surface-card text-ink-secondary border-border hover:text-ink-primary'
                }`}
              >
                {f.label}
                <span className={`px-1 rounded-full text-[10px] font-bold ${filter === f.key && !search ? 'bg-white/20' : f.key === 'needsCall' && c.needsCall ? 'bg-status-danger text-white' : 'bg-surface-page'}`}>
                  {c[f.key]}
                </span>
              </button>
            ))}
          </div>
          <div className="relative lg:ml-auto lg:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find patient, phone, UHID, package"
              className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border text-xs bg-surface-card focus:ring-1 focus:ring-brand outline-none"
            />
          </div>
        </div>
        <p className="text-[11px] text-ink-faint">
          {search ? `Searching all packages for "${search}"` : activeFilter.hint} · {rows.length} patient{rows.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <div className="text-center py-10 text-xs text-ink-secondary border border-dashed border-border rounded-lg">
          {search ? 'No package matches that search.' : filter === 'needsCall' ? 'Nobody needs a call right now.' : 'Nothing here.'}
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const badge = STATUS_BADGE[r.status](r);
            const open = expanded === r.purchaseId;
            const wa = whatsappLink(r);
            const urgent = r.status === 'OVERDUE' || r.status === 'EXPIRED' || r.status === 'LAPSED';
            const pct = r.totalSittings ? Math.round((r.sittingsUsed / r.totalSittings) * 100) : 0;
            return (
              <div key={r.purchaseId} className={`rounded-lg border ${urgent && r.followUp === 'TO_CALL' ? 'border-status-danger/30 bg-status-danger/5' : 'border-border bg-surface-card'}`}>
                <div className="p-3.5 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-ink-primary">{r.patient.name}</span>
                        <span className="font-mono text-[11px] text-brand bg-brand/10 px-1.5 py-0.5 rounded">{r.patient.uhid}</span>
                        {r.patient.phone && (
                          <a href={`tel:${r.patient.phone}`} className="inline-flex items-center gap-1 text-[11px] text-ink-secondary hover:text-brand">
                            <Phone className="w-3 h-3" /> {r.patient.phone}
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-ink-secondary">
                        <span className="font-semibold text-ink-primary">{r.packageName}</span>
                        {' · '}bought {fmtDate(r.purchaseDate)}
                        {r.expiryDate && <> · valid till {fmtDate(r.expiryDate)}{r.expiringSoon && <span className="text-status-warning font-semibold"> ({r.daysToExpiry} day{r.daysToExpiry === 1 ? '' : 's'} left)</span>}</>}
                        {r.extendedDays > 0 && <span className="text-status-danger"> · extended +{r.extendedDays} days by doctor</span>}
                      </p>
                    </div>
                    <div className="flex sm:flex-col items-start sm:items-end gap-1.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold whitespace-nowrap ${badge.cls}`}>{badge.text}</span>
                      <FollowUpBadge r={r} />
                    </div>
                  </div>

                  {/* Progress + treatments */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-surface-page overflow-hidden">
                        <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-ink-secondary whitespace-nowrap">{r.sittingsUsed} of {r.totalSittings} sittings done</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {r.treatments.map((t) => (
                        <span key={t.id} className={`text-[11px] px-2 py-0.5 rounded-md border ${t.overdueDays > 0 && t.nextDate ? 'border-status-danger/30 text-status-danger' : 'border-border text-ink-secondary'}`}>
                          <span className="font-medium">{t.name}</span> {t.sittingsUsed}/{t.totalSittings}
                          {t.sittingsUsed >= t.totalSittings ? ' · done' : t.nextDate ? ` · next ${fmtDate(t.nextDate)}` : ''}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-ink-faint">
                      Last sitting: {r.lastSittingDate ? fmtDate(r.lastSittingDate) : 'none yet'}
                      {r.nextIsDoctorPlanned && ' · next date set by the doctor'}
                      {r.lastCall && <> · Last call: {OUTCOME[r.lastCall.outcome] ?? r.lastCall.outcome}{r.attempts > 1 ? ` (${r.attempts} tries)` : ''} by {r.lastCall.by ?? '—'}, {fmtDateTime(r.lastCall.at)}</>}
                    </p>
                    {r.lastCall?.note && <p className="text-[11px] text-ink-secondary italic">“{r.lastCall.note}”</p>}
                  </div>

                  {/* Actions */}
                  {acting === r.purchaseId ? (
                    <div className="flex items-center gap-1 text-[11px] text-ink-secondary"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</div>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {r.status !== 'LAPSED' && r.followUp !== 'IN_CLINIC' && (
                        <button onClick={() => setBooking(r)} disabled={!!acting} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-brand hover:bg-brand-deep rounded-md cursor-pointer disabled:opacity-50">
                          <CalendarClock className="w-3 h-3" /> {r.followUp === 'BOOKED' ? 'Book another' : 'Book sitting'}
                        </button>
                      )}
                      {wa && (
                        <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-status-success bg-surface-page hover:bg-border rounded-md border border-border">
                          <MessageCircle className="w-3 h-3" /> WhatsApp
                        </a>
                      )}
                      <button onClick={() => openModal('NO_ANSWER', r)} disabled={!!acting} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-ink-secondary bg-surface-page hover:bg-border rounded-md border border-border cursor-pointer disabled:opacity-50">
                        <PhoneMissed className="w-3 h-3" /> No answer
                      </button>
                      <button onClick={() => openModal('CALL_BACK', r)} disabled={!!acting} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-ink-secondary bg-surface-page hover:bg-border rounded-md border border-border cursor-pointer disabled:opacity-50">
                        <Phone className="w-3 h-3" /> Call back later
                      </button>
                      <button onClick={() => openModal('DECLINED', r)} disabled={!!acting} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-status-danger/80 hover:text-status-danger bg-surface-page rounded-md border border-border cursor-pointer disabled:opacity-50">
                        <PhoneOff className="w-3 h-3" /> Not interested
                      </button>
                      <button onClick={() => setExpanded(open ? null : r.purchaseId)} className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink-primary cursor-pointer">
                        <History className="w-3 h-3" /> Track {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  )}
                </div>

                {open && <TrackPanel r={r} />}
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-surface-card rounded-[10px] border border-border shadow-xl p-5 max-w-sm w-full space-y-3">
            <h3 className="text-sm font-bold text-ink-primary">
              {modal.kind === 'CALL_BACK' ? 'Call back later' : modal.kind === 'DECLINED' ? 'Not interested' : 'No answer'}
            </h3>
            <p className="text-xs text-ink-secondary"><strong>{modal.row.patient.name}</strong> · {modal.row.packageName}</p>
            {modal.kind === 'CALL_BACK' && (
              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-ink-secondary">Call again on</span>
                <input
                  type="date"
                  value={modalDate}
                  onChange={(e) => setModalDate(e.target.value)}
                  min={board.today}
                  className="w-full px-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card"
                />
              </label>
            )}
            <textarea
              value={modalNote}
              onChange={(e) => setModalNote(e.target.value)}
              placeholder={modal.kind === 'DECLINED' ? 'Reason (e.g. moved city, not happy with results)' : modal.kind === 'CALL_BACK' ? 'What did the patient say? (optional)' : 'Note (optional)'}
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="px-4 py-1.5 text-xs text-ink-secondary hover:text-ink-primary rounded-md cursor-pointer">Cancel</button>
              <button
                onClick={saveModal}
                disabled={(modal.kind === 'CALL_BACK' && !modalDate) || !!acting}
                className={`px-4 py-1.5 text-xs font-semibold text-white rounded-md cursor-pointer disabled:opacity-50 ${modal.kind === 'DECLINED' ? 'bg-status-danger hover:bg-status-danger/80' : 'bg-brand hover:bg-brand-deep'}`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {booking && (
        <AppointmentModal
          isOpen
          onClose={() => setBooking(null)}
          onSaved={async () => {
            const r = booking;
            setBooking(null);
            await logCall(r, 'BOOKED');
          }}
          appointment={null}
          initialSlot={null}
          prefill={{
            patientId: booking.patient.id,
            reason: `${booking.packageName} — ${booking.nextTreatment ?? 'next'} sitting`,
          }}
        />
      )}
    </div>
  );
};

const FollowUpBadge: React.FC<{ r: Row }> = ({ r }) => {
  if (r.followUp === 'IN_CLINIC') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold bg-status-success/10 text-status-success border-status-success/30"><UserCheck className="w-3 h-3" /> In clinic today</span>;
  }
  if (r.followUp === 'BOOKED' && r.appointment) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold bg-status-success/10 text-status-success border-status-success/30 whitespace-nowrap">
        <CalendarCheck className="w-3 h-3" /> Booked {fmtDateTime(r.appointment.startTime)}{r.appointment.doctorName ? ` · Dr. ${r.appointment.doctorName.replace(/^dr\.?\s*/i, '')}` : ''}
      </span>
    );
  }
  if (r.followUp === 'CALL_BACK' && r.lastCall?.callBackOn) {
    return <span className="px-2 py-0.5 rounded border text-[10px] font-semibold bg-surface-page text-ink-secondary border-border whitespace-nowrap">Call back {fmtDate(r.lastCall.callBackOn)}</span>;
  }
  if (r.followUp === 'DECLINED') {
    return <span className="px-2 py-0.5 rounded border text-[10px] font-semibold bg-surface-page text-ink-secondary border-border">Not interested</span>;
  }
  if (r.attempts > 0) {
    return <span className="px-2 py-0.5 rounded border text-[10px] font-semibold bg-status-warning/10 text-status-warning border-status-warning/30 whitespace-nowrap">No answer ×{r.attempts}</span>;
  }
  return null;
};

/** Per-treatment sitting schedule and the full call history for one package. */
const TrackPanel: React.FC<{ r: Row }> = ({ r }) => (
  <div className="border-t border-border bg-surface-page/60 p-3.5 grid gap-4 md:grid-cols-2">
    <div className="space-y-3">
      <h5 className="text-[11px] font-bold uppercase tracking-wider text-ink-secondary">Sitting schedule</h5>
      {r.treatments.map((t) => (
        <div key={t.id} className="space-y-1">
          <p className="text-xs font-semibold text-ink-primary">
            {t.name} <span className="font-normal text-ink-secondary">· {t.sittingsUsed}/{t.totalSittings}{t.gapDays ? ` · every ${t.gapDays} days` : ''}</span>
          </p>
          <div className="flex flex-wrap gap-1">
            {t.schedule.map((s) => {
              const late = s.status === 'PLANNED' && t.nextDate === s.date && t.overdueDays > 0;
              return (
                <span
                  key={s.number}
                  title={s.afterExpiry ? 'Falls after the package expires' : undefined}
                  className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    s.status === 'DONE' ? 'bg-status-success/10 border-status-success/30 text-status-success'
                    : late ? 'bg-status-danger/10 border-status-danger/30 text-status-danger'
                    : s.afterExpiry ? 'border-status-warning/40 text-status-warning'
                    : 'border-border text-ink-secondary bg-surface-card'
                  }`}
                >
                  #{s.number} {s.status === 'DONE' ? `✓ ${s.date ? fmtDate(s.date) : 'earlier'}` : s.date ? fmtDate(s.date) : 'date open'}{late ? ' missed' : ''}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
    <div className="space-y-2">
      <h5 className="text-[11px] font-bold uppercase tracking-wider text-ink-secondary">Call history</h5>
      {r.calls.length === 0 ? (
        <p className="text-[11px] text-ink-faint">No calls logged yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {r.calls.map((c) => (
            <li key={c.id} className="text-[11px] leading-snug border-l-2 border-border pl-2">
              <span className="font-semibold text-ink-primary">{OUTCOME[c.outcome] ?? c.outcome}</span>
              {c.callBackOn && <span className="text-ink-secondary"> → call {fmtDate(c.callBackOn)}</span>}
              <span className="text-ink-faint"> · {fmtDateTime(c.at)} · {c.by ?? '—'}</span>
              {c.dueDate !== r.dueDate && c.dueDate !== 'unknown' && <span className="text-ink-faint"> (for sitting due {fmtDate(c.dueDate)})</span>}
              {c.note && <p className="text-ink-secondary italic">“{c.note}”</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  </div>
);
