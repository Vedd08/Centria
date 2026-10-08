import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { Percent, Shield, RefreshCw, Stethoscope, Users, User, HeartHandshake, Sparkles, Filter, Download } from 'lucide-react';
import { exportToCsv } from '../../utils/exportToCsv';
import { money } from '../../utils/money';

export interface CommissionRuleItem {
  id: string;
  role: 'Doctor' | 'RM' | 'Operator' | 'ReferringDoctor';
  shareType: 'percentage' | 'fixed';
  value: number;
}

export interface CommissionRecordItem {
  id: string;
  visitId: string;
  visit: {
    date: string;
    treatmentName: string;
    patient: {
      uhid: string;
      name: string;
    };
  };
  role: string;
  beneficiaryName: string;
  visitStatus: string;
  treatmentPrice: number;
  shareType: 'percentage' | 'fixed';
  ruleValue: number;
  calculatedAmount: number;
  createdAt: string;
}

export const CommissionList: React.FC = () => {
  const { token, hasRole , apiFetch } = useAuth();
  
  const [rules, setRules] = useState<CommissionRuleItem[]>([]);
  const [records, setRecords] = useState<CommissionRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  
  // Rule editor state
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editShareType, setEditShareType] = useState<'percentage' | 'fixed'>('percentage');
  const [editValue, setEditValue] = useState<number>(0);
  const [savingRule, setSavingRule] = useState(false);

  const { addToast } = useToast();
  const canEditRules = hasRole('MASTER', 'SUPER_ADMIN');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resRules, resRecords] = await Promise.all([
        apiFetch('/api/commissions/rules'),
        apiFetch('/api/commissions/records'),
      ]);

      const dataRules = await resRules.json();
      const dataRecords = await resRecords.json();

      if (Array.isArray(dataRules)) setRules(dataRules);
      if (Array.isArray(dataRecords)) setRecords(dataRecords);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to load commission data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;

    setSavingRule(true);
    try {
      const res = await apiFetch('/api/commissions/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify({
          role: editingRole,
          shareType: editShareType,
          value: Number(editValue),
        }),
      });

      if (res.ok) {
        setEditingRole(null);
        fetchData();
      }
    } catch (err: any) {
      addToast('error', err.message || 'Failed to save commission rule');
    } finally {
      setSavingRule(false);
    }
  };

  const filteredRecords = roleFilter === 'ALL'
    ? records
    : records.filter((r) => r.role === roleFilter);

  const totalCalculatedPayout = filteredRecords.reduce((sum, r) => sum + r.calculatedAmount, 0);

  const roleIcons: Record<string, React.ReactNode> = {
    Doctor: <Stethoscope className="w-4 h-4 text-brand" />,
    RM: <Users className="w-4 h-4 text-brand" />,
    Operator: <User className="w-4 h-4 text-brand" />,
    ReferringDoctor: <HeartHandshake className="w-4 h-4 text-brand" />,
  };

  return (
    <div className="space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-semibold text-ink-primary tracking-tight flex items-center gap-2">
            <Percent className="w-4.5 h-4.5 text-brand" /> Role Commission Engine
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Auto-calculates role shares (RM, Operator, Doctor, Referring Doctor) for New visits per Business Rule 3.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToCsv('commissions', filteredRecords, [
              { key: 'visit', label: 'Date', format: (v: any) => v?.date || '' },
              { key: 'visit', label: 'Patient', format: (v: any) => v?.patient?.name || '' },
              { key: 'visit', label: 'UHID', format: (v: any) => v?.patient?.uhid || '' },
              { key: 'visit', label: 'Treatment', format: (v: any) => v?.treatmentName || '' },
              { key: 'role', label: 'Role' },
              { key: 'beneficiaryName', label: 'Beneficiary' },
              { key: 'calculatedAmount', label: 'Amount', format: (v: number) => `₹${v.toFixed(2)}` },
            ])}
            className="p-2 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border transition-colors cursor-pointer shrink-0"
            title="Export to CSV"
          >
            <Download className="w-4 h-4" />
          </button>

          <div className="bg-brand-soft border border-brand/20 px-4 py-2 rounded-xl text-right">
            <span className="text-[10px] text-brand-soft font-semibold uppercase tracking-wider block">Total Ledger Payout</span>
            <span className="text-lg font-extrabold text-brand-deep">{money(totalCalculatedPayout)}</span>
          </div>
        </div>
      </div>

      {/* Business Rule 3 Highlight Banner */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-2xl p-5 shadow-sm space-y-2">
        <div className="flex items-center gap-2 font-bold text-xs text-purple-200 uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-purple-300" /> Business Rule 3 Auto-Calculation Engine
        </div>
        <p className="text-sm text-purple-100 leading-relaxed">
          Saving a Visit auto-calculates commission for each role from CommissionRule, <span className="font-bold underline text-white">ONLY when visit status is &quot;New&quot; — NEVER for &quot;Follow Up&quot;</span>.
        </p>
      </div>

      {/* Commission Rules Configuration Matrix */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink-primary tracking-tight flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand" /> Role Commission Rules
          </h3>
          {canEditRules && <span className="text-xs text-ink-secondary">Admin editable</span>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {['Doctor', 'RM', 'Operator', 'ReferringDoctor'].map((roleName) => {
            const rule = rules.find((r) => r.role === roleName) || {
              id: '',
              role: roleName as any,
              shareType: roleName === 'Operator' ? 'fixed' : 'percentage',
              value: roleName === 'Operator' ? 300 : roleName === 'Doctor' ? 15 : roleName === 'ReferringDoctor' ? 10 : 5,
            };

            const isEditing = editingRole === roleName;

            return (
              <div key={roleName} className="bg-surface-card rounded-[10px] p-4 border border-border shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-ink-primary text-sm">
                    {roleIcons[roleName]}
                    <span>{roleName === 'ReferringDoctor' ? 'Referring Doctor' : roleName}</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-surface-page text-ink-secondary">
                    {rule.shareType}
                  </span>
                </div>

                {!isEditing ? (
                  <div className="flex items-baseline justify-between pt-2 border-t border-border/60">
                    <div className="text-xl font-extrabold text-ink-primary">
                      {rule.shareType === 'percentage' ? `${rule.value}%` : `₹${rule.value}`}
                    </div>
                    {canEditRules && (
                      <button
                        onClick={() => {
                          setEditingRole(roleName);
                          setEditShareType(rule.shareType as any);
                          setEditValue(rule.value);
                        }}
                        className="text-xs font-semibold text-brand hover:text-brand-deep cursor-pointer"
                      >
                        Edit Rule
                      </button>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleSaveRule} className="space-y-2 pt-2 border-t border-border/60">
                    <select
                      value={editShareType}
                      onChange={(e) => setEditShareType(e.target.value as any)}
                      className="w-full text-xs px-2 py-1 rounded border border-border bg-surface-card"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (₹)</option>
                    </select>

                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={editValue}
                        onChange={(e) => setEditValue(Number(e.target.value))}
                        className="w-full text-xs px-2 py-1 rounded border border-border bg-surface-card font-bold"
                      />
                      <button
                        type="submit"
                        disabled={savingRule}
                        className="px-2.5 py-1 text-xs font-bold text-white bg-brand hover:bg-brand-deep rounded shrink-0 cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Commission Earnings Ledger Table */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-ink-primary tracking-tight">
            Generated Commission Ledger ({filteredRecords.length} entries)
          </h3>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-medium pb-1">
            <Filter className="w-3.5 h-3.5 text-ink-secondary shrink-0" />
            {['ALL', 'Doctor', 'RM', 'Operator', 'ReferringDoctor'].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                  roleFilter === r
                    ? 'bg-brand text-white border-brand font-bold'
                    : 'bg-surface-card text-ink-secondary border-border hover:bg-surface-page'
                }`}
              >
                {r === 'ALL' ? 'All Roles' : r === 'ReferringDoctor' ? 'Ref. Doctor' : r}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <LoadingSkeleton rows={5} />
        ) : filteredRecords.length === 0 ? (
          <div className="bg-surface-card rounded-[10px] border border-border p-8 text-center text-xs text-ink-secondary">
            No commission records found for this role filter. Log a &quot;New&quot; visit to trigger auto-calculation.
          </div>
        ) : (
          <div className="bg-surface-card rounded-[10px] border border-border overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-page border-b border-border text-ink-secondary font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Visit Date</th>
                    <th className="py-3.5 px-4">Patient (UHID)</th>
                    <th className="py-3.5 px-4">Treatment</th>
                    <th className="py-3.5 px-4">Visit Status</th>
                    <th className="py-3.5 px-4">Role</th>
                    <th className="py-3.5 px-4">Beneficiary Name</th>
                    <th className="py-3.5 px-4">Calculation Applied</th>
                    <th className="py-3.5 px-4 text-right">Commission Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-ink-secondary">
                  {filteredRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-surface-page/60 transition-colors">
                      
                      {/* Date */}
                      <td className="py-3.5 px-4 font-medium text-ink-secondary">
                        {rec.visit?.date || '—'}
                      </td>

                      {/* Patient */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-ink-primary">{rec.visit?.patient?.name}</div>
                        <div className="font-mono text-[11px] text-brand">{rec.visit?.patient?.uhid}</div>
                      </td>

                      {/* Treatment */}
                      <td className="py-3.5 px-4 font-medium text-ink-primary">
                        {rec.visit?.treatmentName}
                      </td>

                      {/* Visit Status */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-status-success/10 text-status-success border border-status-success/20">
                          {rec.visitStatus} Visit
                        </span>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4 font-semibold text-ink-primary">
                        {rec.role}
                      </td>

                      {/* Beneficiary Name */}
                      <td className="py-3.5 px-4 font-bold text-ink-primary">
                        {rec.beneficiaryName}
                      </td>

                      {/* Calculation Applied */}
                      <td className="py-3.5 px-4 text-ink-secondary text-[11px]">
                        {rec.shareType === 'percentage'
                          ? `${rec.ruleValue}% of ${money(rec.treatmentPrice)}`
                          : `Fixed ₹${rec.ruleValue}`}
                      </td>

                      {/* Calculated Amount */}
                      <td className="py-3.5 px-4 text-right font-extrabold text-brand text-sm">
                        {money(rec.calculatedAmount)}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
