import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { PatientHistoryPanel, HistoryPatient } from '../PatientHistory/PatientHistoryPanel';
import { money } from '../../utils/money';
import {
  PhoneCall,
  Users,
  CalendarClock,
  PackageOpen,
  UserPlus,
  Wallet,
  Search,
  RefreshCw,
  MoonStar,
  ArrowRight,
} from 'lucide-react';

interface PatientRef {
  id: string;
  name: string;
  phone: string;
  uhid?: string;
}

interface Desk {
  rm: { id: string; name: string; role: string };
  stats: {
    clients: number;
    visitsThisMonth: number;
    visitsAllTime: number;
    revenueThisMonth: number;
    revenueAllTime: number;
    commissionThisMonth: number;
    commissionAllTime: number;
    followUpsDue: number;
    packagesOwed: number;
    lapsedClients: number;
    unclaimedTotal: number;
  };
  followUpsDue: {
    id: string;
    date: string;
    nextAppointmentDate: string;
    treatmentName: string;
    status: string;
    overdueDays: number;
    patient: PatientRef;
  }[];
  packagesOwed: {
    id: string;
    packageName: string;
    purchaseDate: string;
    totalSittings: number;
    sittingsUsed: number;
    sittingsRemaining: number;
    amountPaid: number;
    patient: PatientRef;
  }[];
  lapsedClients: (PatientRef & { lastVisit: string | null })[];
  unclaimed: (PatientRef & { createdAt: string })[];
}

interface Client extends PatientRef {
  visits: number;
  totalValue: number;
  lastVisit: string;
  lastTreatment: string;
}

const card = 'bg-surface-card rounded-[10px] border border-border shadow-xs';

/**
 * The relationship manager's working screen.
 *
 * Ordered by what needs a phone call rather than by what happened today: the
 * client who was due back and has not come, the sittings someone has paid for
 * and not used, the client who has gone quiet. The clinical queue belongs to
 * the front desk — this is the book of business.
 */
