import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { ArrowLeft, LogIn, CreditCard, Plus, X } from 'lucide-react';
import { money } from '../../utils/money';


const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

interface Props {
  hospitalId: string;
  hospitalName: string;
  onBack: () => void;
  onEnter: () => void;
}

/** Read-only report for one hospital, plus the vendor's subscription controls. */
export const HospitalReport: React.FC<Props> = ({ hospitalId, hospitalName, onBack, onEnter }) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPlan, setShowPlan] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [saving, setSaving] = useState(false);

  const [planName, setPlanName] = useState('Standard');
  const [monthlyFee, setMonthlyFee] = useState('');
  const [billingDay, setBillingDay] = useState('1');
  const [planStatus, setPlanStatus] = useState('ACTIVE');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank');
  const [reference, setReference] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/platform/hospitals/${hospitalId}`);
      if (!res.ok) throw new Error('Could not load this hospital');
      const d = await res.json();
      setData(d);
      if (d.subscription) {
        setPlanName(d.subscription.planName);
        setMonthlyFee(String(d.subscription.monthlyFee));
        setBillingDay(String(d.subscription.billingDay));
        setPlanStatus(d.subscription.status);
        setAmount(String(d.subscription.monthlyFee));
      }
    } catch (err: any) {
      addToast('error', err.message || 'Could not load this hospital');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitalId]);

  const savePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch(`/api/platform/hospitals/${hospitalId}/subscription`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planName: planName.trim(),
          monthlyFee: Number(monthlyFee || 0),
          billingDay: Number(billingDay || 1),
          status: planStatus,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || 'Could not save the plan');
      addToast('success', 'Subscription saved');
      setShowPlan(false);
      load();
    } catch (err: any) {
      addToast('error', err.message || 'Could not save the plan');
    } finally {
      setSaving(false);
    }
  };

  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch(`/api/platform/hospitals/${hospitalId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          method,
          reference: reference.trim() || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || 'Could not record the payment');
      addToast('success', 'Payment recorded — next due date moved on');
      setShowPayment(false);
      setReference('');
      load();
    } catch (err: any) {
      addToast('error', err.message || 'Could not record the payment');
    } finally {
      setSaving(false);
    }
  };

  const sub = data?.subscription;

  return (
    <div className="space-y-5 font-sans text-ink-primary">
      <div className="bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border cursor-pointer shrink-0"
            title="Back to all hospitals"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">{hospitalName}</h2>
            <p className="text-xs text-ink-secondary mt-0.5">
              {data?.address || 'No address on file'}
              {data?.phone && ` · ${data.phone}`}
            </p>
          </div>
        </div>
        <button
          onClick={onEnter}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer shrink-0"
        >
          <LogIn className="w-3.5 h-3.5" />
          Enter this hospital
        </button>
      </div>

      {loading || !data ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ['Patients', data.usage.patients.toLocaleString('en-IN')],
              ['Visits', (data.usage.visitsOpd + data.usage.visitsIpd).toLocaleString('en-IN'), `OPD ${data.usage.visitsOpd} · IPD ${data.usage.visitsIpd}`],
              ['Revenue', money(data.usage.revenue), 'Cash + bank on visits'],
              ['Staff', String(data.usage.staffCount), `${data.usage.queueToday} in today's queue`],
              ['Currently admitted', String(data.usage.currentlyAdmitted)],
              ['Stock value', money(data.usage.stockValue)],
              ['Stock purchases', money(data.usage.purchaseTotal), `${data.usage.purchaseCount} bills`],
              ['On platform since', new Date(data.createdAt).toLocaleDateString()],
            ].map(([label, value, sub2]) => (
              <div key={label as string} className="bg-surface-card p-4 rounded-[10px] border border-border shadow-xs">
                <p className="eyebrow text-ink-secondary">{label}</p>
                <p className="font-display text-lg font-semibold leading-tight mt-1">{value}</p>
                {sub2 && <p className="text-[11px] text-ink-secondary mt-0.5">{sub2}</p>}
              </div>
            ))}
          </div>

          {/* Subscription */}
          <div className="bg-surface-card rounded-[10px] border border-border shadow-xs overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-brand" /> Subscription
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPlan((v) => !v)}
                  className="px-2.5 py-1.5 text-[11px] font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded cursor-pointer"
                >
                  {sub ? 'Edit plan' : 'Set up plan'}
                </button>
                {sub && (
                  <button
                    onClick={() => setShowPayment((v) => !v)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-white bg-brand hover:bg-brand-deep rounded cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Record payment
                  </button>
                )}
              </div>
            </div>

            {showPlan && (
              <form onSubmit={savePlan} className="p-4 bg-surface-sunken border-b border-border space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block eyebrow text-ink-secondary mb-1">Plan</label>
                    <input value={planName} onChange={(e) => setPlanName(e.target.value)} className={inputClass} required />
                  </div>
                  <div>
                    <label className="block eyebrow text-ink-secondary mb-1">Monthly fee (₹)</label>
                    <input type="number" min="0" step="0.01" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} className={inputClass} required />
                  </div>
                  <div>
                    <label className="block eyebrow text-ink-secondary mb-1">Billing day</label>
                    <input type="number" min="1" max="28" value={billingDay} onChange={(e) => setBillingDay(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block eyebrow text-ink-secondary mb-1">Status</label>
                    <select value={planStatus} onChange={(e) => setPlanStatus(e.target.value)} className={inputClass}>
                      {['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowPlan(false)} className="px-3 py-1.5 text-xs font-medium text-ink-primary bg-surface-card border border-border rounded cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded cursor-pointer disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save plan'}
                  </button>
                </div>
              </form>
            )}

            {showPayment && sub && (
              <form onSubmit={savePayment} className="p-4 bg-surface-sunken border-b border-border space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block eyebrow text-ink-secondary mb-1">Amount (₹)</label>
                    <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} required />
                  </div>
                  <div>
                    <label className="block eyebrow text-ink-secondary mb-1">Method</label>
                    <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
                      {['bank', 'upi', 'cash', 'card'].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block eyebrow text-ink-secondary mb-1">Reference</label>
                    <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / txn id" className={inputClass} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowPayment(false)} className="px-3 py-1.5 text-xs font-medium text-ink-primary bg-surface-card border border-border rounded cursor-pointer">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="px-3 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded cursor-pointer disabled:opacity-50">
                    {saving ? 'Recording...' : 'Record payment'}
                  </button>
                </div>
              </form>
            )}

            {!sub ? (
              <p className="p-6 text-center text-xs text-ink-secondary">
                No subscription set up for this hospital yet.
              </p>
            ) : (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {[
                    ['Plan', sub.planName],
                    ['Monthly fee', money(sub.monthlyFee)],
                    ['Status', sub.effectiveStatus],
                    ['Next due', sub.nextDueDate || '—'],
                  ].map(([l, v]) => (
                    <div key={l as string}>
                      <p className="eyebrow text-ink-secondary">{l}</p>
                      <p className={`font-medium mt-0.5 ${l === 'Status' && v === 'OVERDUE' ? 'text-triage-urgent' : ''}`}>{v}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-ink-secondary border-t border-border pt-2">
                  Paid to date: <span className="font-mono font-medium text-ink-primary">{money(sub.paidToDate)}</span>
                  {' · '}
                  {sub.payments.length} payment(s) on record
                </p>

                {sub.payments.length > 0 && (
                  <div className="overflow-x-auto max-h-56 overflow-y-auto border border-border rounded">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-surface-page sticky top-0">
                        <tr className="border-b border-border text-ink-secondary font-medium">
                          <th className="py-2 px-3">Paid on</th>
                          <th className="py-2 px-3">Method</th>
                          <th className="py-2 px-3">Reference</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {sub.payments.map((p: any) => (
                          <tr key={p.id}>
                            <td className="py-2 px-3 font-mono text-ink-secondary">{p.paidOn}</td>
                            <td className="py-2 px-3">{p.method}</td>
                            <td className="py-2 px-3 text-ink-secondary">{p.reference || '—'}</td>
                            <td className="py-2 px-3 text-right font-mono">{money(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Staff */}
          <div className="bg-surface-card rounded-[10px] border border-border shadow-xs overflow-hidden">
            <h3 className="text-sm font-semibold p-4 border-b border-border">Team ({data.staff.length})</h3>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-page sticky top-0">
                  <tr className="border-b border-border text-ink-secondary font-medium">
                    <th className="py-2.5 px-4">Name</th>
                    <th className="py-2.5 px-4">Role</th>
                    <th className="py-2.5 px-4">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {data.staff.map((u: any) => (
                    <tr key={u.id} className="hover:bg-surface-page/60">
                      <td className="py-2.5 px-4 font-medium">{u.name}</td>
                      <td className="py-2.5 px-4 text-ink-secondary">{u.role}</td>
                      <td className="py-2.5 px-4 font-mono text-ink-secondary">{u.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
