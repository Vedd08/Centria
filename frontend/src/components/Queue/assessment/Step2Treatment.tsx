import React from 'react';
import { money } from '../types';

const inputClass = 'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

export interface Step2TreatmentProps {
  careType: 'OPD' | 'IPD';
  setCareType: (c: 'OPD' | 'IPD') => void;
  treatmentId: string;
  setTreatmentId: (t: string) => void;
  treatments: any[];
  setUsePackagePurchaseId: (id: string) => void;
  patientPurchases: any[];
  usePackagePurchaseId: string;
  setRecommendedPackageTypeId: (id: string) => void;
  recommendedPackageTypeId: string;
  packageTypes: any[];
  setNextAppointmentDate: (date: string) => void;
}

export const Step2Treatment: React.FC<Step2TreatmentProps> = ({
  careType, setCareType, treatmentId, setTreatmentId, treatments,
  setUsePackagePurchaseId, patientPurchases, usePackagePurchaseId,
  setRecommendedPackageTypeId, recommendedPackageTypeId, packageTypes,
  setNextAppointmentDate
}) => {
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
          <label className="block text-xs font-semibold text-ink-secondary mb-1">Treatment (day book)</label>
          <select value={treatmentId} onChange={(e) => {
              setTreatmentId(e.target.value);
              setUsePackagePurchaseId('');
            }} className={inputClass}>
            <option value="">Consultation only</option>
            {treatments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

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
        } else {
          const activeTypes = packageTypes.filter(pt => pt.isActive !== false);
          if (activeTypes.length > 0) {
            const treatmentPackages = treatmentId ? activeTypes.filter(pt => pt.treatmentId === treatmentId) : [];
            const otherPackages = activeTypes.filter(pt => pt.treatmentId !== treatmentId);
            const formatPkg = (pt: any) => `${pt.name} — ${pt.totalSittings} sittings, ${money(pt.price)}${pt.sittingGapDays ? ` (every ${pt.sittingGapDays} days)` : ''}`;
            
            return (
              <div className="p-3 bg-surface-page rounded-lg border border-border">
                <label className="block text-xs font-semibold text-ink-secondary mb-1">Recommend a package to reception</label>
                <select
                  value={recommendedPackageTypeId}
                  onChange={(e) => setRecommendedPackageTypeId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">No recommendation</option>
                  {treatmentPackages.length > 0 && (
                    <optgroup label={`For ${treatments.find(t => t.id === treatmentId)?.name || 'Treatment'}`}>
                      {treatmentPackages.map(pt => (
                        <option key={pt.id} value={pt.id}>{formatPkg(pt)}</option>
                      ))}
                    </optgroup>
                  )}
                  {otherPackages.length > 0 && (
                    <optgroup label={treatmentId ? "Other packages" : "All packages"}>
                      {otherPackages.map(pt => (
                        <option key={pt.id} value={pt.id}>{formatPkg(pt)}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            );
          }
        }
        return null;
      })()}
    </div>
  );
};