export const RMDesk: React.FC = () => {
  const { apiFetch, user, hasRole } = useAuth();
  const { addToast } = useToast();
  const [desk, setDesk] = useState<Desk | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'callList' | 'clients' | 'unclaimed'>('callList');
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selected, setSelected] = useState<HistoryPatient | null>(null);
  const [busy, setBusy] = useState('');

  const isAdmin = hasRole('MASTER', 'SUPER_ADMIN') && user?.role !== 'RM';
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
  const [viewRmId, setViewRmId] = useState('');

  const rmParam = viewRmId ? `?rmId=${viewRmId}` : '';

  const loadDesk = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/rm/desk${rmParam}`, { signal });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Could not load the desk');
        if (!signal?.aborted) setDesk(data);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        addToast('error', err.message || 'Could not load the desk');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [apiFetch, addToast, rmParam],
  );

  useEffect(() => {
    const c = new AbortController();
    loadDesk(c.signal);
    return () => c.abort();
  }, [loadDesk]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const res = await apiFetch('/api/rm/managers');
        const data = await res.json();
        if (res.ok) setManagers(Array.isArray(data) ? data : []);
      } catch {
        // Non-fatal: the picker stays empty and the admin sees their own desk.
      }
    })();
  }, [isAdmin, apiFetch]);

  useEffect(() => {
    if (tab !== 'clients') return;
    const c = new AbortController();
    const t = setTimeout(async () => {
      try {
        const q = new URLSearchParams();
        if (viewRmId) q.set('rmId', viewRmId);
        if (clientSearch.trim()) q.set('search', clientSearch.trim());
        const res = await apiFetch(`/api/rm/clients?${q}`, { signal: c.signal });
        const data = await res.json();
        if (res.ok && !c.signal.aborted) setClients(Array.isArray(data) ? data : []);
      } catch {
        /* aborted or offline — the list simply doesn't refresh */
      }
    }, clientSearch.trim() ? 300 : 0);
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [tab, clientSearch, viewRmId, apiFetch]);

  const claim = async (patientId: string, name: string) => {
    setBusy(patientId);
    try {
      const res = await apiFetch(`/api/rm/clients/${patientId}/assign${rmParam}`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not assign this client');
      addToast('success', `${name} added to your book — ${data.visitsAttributed} visit(s) attributed`);
      loadDesk();
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setBusy('');
    }
  };

  const openPatient = (p: PatientRef) =>
    setSelected({ id: p.id, name: p.name, phone: p.phone, uhid: p.uhid || '' } as HistoryPatient);

  if (loading && !desk) return <LoadingSkeleton />;
  if (!desk) return null;

  const s = desk.stats;

  const tiles = [
    { label: 'Clients in my book', value: String(s.clients), icon: Users, tone: 'text-brand' },
    { label: 'Due a call', value: String(s.followUpsDue), icon: PhoneCall, tone: 'text-triage-urgent' },
    { label: 'Sittings unused', value: String(s.packagesOwed), icon: PackageOpen, tone: 'text-triage-wait' },
    { label: 'Gone quiet', value: String(s.lapsedClients), icon: MoonStar, tone: 'text-triage-active' },
  ];

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      {/* --- header --- */}
      <div className={`${card} p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4`}>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Relationship Desk</h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            {desk.rm.name} · who to call today, and what they are owed
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && managers.length > 0 && (
            <select
              value={viewRmId}
              onChange={(e) => setViewRmId(e.target.value)}
              className="px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
            >
              <option value="">My desk</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => loadDesk()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-border bg-surface-card hover:bg-surface-page transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* --- what needs attention --- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {tiles.map((t) => (
          <div key={t.label} className={`${card} p-4`}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-medium text-ink-secondary">{t.label}</p>
              <t.icon className={`w-4 h-4 ${t.tone}`} />
            </div>
            <p className="text-2xl font-semibold tracking-tight mt-1.5 font-display">{t.value}</p>
          </div>
        ))}
      </div>

      {/* --- what it earned --- */}
      <div className={`${card} p-4 sm:p-5`}>
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-4 h-4 text-brand" />
          <h3 className="text-sm font-semibold">My contribution</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ['Business this month', money(s.revenueThisMonth), `${s.visitsThisMonth} visit(s)`],
            ['Business all time', money(s.revenueAllTime), `${s.visitsAllTime} visit(s)`],
            ['Commission this month', money(s.commissionThisMonth), 'from qualifying visits'],
            ['Commission all time', money(s.commissionAllTime), 'as recorded in accounts'],
          ].map(([label, value, sub]) => (
            <div key={label}>
              <p className="text-[11px] text-ink-secondary">{label}</p>
              <p className="text-lg font-semibold font-mono tracking-tight mt-0.5">{value}</p>
              <p className="text-[10px] text-ink-secondary/70 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Commission is a percentage of the treatment's catalogue price, so an
            unpriced treatment list produces a zero share against real business.
            Say so, rather than showing a bare nil next to a healthy figure. */}
        {s.commissionAllTime === 0 && s.revenueAllTime > 0 && (
          <p className="text-[11px] text-triage-wait mt-4 pt-3 border-t border-border">
            Commission reads nil because the treatments behind these visits have no price set.
            Add prices under Treatments and the share is calculated from the next visit onward.
          </p>
        )}
      </div>

      {/* --- tabs --- */}
      <div className={card}>
        <div className="flex border-b border-border overflow-x-auto">
          {([
            ['callList', `Call list (${s.followUpsDue + s.packagesOwed + s.lapsedClients})`],
            ['clients', `My clients (${s.clients})`],
            ['unclaimed', `Unclaimed (${s.unclaimedTotal})`],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                tab === id
                  ? 'border-brand text-brand-deep'
                  : 'border-transparent text-ink-secondary hover:text-ink-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5 space-y-6">
          {tab === 'callList' && (
            <>
              <Section
                icon={CalendarClock}
                title="Follow-up has come due"
                blurb="Booked to return and has not been back yet."
                empty="Nobody is overdue a follow-up."
                rows={desk.followUpsDue}
                render={(f) => (
                  <Row
                    key={f.id}
                    name={f.patient.name}
                    phone={f.patient.phone}
                    onOpen={() => openPatient(f.patient)}
                    meta={`${f.treatmentName} on ${f.date}`}
                    right={
                      <span
                        className={`text-[11px] font-semibold ${
                          f.overdueDays > 7 ? 'text-triage-urgent' : 'text-triage-wait'
                        }`}
                      >
                        {f.overdueDays === 0 ? 'Due today' : `${f.overdueDays}d overdue`}
                      </span>
                    }
                  />
                )}
              />

              <Section
                icon={PackageOpen}
                title="Paid for sittings they have not used"
                blurb="Already paid — the clinic owes them the treatment."
                empty="Every package is fully used."
                rows={desk.packagesOwed}
                render={(p) => (
                  <Row
                    key={p.id}
                    name={p.patient.name}
                    phone={p.patient.phone}
                    onOpen={() => openPatient(p.patient)}
                    meta={`${p.packageName} · bought ${p.purchaseDate} · ${money(p.amountPaid)}`}
                    right={
                      <span className="text-[11px] font-semibold text-triage-wait">
                        {p.sittingsRemaining} of {p.totalSittings} left
                      </span>
                    }
                  />
                )}
              />

              <Section
                icon={MoonStar}
                title="Gone quiet"
                blurb="No visit in the last 60 days."
                empty="No client has gone quiet."
                rows={desk.lapsedClients}
                render={(c) => (
                  <Row
                    key={c.id}
                    name={c.name}
                    phone={c.phone}
                    onOpen={() => openPatient(c)}
                    meta={c.lastVisit ? `Last seen ${c.lastVisit}` : 'No visit recorded'}
                    right={null}
                  />
                )}
              />
            </>
          )}

          {tab === 'clients' && (
            <div className="space-y-3">
              <div className="relative max-w-sm">
                <Search className="w-4 h-4 text-ink-secondary/60 absolute left-3 top-2.5" />
                <input
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Search my clients by name or phone..."
                  className="w-full pl-9 pr-3 py-2 rounded-md border border-border text-xs bg-surface-card focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              {clients.length === 0 ? (
                <Empty text="No clients in your book yet. Claim one from the Unclaimed tab." />
              ) : (
                <div className="divide-y divide-border/60">
                  {clients.map((c) => (
                    <Row
                      key={c.id}
                      name={c.name}
                      phone={c.phone}
                      onOpen={() => openPatient(c)}
                      meta={`${c.visits} visit(s) · last ${c.lastVisit} · ${c.lastTreatment}`}
                      right={<span className="text-[11px] font-mono font-semibold">{money(c.totalValue)}</span>}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'unclaimed' && (
            <div className="space-y-3">
              <p className="text-xs text-ink-secondary">
                Patients no relationship manager has taken responsibility for. Claiming one attributes
                their visit history to you, and any commission that history qualifies for.
              </p>
              {desk.unclaimed.length === 0 ? (
                <Empty text="Every patient has a relationship manager." />
              ) : (
                <div className="divide-y divide-border/60">
                  {desk.unclaimed.map((p) => (
                    <Row
                      key={p.id}
                      name={p.name}
                      phone={p.phone}
                      onOpen={() => openPatient(p)}
                      meta={p.uhid || ''}
                      right={
                        <button
                          disabled={busy === p.id}
                          onClick={() => claim(p.id, p.name)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-brand text-white hover:bg-brand-deep transition-colors cursor-pointer disabled:opacity-60"
                        >
                          <UserPlus className="w-3 h-3" />
                          {busy === p.id ? 'Claiming…' : 'Claim'}
                        </button>
                      }
                    />
                  ))}
                </div>
              )}
              {desk.unclaimed.length < s.unclaimedTotal && (
                <p className="text-[11px] text-ink-secondary/70">
                  Showing the {desk.unclaimed.length} most recent of {s.unclaimedTotal}.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface-card z-10 flex items-center justify-between p-6 pb-3 border-b border-border">
              <div>
                <h3 className="text-base font-semibold text-ink-primary">{selected.name}</h3>
                <p className="text-xs font-mono text-ink-secondary mt-0.5">{selected.phone}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1 rounded text-ink-secondary hover:text-ink-primary text-sm font-semibold cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <PatientHistoryPanel patient={selected} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** One block of the call list. */
function Section<T>({
  icon: Icon,
  title,
  blurb,
  empty,
  rows,
  render,
}: {
  icon: React.ElementType;
  title: string;
  blurb: string;
  empty: string;
  rows: T[];
  render: (row: T) => React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-start gap-2 mb-2">
        <Icon className="w-4 h-4 text-ink-secondary mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold leading-tight">
            {title} <span className="text-ink-secondary font-normal">({rows.length})</span>
          </h3>
          <p className="text-[11px] text-ink-secondary/80">{blurb}</p>
        </div>
      </div>
      {rows.length === 0 ? <Empty text={empty} /> : <div className="divide-y divide-border/60">{rows.map(render)}</div>}
    </div>
  );
}

function Row({
  name,
  phone,
  meta,
  right,
  onOpen,
}: {
  name: string;
  phone: string;
  meta: string;
  right: React.ReactNode;
  onOpen: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <button
          onClick={onOpen}
          className="text-sm font-medium text-ink-primary hover:text-brand-deep transition-colors cursor-pointer inline-flex items-center gap-1 group"
        >
          <span className="truncate">{name}</span>
          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
        <p className="text-[11px] text-ink-secondary truncate">
          {phone}
          {meta ? ` · ${meta}` : ''}
        </p>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <p className="text-xs text-ink-secondary/70 py-3">{text}</p>
);
