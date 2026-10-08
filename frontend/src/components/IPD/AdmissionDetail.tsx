import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../common/StatusBadge';
import { MedicationChart } from './MedicationChart';
import { ProgressNotesFeed } from './ProgressNotesFeed';
import { CONDITION_LABEL, conditionVariant } from './conditionStatus';
import { PatientHistoryPanel, HistoryPatient } from '../PatientHistory/PatientHistoryPanel';
import { ArrowLeft, BedDouble, LogOut, Pill, Activity, FileText, X } from 'lucide-react';

export interface Admission {
  id: string;
  admissionDate: string;
  dischargeDate?: string;
  dischargeSummary?: string;
  status: string;
  currentStatus: string;
  reasonForAdmission: string;
  patient: HistoryPatient;
  doctor?: { name: string };
  admittedBy?: { name: string };
  dischargedBy?: { name: string };
  bed?: { bedNumber: string; ward?: { name: string } };
  progressNotes?: { status: string; pulse: string; bloodPressure: string; spo2: string }[];
}

interface AdmissionDetailProps {
  admission: Admission;
  onBack: () => void;
  onDischarged: () => void;
  /** Called after anything else that should refresh this admission (e.g. a status-changing note). */
  onChanged?: () => void;
}

type TabKey = 'medications' | 'notes' | 'history';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'medications', label: 'Medications & Drug Chart', icon: Pill },
  { key: 'notes', label: 'Progress & Recovery', icon: Activity },
  { key: 'history', label: 'History & Images', icon: FileText },
];

export const AdmissionDetail: React.FC<AdmissionDetailProps> = ({ admission, onBack, onDischarged, onChanged }) => {
  const { apiFetch, hasRole } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('medications');
  const [showDischarge, setShowDischarge] = useState(false);
  const [dischargeSummary, setDischargeSummary] = useState('');
  const [discharging, setDischarging] = useState(false);

  const isActiveAdmission = admission.status === 'ADMITTED';
  const canDischarge = hasRole('DOCTOR', 'NURSE') && isActiveAdmission;

  const handleDischarge = async (e: React.FormEvent) => {
    e.preventDefault();
    setDischarging(true);
    try {
      const res = await apiFetch(`/api/admissions/${admission.id}/discharge`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dischargeSummary: dischargeSummary.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to discharge patient' }));
        throw new Error(err.message || 'Failed to discharge patient');
      }
      addToast('success', `${admission.patient.name} discharged — bed freed`);
      setShowDischarge(false);
      onDischarged();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to discharge patient');
    } finally {
      setDischarging(false);
    }
  };

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      <div className="bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border cursor-pointer shrink-0"
              title="Back to IPD board"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <span className="text-xs font-mono font-semibold text-brand-deep bg-brand-soft border border-brand/20 px-2 py-0.5 rounded">
                {admission.patient.uhid}
              </span>
              <h2 className="text-lg font-semibold text-ink-primary tracking-tight mt-1">{admission.patient.name}</h2>
              <p className="text-xs text-ink-secondary mt-0.5 flex items-center gap-1.5">
                <BedDouble className="w-3.5 h-3.5" />
                {admission.bed?.ward?.name} &bull; Bed {admission.bed?.bedNumber}
                {admission.doctor && <> &bull; Dr. {admission.doctor.name}</>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isActiveAdmission && (
              <StatusBadge
                label={CONDITION_LABEL[admission.currentStatus] || admission.currentStatus}
                variant={conditionVariant(admission.currentStatus)}
              />
            )}
            <StatusBadge label={admission.status} variant={isActiveAdmission ? 'warning' : 'neutral'} />
            {canDischarge && (
              <button
                onClick={() => setShowDischarge(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Discharge Patient</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-surface-page p-3.5 rounded-lg border border-border text-xs">
          <div>
            <span className="text-ink-secondary font-medium block">Admitted</span>
            <span className="text-ink-primary">{new Date(admission.admissionDate).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-ink-secondary font-medium block">Reason for Admission</span>
            <span className="text-ink-primary">{admission.reasonForAdmission}</span>
          </div>
          <div>
            <span className="text-ink-secondary font-medium block">
              {admission.dischargeDate ? 'Discharged' : 'Admitted By'}
            </span>
            <span className="text-ink-primary">
              {admission.dischargeDate
                ? new Date(admission.dischargeDate).toLocaleString()
                : admission.admittedBy?.name || '—'}
            </span>
          </div>
        </div>

        {admission.dischargeSummary && (
          <div className="p-3 bg-surface-page border border-border rounded-lg text-xs">
            <span className="text-ink-secondary font-medium block mb-0.5">Discharge Summary</span>
            <p className="text-ink-primary">{admission.dischargeSummary}</p>
          </div>
        )}
      </div>

      <div className="bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs space-y-4">
        <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === tab.key
                    ? 'border-brand text-brand-deep'
                    : 'border-transparent text-ink-secondary hover:text-ink-primary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'medications' && (
          <MedicationChart admissionId={admission.id} isActiveAdmission={isActiveAdmission} />
        )}
        {activeTab === 'notes' && (
          <ProgressNotesFeed admissionId={admission.id} isActiveAdmission={isActiveAdmission} onStatusChanged={onChanged} />
        )}
        {activeTab === 'history' && (
          <PatientHistoryPanel patient={admission.patient} defaultTab="documents" admissionId={admission.id} />
        )}
      </div>

      {showDischarge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-lg w-full">
            <div className="bg-brand px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5" />
                <div>
                  <h3 className="text-base font-semibold">Discharge Patient</h3>
                  <p className="text-xs text-white/80">{admission.patient.name} will be discharged and the bed freed</p>
                </div>
              </div>
              <button onClick={() => setShowDischarge(false)} className="p-1 rounded hover:bg-white/10 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDischarge} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Discharge Summary <span className="text-status-danger">*</span>
                </label>
                <textarea
                  required
                  value={dischargeSummary}
                  onChange={(e) => setDischargeSummary(e.target.value)}
                  rows={5}
                  placeholder="Condition at discharge, treatment given, follow-up instructions..."
                  className="w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDischarge(false)}
                  className="px-4 py-2 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={discharging}
                  className="px-4 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {discharging ? 'Discharging...' : 'Confirm Discharge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
