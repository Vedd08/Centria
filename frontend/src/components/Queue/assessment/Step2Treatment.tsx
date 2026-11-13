import React, { useState } from 'react';
import { money } from '../types';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { QuickAddProcedure, ProcedureOption } from '../../Treatments/QuickAddProcedure';

const inputClass = 'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

/** Sentinel select value for "create a new one" options. */
const NEW_OPTION = '__new__';

export interface Step2TreatmentProps {
  careType: 'OPD' | 'IPD';
  setCareType: (c: 'OPD' | 'IPD') => void;
  treatmentId: string;
  setTreatmentId: (t: string) => void;
  treatments: any[];
  /** Called after the doctor adds a procedure to the catalogue from here. */
  onTreatmentCreated: (t: ProcedureOption) => void;
  setUsePackagePurchaseId: (id: string) => void;
  patientPurchases: any[];
  usePackagePurchaseId: string;
  setRecommendedPackageTypeId: (id: string) => void;
  recommendedPackageTypeId: string;
  packageTypes: any[];
  /** Called after the doctor creates a new package from here. */
  onPackageCreated: (pkg: any) => void;
  setNextAppointmentDate: (date: string) => void;
}

/** Inline form for a new multi-sitting package, pre-linked to the chosen procedure. */
const QuickAddPackage: React.FC<{
  treatmentId: string;
  treatmentName?: string;
  onCreated: (pkg: any) => void;
  onCancel: () => void;
}> = ({ treatmentId, treatmentName, onCreated, onCancel }) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [name, setName] = useState(treatmentName ? `${treatmentName} package` : '');
  const [sittings, setSittings] = useState('6');
  const [price, setPrice] = useState('');
  const [gapDays, setGapDays] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) return setError('Enter the package name');
    if (!Number(sittings) || Number(sittings) < 1) return setError('Sittings must be at least 1');
    if (price === '' || Number(price) < 0) return setError('Enter the package price');
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch('/api/packages/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          totalSittings: Math.floor(Number(sittings)),
          price: Number(price),
          sittingGapDays: gapDays ? Math.floor(Number(gapDays)) : undefined,
          treatmentId: treatmentId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data.message) ? data.message.join(', ') : data.message;
        throw new Error(msg || 'Could not create the package');
      }
      addToast('success', `Package "${data.name}" created`);
      onCreated(data);
    } catch (err: any) {
      setError(err.message || 'Could not create the package');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 p-3 rounded-lg border border-brand/30 bg-brand-soft/50 space-y-2.5">
      <p className="text-[11px] font-semibold text-brand-deep">
        New package{treatmentName ? ` for ${treatmentName}` : ''}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Package name *"
          className={`${inputClass} col-span-2`}
        />
        <input type="number" min="1" value={sittings} onChange={(e) => setSittings(e.target.value)} placeholder="Sittings *" title="Total sittings" className={inputClass} />
        <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price (₹) *" className={inputClass} />
        <input
          type="number"
          min="1"
          value={gapDays}
          onChange={(e) => setGapDays(e.target.value)}
          placeholder="Days between sittings"
          className={`${inputClass} col-span-2`}
        />
      </div>
      {error && <p className="text-[11px] text-status-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-[11px] font-medium text-ink-secondary hover:text-ink-primary rounded-md cursor-pointer">
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-3 py-1.5 text-[11px] font-semibold text-white bg-brand hover:bg-brand-deep rounded-md cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Creating...' : 'Create package'}
        </button>
      </div>
    </div>
  );
};

