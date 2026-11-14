import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { Package, Plus, RefreshCw, CheckCircle2, AlertCircle, Sparkles, Tag, Layers, UserCheck, Shield } from 'lucide-react';
import { Patient } from '../Patients/PatientList';
import { PackageTypeModal } from './PackageTypeModal';
import { SellPackageModal } from './SellPackageModal';
import { PackagePlanModal } from './PackagePlanModal';
import { HolidaysModal } from './HolidaysModal';
import { PackagePlan, STATE_STYLE, fmtDate, expiryText } from './packagePlan';
import { money } from '../../utils/money';
import { CalendarOff, Pencil } from 'lucide-react';

export interface PackageTypeItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  totalSittings: number;
  sittingGapDays?: number;
  validityDays?: number | null;
  skipSundays?: boolean;
  skipHolidays?: boolean;
  isActive?: boolean;
  treatmentId?: string;
  doctorId?: string;
}

export interface PackagePurchaseItem {
  id: string;
  patientId: string;
  patient: {
    uhid: string;
    name: string;
    phone: string;
  };
  packageTypeId: string;
  packageName: string;
  purchaseDate: string;
  amountPaid: number;
  sittingsUsed: number;
  sittingsRemaining: number;
  totalSittings?: number;
  plan?: PackagePlan;
}

type PurchaseFilter = 'attention' | 'active' | 'all';
const ATTENTION: PackagePlan['state'][] = ['OVERDUE', 'DUE_TODAY', 'EXPIRING_SOON', 'EXPIRED'];

