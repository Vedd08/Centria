import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { HospitalReport } from './HospitalReport';
import { Building2, Users, TrendingUp, AlertTriangle, ArrowRight, Wallet, RefreshCw } from 'lucide-react';
import { money } from '../../utils/money';

export interface Hospital {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  owners: { id: string; name: string; email: string }[];
  staffCount: number;
  patients: number;
  visits: number;
  revenue: number;
  lastActivity: string | null;
  subscription: {
    planName: string;
    monthlyFee: number;
    status: string;
    effectiveStatus: string;
    nextDueDate?: string | null;
  } | null;
}

interface PlatformRevenue {
  hospitals: number;
  activeSubscriptions: number;
  mrr: number;
  overdue: { clinicId: string; name: string; monthlyFee: number; dueSince: string | null }[];
  collectedAllTime: number;
  collectedThisMonth: number;
}


const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-brand-soft text-brand-deep border-brand/25',
  TRIAL: 'bg-triage-active/10 text-triage-active border-triage-active/25',
  OVERDUE: 'bg-triage-urgent/10 text-triage-urgent border-triage-urgent/25',
  SUSPENDED: 'bg-surface-sunken text-ink-secondary border-border',
  CANCELLED: 'bg-surface-sunken text-ink-secondary border-border',
  NONE: 'bg-triage-wait/10 text-triage-wait border-triage-wait/25',
};

const Stat: React.FC<{ label: string; value: string; sub?: string; icon: React.ElementType }> = ({
  label,
  value,
  sub,
  icon: Icon,
}) => (
  <div className="bg-surface-card p-4 rounded-[10px] border border-border shadow-xs">
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-brand-soft border border-brand/20 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-brand-deep" />
      </div>
      <div className="min-w-0">
        <p className="eyebrow text-ink-secondary">{label}</p>
        <p className="font-display text-lg font-semibold text-ink-primary leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-ink-secondary mt-0.5">{sub}</p>}
      </div>
    </div>
  </div>
);

/**
 * The vendor's console: every hospital running on the software, who owns it,
 * how much they use it, and whether they are paid up.
 */
export const PlatformConsole: React.FC = () => {
  const { apiFetch, enterClinic } = useAuth();
  const { addToast } = useToast();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [revenue, setRevenue] = useState<PlatformRevenue | null>(null);
  const [loading, setLoading] = useState(true);
  const [openHospital, setOpenHospital] = useState<Hospital | null>(null);

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const [hRes, rRes] = await Promise.all([
        apiFetch('/api/platform/hospitals', { signal }),
        apiFetch('/api/platform/revenue', { signal }),
      ]);
      if (!hRes.ok) throw new Error('Could not load hospitals');
      const h = await hRes.json();
      const r = rRes.ok ? await rRes.json() : null;
      if (signal?.aborted) return;
      setHospitals(Array.isArray(h) ? h : []);
      setRevenue(r);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      addToast('error', err.message || 'Could not load hospitals');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (openHospital) {
    return (
      <HospitalReport
        hospitalId={openHospital.id}
        hospitalName={openHospital.name}
        onBack={() => {
          setOpenHospital(null);
          load();
        }}
        onEnter={() => enterClinic({ id: openHospital.id, name: openHospital.name })}
      />
    );
  }

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Platform</h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Hospitals running on this software, their owners, and their subscriptions.
          </p>
        </div>
        <button
          onClick={() => load()}
          className="p-2 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border cursor-pointer shrink-0"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <>
          {revenue && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Stat label="Hospitals" value={String(revenue.hospitals)} sub={`${revenue.activeSubscriptions} subscribed`} icon={Building2} />
              <Stat label="Monthly recurring" value={money(revenue.mrr)} sub="Across active plans" icon={TrendingUp} />
              <Stat label="Collected this month" value={money(revenue.collectedThisMonth)} sub={`${money(revenue.collectedAllTime)} all time`} icon={Wallet} />
              <Stat
                label="Overdue"
                value={String(revenue.overdue.length)}
                sub={revenue.overdue.length ? revenue.overdue.map((o) => o.name).join(', ') : 'Everyone is paid up'}
                icon={AlertTriangle}
              />
            </div>
          )}

          {revenue && revenue.overdue.length > 0 && (
            <div className="bg-triage-urgent/5 border border-triage-urgent/25 rounded-[10px] p-4">
              <h3 className="text-sm font-semibold text-triage-urgent flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" /> Payment overdue
              </h3>
              <div className="space-y-1">
                {revenue.overdue.map((o) => (
                  <p key={o.clinicId} className="text-xs text-ink-primary">
                    <span className="font-medium">{o.name}</span>
                    <span className="text-ink-secondary"> — {money(o.monthlyFee)}/mo, due since </span>
                    <span className="font-mono">{o.dueSince}</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {hospitals.length === 0 ? (
            <div className="bg-surface-card rounded-[10px] border border-border p-12 text-center space-y-2">
              <p className="text-sm font-semibold">No hospitals yet</p>
              <p className="text-xs text-ink-secondary">Hospitals appear here once they are set up on the platform.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {hospitals.map((h) => {
                const status = h.subscription?.effectiveStatus ?? 'NONE';
                return (
                  <button
                    key={h.id}
                    onClick={() => setOpenHospital(h)}
                    className="text-left bg-surface-card rounded-[10px] border border-border shadow-xs hover:shadow-lift hover:border-brand/40 transition-all cursor-pointer overflow-hidden group"
                  >
                    {/* Status spine, like the coloured tab on a patient file. */}
                    <div
                      className={`h-1 w-full ${
                        status === 'OVERDUE'
                          ? 'bg-triage-urgent'
                          : status === 'ACTIVE'
                            ? 'bg-brand'
                            : status === 'TRIAL'
                              ? 'bg-triage-active'
                              : 'bg-border-strong'
                      }`}
                    />
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-display text-base font-semibold tracking-tight truncate">{h.name}</h3>
                          <p className="text-[11px] text-ink-secondary truncate">
                            {h.owners.length ? h.owners.map((o) => o.name).join(', ') : 'No owner assigned'}
                          </p>
                        </div>
                        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded border ${STATUS_STYLE[status]}`}>
                          {status === 'NONE' ? 'NO PLAN' : status}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-center">
                        {[
                          ['Patients', h.patients.toLocaleString('en-IN')],
                          ['Visits', h.visits.toLocaleString('en-IN')],
                          ['Staff', String(h.staffCount)],
                          ['Revenue', money(h.revenue)],
                        ].map(([label, value]) => (
                          <div key={label} className="bg-surface-sunken rounded-md py-1.5 px-1 border border-border/60">
                            <p className="eyebrow text-ink-secondary">{label}</p>
                            <p className="text-xs font-semibold font-mono mt-0.5 truncate">{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border">
                        <p className="text-[11px] text-ink-secondary">
                          {h.subscription
                            ? `${h.subscription.planName} · ${money(h.subscription.monthlyFee)}/mo`
                            : 'No subscription set up'}
                          {h.lastActivity && ` · last seen ${h.lastActivity}`}
                        </p>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-deep group-hover:gap-2 transition-all">
                          Open <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