export const Step2Treatment: React.FC<Step2TreatmentProps> = ({
  careType, setCareType, treatmentId, setTreatmentId, treatments, onTreatmentCreated,
  setUsePackagePurchaseId, patientPurchases, usePackagePurchaseId,
  setRecommendedPackageTypeId, recommendedPackageTypeId, packageTypes, onPackageCreated,
  setNextAppointmentDate
}) => {
  const [addingProcedure, setAddingProcedure] = useState(false);
  const [addingPackage, setAddingPackage] = useState(false);
  const selectedTreatmentName = treatments.find((t) => t.id === treatmentId)?.name;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-ink-secondary mb-1">
            Route patient to <span className="text-status-danger">*</span>
          </label>
          <select value={careType} onChange={(e) => setCareType(e.target.value as 'OPD' | 'IPD')} className={inputClass}>
            <option value="OPD">OPD — outpatient, treat and send home</option>
            <option value="IPD">IPD — procedure / inpatient care</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-secondary mb-1">Procedure done today</label>
          <select
            value={addingProcedure ? NEW_OPTION : treatmentId}
            onChange={(e) => {
              if (e.target.value === NEW_OPTION) {
                setAddingProcedure(true);
                return;
              }
              setAddingProcedure(false);
              setTreatmentId(e.target.value);
              setUsePackagePurchaseId('');
            }}
            className={inputClass}
          >
            <option value="">Consultation only — no procedure</option>
            {treatments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value={NEW_OPTION}>+ Add a new procedure…</option>
          </select>
          <p className="text-[10px] text-ink-secondary/70 mt-1">Recorded in the day book and billed at reception.</p>
        </div>
      </div>

      {addingProcedure && (
        <QuickAddProcedure
          onCancel={() => setAddingProcedure(false)}
          onCreated={(t) => {
            onTreatmentCreated(t);
            setTreatmentId(t.id);
            setUsePackagePurchaseId('');
            setAddingProcedure(false);
          }}
        />
      )}

      {(() => {
        const activePackage = treatmentId ? patientPurchases.find(p => p.package?.treatmentId === treatmentId && p.sittingsRemaining > 0) : null;

        if (activePackage) {
          return (
            <div className="p-3 bg-brand-soft rounded-lg border border-brand/20">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!usePackagePurchaseId}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setUsePackagePurchaseId(activePackage.id);
                      setRecommendedPackageTypeId('');
                      if (activePackage.packageType?.sittingGapDays) {
                        const nextDate = new Date();
                        nextDate.setDate(nextDate.getDate() + activePackage.packageType.sittingGapDays);
                        setNextAppointmentDate(nextDate.toISOString().split('T')[0]);
                      }
                    } else {
                      setUsePackagePurchaseId('');
                    }
                  }}
                  className="rounded border-brand/30 text-brand focus:ring-brand"
                />
                <span className="text-sm font-medium text-brand-deep">
                  Count this visit as a package sitting
                </span>
              </label>
              {usePackagePurchaseId && (
                <div className="mt-2 text-xs text-brand-deep/80 pl-6">
                  Will use sitting {activePackage.sittingsUsed + 1} of {activePackage.totalSittings} ({activePackage.sittingsRemaining} remaining)
                </div>
              )}
            </div>
          );
        }

        const activeTypes = packageTypes.filter(pt => pt.isActive !== false);
        const treatmentPackages = treatmentId ? activeTypes.filter(pt => pt.treatmentId === treatmentId) : [];
        const otherPackages = activeTypes.filter(pt => pt.treatmentId !== treatmentId);
        const formatPkg = (pt: any) => `${pt.name} — ${pt.totalSittings} sittings, ${money(pt.price)}${pt.sittingGapDays ? ` (every ${pt.sittingGapDays} days)` : ''}`;

        return (
          <div className="p-3 bg-surface-page rounded-lg border border-border">
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Recommend a procedure package (multiple sittings) to reception
            </label>
            <select
              value={addingPackage ? NEW_OPTION : recommendedPackageTypeId}
              onChange={(e) => {
                if (e.target.value === NEW_OPTION) {
                  setAddingPackage(true);
                  return;
                }
                setAddingPackage(false);
                setRecommendedPackageTypeId(e.target.value);
              }}
              className={inputClass}
            >
              <option value="">No recommendation</option>
              {treatmentPackages.length > 0 && (
                <optgroup label={`For ${selectedTreatmentName || 'this procedure'}`}>
                  {treatmentPackages.map(pt => (
                    <option key={pt.id} value={pt.id}>{formatPkg(pt)}</option>
                  ))}
                </optgroup>
              )}
              {otherPackages.length > 0 && (
                <optgroup label={treatmentId ? 'Other packages' : 'All packages'}>
                  {otherPackages.map(pt => (
                    <option key={pt.id} value={pt.id}>{formatPkg(pt)}</option>
                  ))}
                </optgroup>
              )}
              <option value={NEW_OPTION}>+ Create a new package…</option>
            </select>
            {addingPackage && (
              <QuickAddPackage
                treatmentId={treatmentId}
                treatmentName={selectedTreatmentName}
                onCancel={() => setAddingPackage(false)}
                onCreated={(pkg) => {
                  onPackageCreated(pkg);
                  setRecommendedPackageTypeId(pkg.id);
                  setAddingPackage(false);
                }}
              />
            )}
          </div>
        );
      })()}
    </div>
  );
};
