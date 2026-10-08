import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { X, Calendar, Stethoscope, Lock, AlertCircle, Check, Package } from 'lucide-react';
import { Patient } from '../Patients/PatientList';

interface TreatmentItem {
  id: string;
  name: string;
  isGstTaxable: boolean;
}

interface PatientPackage {
  id: string;
  packageName: string;
  sittingsUsed: number;
  sittingsRemaining: number;
}

interface UserItem {
  id: string;
  name: string;
  role: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onVisitLogged: () => void;
  initialData?: {
    patientId?: string;
    doctorId?: string;
    date?: string;
  };
}

export const VisitLoggingModal: React.FC<Props> = ({ isOpen, onClose, onVisitLogged, initialData }) => {
  const { user, token , apiFetch } = useAuth();
  const { addToast } = useToast();
  
  const [patients, setPatients] = useState<Patient[]>([]);
  const [treatments, setTreatments] = useState<TreatmentItem[]>([]);
  const [patientPackages, setPatientPackages] = useState<PatientPackage[]>([]);
  
  const [doctorUsers, setDoctorUsers] = useState<UserItem[]>([]);
  const [rmUsers, setRmUsers] = useState<UserItem[]>([]);
  
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedTreatmentId, setSelectedTreatmentId] = useState<string>('');
  const [selectedTreatment, setSelectedTreatment] = useState<TreatmentItem | null>(null);
  
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [selectedRmId, setSelectedRmId] = useState<string>('');
  
  // Package billing state
  const [billAgainstPackage, setBillAgainstPackage] = useState<boolean>(false);
  const [selectedPackagePurchaseId, setSelectedPackagePurchaseId] = useState<string>('');
  const [selectedPackage, setSelectedPackage] = useState<PatientPackage | null>(null);
  
  const [operator, setOperator] = useState<string>(''); // Free text (intentional)
  const [diagnosis, setDiagnosis] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [otherRemarks, setOtherRemarks] = useState<string>('');
  const [status, setStatus] = useState<'New' | 'Follow Up' | 'Dressing'>('New');
  const [visitType, setVisitType] = useState<'OPD' | 'IPD'>('OPD');
  const [cashAmount, setCashAmount] = useState<string>('');
  const [bankAmount, setBankAmount] = useState<string>('');
  const [paymentRefId, setPaymentRefId] = useState<string>('');
  const [date, setDate] = useState<string>(initialData?.date || new Date().toISOString().split('T')[0]);
  const [nextAppointmentDate, setNextAppointmentDate] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Track if the user has manually changed the patient/treatment/doctor/RM selection
  // so initial data-fetch callbacks do not overwrite the user's choice.
  const hasInteracted = useRef(false);

  useEffect(() => {
    if (isOpen) {
      hasInteracted.current = false;

      // Fetch Patients (large pageSize for full dropdown)
      apiFetch('/api/patients?pageSize=1000')
        .then((res) => res.json())
        .then((result) => {
          const data = Array.isArray(result) ? result : (result.data || []);
          if (Array.isArray(data)) {
            setPatients(data);
            if (!hasInteracted.current && data.length > 0) {
              const pId = initialData?.patientId || data[0].id;
              setSelectedPatientId(pId);
              fetchPatientPackages(pId);
            }
          }
        });

      // Fetch TreatmentMaster items
      apiFetch('/api/treatments')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setTreatments(data);
            if (!hasInteracted.current && data.length > 0) {
              setSelectedTreatmentId(data[0].id);
              setSelectedTreatment(data[0]);
            }
          }
        });

      // Fetch real staff for the Doctor & RM selectors
      apiFetch('/api/users?role=DOCTOR,MASTER,SUPER_ADMIN', {
        })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data)) {
            setDoctorUsers(data);
            if (!hasInteracted.current) {
              if (initialData?.doctorId) {
                setSelectedDoctorId(initialData.doctorId);
              } else {
                const self = data.find((u: UserItem) => u.id === user?.id);
                setSelectedDoctorId(self?.id ?? data[0]?.id ?? '');
              }
            }
          }
        })
        .catch(() => setDoctorUsers([]));

      apiFetch('/api/users?role=RM,RECEPTION,MASTER,SUPER_ADMIN', {
        })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data)) {
            setRmUsers(data);
            if (!hasInteracted.current) {
              const self = data.find((u: UserItem) => u.id === user?.id);
              setSelectedRmId(self?.id ?? data[0]?.id ?? '');
            }
          }
        })
        .catch(() => setRmUsers([]));

      if (initialData?.date) {
        setDate(initialData.date);
      }
    }
  }, [isOpen, token, user?.id, initialData]);

  const fetchPatientPackages = async (patientId: string) => {
    try {
      const res = await apiFetch(`/api/packages/purchases?patientId=${patientId}`, {
        });
      const data = await res.json();
      if (Array.isArray(data)) {
        setPatientPackages(data);
        if (data.length > 0) {
          setSelectedPackagePurchaseId(data[0].id);
          setSelectedPackage(data[0]);
        } else {
          setBillAgainstPackage(false);
          setSelectedPackagePurchaseId('');
          setSelectedPackage(null);
        }
      }
    } catch (err: any) {
      addToast('error', err.message || 'Could not load patient packages');
    }
  };

  const handlePatientChange = (patientId: string) => {
    hasInteracted.current = true;
    setSelectedPatientId(patientId);
    fetchPatientPackages(patientId);
  };

  const handleTreatmentChange = (treatmentId: string) => {
    hasInteracted.current = true;
    setSelectedTreatmentId(treatmentId);
    const found = treatments.find((t) => t.id === treatmentId);
    setSelectedTreatment(found || null);
  };

  const handlePackageChange = (packageId: string) => {
    setSelectedPackagePurchaseId(packageId);
    const found = patientPackages.find((p) => p.id === packageId);
    setSelectedPackage(found || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedTreatmentId || !selectedDoctorId) {
      setError('Please select Patient, Treatment and Doctor');
      return;
    }

    if (billAgainstPackage && selectedPackage && selectedPackage.sittingsRemaining <= 0) {
      setError(`Business Rule 2 Violation: Package '${selectedPackage.packageName}' has 0 sittings remaining! Select a package with available sittings or uncheck package billing.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/visits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify({
          patientId: selectedPatientId,
          visitType,
          treatmentId: selectedTreatmentId,
          doctorId: selectedDoctorId,
          rmId: selectedRmId || undefined,
          operator,
          packagePurchaseId: billAgainstPackage ? selectedPackagePurchaseId : undefined,
          diagnosis: diagnosis || undefined,
          remarks: remarks || undefined,
          otherRemarks: otherRemarks || undefined,
          cashAmount: cashAmount ? Number(cashAmount) : undefined,
          bankAmount: bankAmount ? Number(bankAmount) : undefined,
          paymentRefId: paymentRefId || undefined,
          status,
          date,
          nextAppointmentDate: nextAppointmentDate || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to log visit');
      }

      onVisitLogged();
      onClose();
      setDiagnosis('');
      setRemarks('');
      setOtherRemarks('');
      setCashAmount('');
      setBankAmount('');
      setPaymentRefId('');
      setNextAppointmentDate('');
    } catch (err: any) {
      setError(err.message || 'Error logging visit');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isRule2Blocked = billAgainstPackage && selectedPackage && selectedPackage.sittingsRemaining <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-2xl w-full mx-2 sm:mx-0 my-4 sm:my-8 overflow-hidden">
        
        {/* Header */}
        <div className="bg-brand px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/10">
              <Stethoscope className="w-5 h-5 text-brand-soft" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Log Daily Patient Visit</h2>
              <p className="text-xs text-white/80">Enforces Rule 1 (Auto GST), Rule 2 (Package Sittings), & User FKs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {error && (
            <div className="p-3.5 rounded-lg bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Business Rule 1 Highlight Box */}
          {selectedTreatment && (
            <div className={`p-3.5 rounded-xl border flex items-start gap-3 transition-all text-xs ${
              selectedTreatment.isGstTaxable
                ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
            }`}>
              <Lock className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold flex items-center gap-2">
                  <span>Business Rule 1 Auto-Filled GST Taxability:</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wider ${
                    selectedTreatment.isGstTaxable ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'
                  }`}>
                    {selectedTreatment.isGstTaxable ? 'Taxable Treatment (18% GST)' : 'GST Exempt Medical Care'}
                  </span>
                </div>
                <p className="text-[11px] opacity-80">
                  Taxability for &quot;{selectedTreatment.name}&quot; is driven strictly from TreatmentMaster.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Select Patient — identified by name + mobile, as the clinic does */}
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Select Patient <span className="text-status-danger">*</span>
              </label>
              <select
                required
                value={selectedPatientId}
                onChange={(e) => handlePatientChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card font-medium text-ink-primary"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.phone})
                  </option>
                ))}
              </select>
            </div>

            {/* OPD vs IPD day-book */}
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Day Book <span className="text-status-danger">*</span>
              </label>
              <select
                required
                value={visitType}
                onChange={(e) => setVisitType(e.target.value as 'OPD' | 'IPD')}
                className="w-full px-3 py-2 rounded-lg border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card font-semibold text-ink-primary"
              >
                <option value="OPD">OPD — Outpatient consultation</option>
                <option value="IPD">IPD — Procedure / surgery</option>
              </select>
            </div>

            {/* Select Treatment */}
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Select Treatment / Procedure <span className="text-status-danger">*</span>
              </label>
              <select
                required
                value={selectedTreatmentId}
                onChange={(e) => handleTreatmentChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card font-semibold text-ink-primary"
              >
                {treatments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.isGstTaxable ? '[Taxable]' : '[Exempt]'}
                  </option>
                ))}
              </select>
            </div>

            {/* Select Doctor (User FK) */}
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Attending Doctor (User FK) <span className="text-status-danger">*</span>
              </label>
              <select
                required
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card font-semibold text-ink-primary"
              >
                {doctorUsers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Select RM — optional, the day-books usually leave it blank */}
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Relationship Manager (Optional)
              </label>
              <select
                value={selectedRmId}
                onChange={(e) => setSelectedRmId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card font-semibold text-ink-primary"
              >
                <option value="">None</option>
                {rmUsers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Operator (Free Text - Intentional) */}
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Operator / Nurse (Free Text) <span className="text-status-danger">*</span>
              </label>
              <input
                type="text"
                required
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                placeholder="Operator name"
                className="w-full px-3 py-2 rounded-lg border border-border text-xs bg-surface-card"
              />
            </div>

            {/* Visit Status — "Dressing" mirrors the clinic's third day-book status */}
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Visit Status <span className="text-status-danger">*</span>
              </label>
              <select
                required
                value={status}
                onChange={(e) => setStatus(e.target.value as 'New' | 'Follow Up' | 'Dressing')}
                className="w-full px-3 py-2 rounded-lg border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card font-semibold text-ink-primary"
              >
                <option value="New">New (earns commission)</option>
                <option value="Follow Up">Follow Up</option>
                <option value="Dressing">Dressing</option>
              </select>
            </div>

            {/* Visit Date */}
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Visit Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border text-xs bg-surface-card"
              />
            </div>

            {/* Next Appointment Date */}
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Next Appointment Date (Optional)
              </label>
              <input
                type="date"
                value={nextAppointmentDate}
                onChange={(e) => setNextAppointmentDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border text-xs bg-surface-card"
              />
            </div>

          </div>

          {/* Business Rule 2 Package Billing Integration */}
          <div className="bg-surface-page border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-ink-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={billAgainstPackage}
                  onChange={(e) => setBillAgainstPackage(e.target.checked)}
                  disabled={patientPackages.length === 0}
                  className="rounded text-brand focus:ring-brand"
                />
                <span className="flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-brand" /> Bill Visit Against Active Patient Package (Rule 2)
                </span>
              </label>
              {patientPackages.length === 0 && (
                <span className="text-[11px] text-ink-secondary font-medium">No packages purchased by this patient</span>
              )}
            </div>

            {billAgainstPackage && patientPackages.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-border">
                <select
                  value={selectedPackagePurchaseId}
                  onChange={(e) => handlePackageChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border text-xs bg-surface-card font-semibold text-ink-primary"
                >
                  {patientPackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.packageName} — {pkg.sittingsRemaining} Sittings Remaining
                    </option>
                  ))}
                </select>

                {selectedPackage && (
                  <div className={`p-3 rounded-lg text-xs flex items-center justify-between border ${
                    selectedPackage.sittingsRemaining > 0
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : 'bg-rose-50 text-rose-900 border-rose-200 font-bold'
                  }`}>
                    <span>
                      {selectedPackage.sittingsRemaining > 0
                        ? `✓ Package Active: Will auto-decrement sittings remaining from ${selectedPackage.sittingsRemaining} → ${selectedPackage.sittingsRemaining - 1}`
                        : `❌ Business Rule 2 Violation: Package has 0 remaining sittings! Cannot process visit.`}
                    </span>
                    <span className="font-extrabold uppercase px-2 py-0.5 rounded bg-white border">
                      {selectedPackage.sittingsRemaining} Remaining
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment collected on this visit, as recorded in the day book */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Cash (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border border-border text-xs bg-surface-card"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Bank (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={bankAmount}
                onChange={(e) => setBankAmount(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 rounded-lg border border-border text-xs bg-surface-card"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Payment Ref ID</label>
              <input
                type="text"
                value={paymentRefId}
                onChange={(e) => setPaymentRefId(e.target.value)}
                placeholder="UTR / txn id"
                className="w-full px-3 py-2 rounded-lg border border-border text-xs bg-surface-card"
              />
            </div>
          </div>

          {/* Clinical Diagnosis Notes */}
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Diagnosis & Clinical Notes (Free Text)
            </label>
            <textarea
              rows={2}
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="e.g. Clinical assessment notes..."
              className="w-full px-3 py-2 rounded-lg border border-border text-xs bg-surface-card text-ink-primary"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Remarks</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. 1ST SITTING"
                className="w-full px-3 py-2 rounded-lg border border-border text-xs bg-surface-card"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Other Remarks</label>
              <input
                type="text"
                value={otherRemarks}
                onChange={(e) => setOtherRemarks(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 rounded-lg border border-border text-xs bg-surface-card"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-ink-secondary hover:text-ink-primary rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !!isRule2Blocked}
              className="px-5 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Logging Visit...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Visit Record</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