export const PackageList: React.FC = () => {
  const { token, hasRole , apiFetch, user } = useAuth();
  /** Package type opened from a catalog card's Edit button. */
  const [editingType, setEditingType] = useState<PackageTypeItem | null>(null);

  const [packageTypes, setPackageTypes] = useState<PackageTypeItem[]>([]);
  const [purchases, setPurchases] = useState<PackagePurchaseItem[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [planFor, setPlanFor] = useState<string | null>(null);
  const [showHolidays, setShowHolidays] = useState(false);
  const [filter, setFilter] = useState<PurchaseFilter>('active');

  // Sell package form state
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedPackageTypeId, setSelectedPackageTypeId] = useState('');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [selling, setSelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { addToast } = useToast();
  const canSellPackage = hasRole('RECEPTION', 'RM', 'MASTER', 'SUPER_ADMIN');
  const canManagePackages = hasRole('MASTER', 'SUPER_ADMIN', 'DOCTOR');
  // Same rule as the server: admins edit any package; a doctor edits their own and
  // clinic-wide ones, not another doctor's.
  const canEditType = (pkg: PackageTypeItem) =>
    canManagePackages && (user?.role !== 'DOCTOR' || !pkg.doctorId || pkg.doctorId === user?.id);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resTypes, resPurchases, resPatients] = await Promise.all([
        apiFetch('/api/packages/types'),
        apiFetch('/api/packages/purchases'),
        apiFetch('/api/patients'),
      ]);

      const dataTypes = await resTypes.json();
      const dataPurchases = await resPurchases.json();
      const dataPatients = await resPatients.json();

      if (Array.isArray(dataTypes)) setPackageTypes(dataTypes);
      if (Array.isArray(dataPurchases)) setPurchases(dataPurchases);
      if (Array.isArray(dataPatients)) setPatients(dataPatients);

      if (dataTypes.length > 0) {
        setSelectedPackageTypeId(dataTypes[0].id);
        setAmountPaid(dataTypes[0].price);
      }
      if (dataPatients.length > 0) setSelectedPatientId(dataPatients[0].id);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePackageTypeSelect = (typeId: string) => {
    setSelectedPackageTypeId(typeId);
    const found = packageTypes.find((t) => t.id === typeId);
    if (found) setAmountPaid(found.price);
  };

  const handleSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedPackageTypeId) return;

    setSelling(true);
    setError(null);

    try {
      const res = await apiFetch('/api/packages/purchases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify({
          patientId: selectedPatientId,
          packageTypeId: selectedPackageTypeId,
          amountPaid: Number(amountPaid),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to complete package sale');

      setIsSellModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Error selling package');
    } finally {
      setSelling(false);
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-semibold text-ink-primary tracking-tight flex items-center gap-2">
            <Package className="w-4.5 h-4.5 text-brand" /> Packages & Sitting Counters
          </h2>
          <p className="hidden sm:block text-xs text-ink-secondary mt-0.5">
            Multi-sitting aesthetic package catalog and patient sitting balance tracker.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowHolidays(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded-md transition-colors cursor-pointer shrink-0"
          >
            <CalendarOff className="w-4 h-4 text-brand" />
            <span>Clinic Holidays</span>
          </button>
          <button
            onClick={() => setIsTypeModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded-md transition-colors cursor-pointer shrink-0"
          >
            <Shield className="w-4 h-4 text-brand" />
            <span>{canManagePackages ? 'Manage Package Types' : 'View Package Types'}</span>
          </button>

          {canSellPackage && (
            <button
              onClick={() => setIsSellModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Sell Package to Patient</span>
            </button>
          )}
        </div>
      </div>

      {/* Package Types Catalog Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-ink-primary tracking-tight flex items-center gap-2">
          <Tag className="w-4 h-4 text-brand" /> Available Aesthetic Package Catalog
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {packageTypes.map((pkg) => (
            <div key={pkg.id} className="bg-surface-card rounded-[10px] p-4 border border-border shadow-xs space-y-3 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand/10 text-brand-deep border border-brand/20">
                    {pkg.totalSittings} Total Sittings{pkg.sittingGapDays ? ` · every ${pkg.sittingGapDays}d` : ''}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${pkg.validityDays ? 'bg-surface-page text-ink-secondary border-border' : 'bg-status-warning/10 text-status-warning border-status-warning/20'}`}>
                    {pkg.validityDays ? `Valid ${pkg.validityDays} days` : 'No expiry'}
                  </span>
                </div>
                <h4 className="font-bold text-ink-primary text-sm mt-1">{pkg.name}</h4>
                <p className="text-xs text-ink-secondary leading-snug">{pkg.description}</p>
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-ink-secondary font-medium">Package Price</span>
                  <div className="text-sm font-extrabold text-ink-primary">{money(pkg.price)}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  {canEditType(pkg) && (
                    <button
                      onClick={() => {
                        setEditingType(pkg);
                        setIsTypeModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-ink-primary bg-surface-page hover:bg-border/50 border border-border rounded-lg transition-colors cursor-pointer"
                      title="Edit sittings, gap, validity and price"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  )}
                  {canSellPackage && (
                    <button
                      onClick={() => {
                        setSelectedPackageTypeId(pkg.id);
                        setAmountPaid(pkg.price);
                        setIsSellModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-brand bg-brand/10 hover:bg-brand-soft rounded-lg transition-colors cursor-pointer"
                    >
                      Sell Package
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Patient Package Purchases Tracker */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-ink-primary tracking-tight flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand" /> Patient Packages — Sittings, Plan & Expiry
          </h3>
          <div className="flex items-center gap-1 bg-surface-page border border-border rounded-md p-0.5 text-[11px] font-medium">
            {([
              ['attention', `Needs attention (${purchases.filter((p) => p.plan && ATTENTION.includes(p.plan.state)).length})`],
              ['active', 'Active'],
              ['all', 'All'],
            ] as [PurchaseFilter, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-2.5 py-1 rounded cursor-pointer ${filter === key ? 'bg-surface-card text-ink-primary shadow-xs border border-border' : 'text-ink-secondary hover:text-ink-primary'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <LoadingSkeleton rows={4} />
        ) : purchases.length === 0 ? (
          <div className="bg-surface-card rounded-[10px] border border-border p-8 text-center text-xs text-ink-secondary">
            No package purchases recorded yet. Click &quot;Sell Package to Patient&quot; to issue a multi-sitting package.
          </div>
        ) : (
          <div className="bg-surface-card rounded-[10px] border border-border overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-page border-b border-border text-ink-secondary font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Purchase Date</th>
                    <th className="py-3.5 px-4">Patient (UHID)</th>
                    <th className="py-3.5 px-4">Package Title</th>
                    <th className="py-3.5 px-4">Amount Paid</th>
                    <th className="py-3.5 px-4">Sitting Usage Progress</th>
                    <th className="py-3.5 px-4">Next Sitting</th>
                    <th className="py-3.5 px-4">Validity</th>
                    <th className="py-3.5 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-ink-secondary">
                  {purchases
                    .filter((pur) =>
                      filter === 'all' ? true
                      : filter === 'attention' ? !!pur.plan && ATTENTION.includes(pur.plan.state)
                      : !pur.plan || !['COMPLETED', 'LAPSED'].includes(pur.plan.state))
                    .map((pur) => {
                    const total = pur.sittingsUsed + pur.sittingsRemaining;
                    const percent = total > 0 ? Math.round((pur.sittingsUsed / total) * 100) : 0;
                    const isExhausted = pur.sittingsRemaining <= 0;
                    const plan = pur.plan;
                    const style = plan ? STATE_STYLE[plan.state] : null;

                    return (
                      <tr key={pur.id} className="hover:bg-surface-page/60 transition-colors">

                        {/* Purchase Date */}
                        <td className="py-3.5 px-4 font-medium text-ink-secondary">
                          {fmtDate(pur.purchaseDate)}
                        </td>

                        {/* Patient */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-ink-primary">{pur.patient?.name}</div>
                          <div className="font-mono text-[11px] text-brand">{pur.patient?.uhid}</div>
                        </td>

                        {/* Package Title */}
                        <td className="py-3.5 px-4 font-semibold text-ink-primary">
                          {pur.packageName}
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 font-bold text-ink-primary">
                          {money(pur.amountPaid)}
                        </td>

                        {/* Sitting Usage Progress Bar */}
                        <td className="py-3.5 px-4 min-w-[200px]">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-ink-primary">
                                {pur.sittingsUsed} / {total} Sittings Used
                              </span>
                              <span className={`font-bold ${isExhausted ? 'text-status-danger' : 'text-brand'}`}>
                                {pur.sittingsRemaining} Remaining
                              </span>
                            </div>
                            <div className="w-full bg-surface-page rounded-full h-2 overflow-hidden border border-border">
                              <div
                                className={`h-full transition-all duration-500 ${
                                  isExhausted ? 'bg-status-danger' : 'bg-brand'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Next sitting */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {plan?.nextSittingDate ? (
                            <>
                              <div className={`font-semibold ${plan.overdueDays > 0 ? 'text-status-warning' : 'text-ink-primary'}`}>
                                {fmtDate(plan.nextSittingDate, true)}
                              </div>
                              <div className="text-[10px] text-ink-secondary">
                                {plan.overdueDays > 0 ? `${plan.overdueDays}d overdue` : plan.nextIsDoctorPlanned ? 'Planned by doctor' : 'Regular gap'}
                              </div>
                            </>
                          ) : <span className="text-ink-secondary/60">—</span>}
                        </td>

                        {/* Validity */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {plan?.expiryDate ? (
                            <>
                              <div className="font-semibold text-ink-primary">{fmtDate(plan.expiryDate)}</div>
                              <div className={`text-[10px] ${plan.daysToExpiry !== null && plan.daysToExpiry <= 7 ? 'text-status-danger font-semibold' : 'text-ink-secondary'}`}>
                                {expiryText(plan)}
                              </div>
                            </>
                          ) : <span className="text-[11px] text-ink-secondary/70">No expiry</span>}
                          {!!plan?.extendedDays && plan.state !== 'LAPSED' && (
                            <div className="mt-0.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-status-danger/10 text-status-danger border border-status-danger/30">
                              +{plan.extendedDays}d by doctor
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex flex-col items-end gap-1.5">
                            {style ? (
                              <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap ${style.className}`}>{style.label}</span>
                            ) : (
                              <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${
                                isExhausted
                                  ? 'bg-status-danger/10 text-status-danger border-status-danger/20'
                                  : 'bg-status-success/10 text-status-success border-status-success/20'
                              }`}>
                                {isExhausted ? 'Fully Exhausted' : 'Active Package'}
                              </span>
                            )}
                            <button
                              onClick={() => setPlanFor(pur.id)}
                              className="text-[11px] font-semibold text-brand hover:underline cursor-pointer whitespace-nowrap"
                            >
                              {canManagePackages ? 'Manage plan' : 'View plan'}
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <SellPackageModal
        isOpen={isSellModalOpen}
        onClose={() => setIsSellModalOpen(false)}
        onSuccess={fetchData}
        initialPackageTypeId={selectedPackageTypeId}
        initialPatientId={selectedPatientId}
      />

      <PackageTypeModal
        isOpen={isTypeModalOpen}
        onClose={() => { setIsTypeModalOpen(false); setEditingType(null); }}
        onUpdate={fetchData}
        editPackage={editingType}
      />

      <PackagePlanModal purchaseId={planFor} onClose={() => setPlanFor(null)} onChanged={fetchData} />
      <HolidaysModal isOpen={showHolidays} onClose={() => setShowHolidays(false)} onChanged={fetchData} />

    </div>
  );
};
