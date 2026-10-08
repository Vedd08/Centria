import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PrintablePrescription, PrescriptionData } from './PrintablePrescription';
import { StatusBadge } from '../common/StatusBadge';
import { PatientHistoryPanel } from '../PatientHistory/PatientHistoryPanel';
import { AddCareOrderForm } from './AddCareOrderForm';
import { QueueEntry, QUEUE_STATUS_LABEL, queueStatusVariant, ORDER_TYPE_LABEL, money } from './types';
import {
  ArrowLeft,
  Repeat,
  Stethoscope,
  Check,
  CheckCircle2,
  Package,
  ClipboardList,
  FileText,
  Printer,
  BedDouble,
  X,
} from 'lucide-react';

interface TreatmentOption {
  id: string;
  name: string;
}

interface QueueDetailProps {
  entry: QueueEntry;
  onBack: () => void;
  onChanged: () => void;
}

type Tab = 'orders' | 'history';

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

export const QueueDetail: React.FC<QueueDetailProps> = ({ entry, onBack, onChanged }) => {
  const { apiFetch, hasRole, user } = useAuth();
  const { addToast } = useToast();
  const [tab, setTab] = useState<Tab>('orders');
  const [careType, setCareType] = useState<'OPD' | 'IPD'>((entry.careType as 'OPD' | 'IPD') || 'OPD');
  const [diagnosis, setDiagnosis] = useState(entry.diagnosis || '');
  const [doctorNotes, setDoctorNotes] = useState(entry.doctorNotes || '');
  const [patientNotes, setPatientNotes] = useState(entry.patientNotes || '');
  const [staffNotes, setStaffNotes] = useState(entry.staffNotes || '');
  const [consultationFee, setConsultationFee] = useState(
    entry.consultationFee ? String(entry.consultationFee) : '',
  );
  const [nextAppointmentDate, setNextAppointmentDate] = useState(entry.nextAppointmentDate || '');
  const [templates, setTemplates] = useState<{ id: string; name: string; condition?: string }[]>([]);
  const [applyingTemplate, setApplyingTemplate] = useState('');
  const [prescription, setPrescription] = useState<PrescriptionData | null>(null);
  const [treatmentId, setTreatmentId] = useState('');
  const [treatments, setTreatments] = useState<TreatmentOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [showAdmitRequest, setShowAdmitRequest] = useState(false);
  const [admitReason, setAdmitReason] = useState('');
  const [requestingAdmit, setRequestingAdmit] = useState(false);

  const canAssess = hasRole('DOCTOR');
  const canPerform = hasRole('DOCTOR', 'NURSE', 'STAFF');
  const canDispense = hasRole('PHARMACY');
  const isAssessed = !!entry.careType;

  useEffect(() => {
    if (!canAssess) return;
    (async () => {
      try {
        const res = await apiFetch('/api/treatments');
        const data = await res.json();
        setTreatments(Array.isArray(data) ? data : data.data || []);
      } catch {
        // Non-fatal — the doctor can save without picking a treatment.
      }
    })();
  }, [canAssess, apiFetch]);

  // A doctor's own saved prescriptions for conditions they treat often.
  useEffect(() => {
    if (!canAssess) return;
    (async () => {
      try {
        const res = await apiFetch('/api/prescription-templates');
        if (!res.ok) return;
        const data = await res.json();
        setTemplates(Array.isArray(data) ? data : data.data || []);
      } catch {
        // Non-fatal — the picker just stays empty.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAssess]);

  const applyTemplate = async (templateId: string) => {
    if (!templateId) return;
    setApplyingTemplate(templateId);
    try {
      const res = await apiFetch(`/api/prescription-templates/${templateId}/apply/${entry.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not apply the template');
      if (data.diagnosis && !diagnosis) setDiagnosis(data.diagnosis);
      if (data.patientNotes && !patientNotes) setPatientNotes(data.patientNotes);
      if (data.staffNotes && !staffNotes) setStaffNotes(data.staffNotes);
      addToast('success', 'Template applied — orders added');
      onChanged();
    } catch (err: any) {
      addToast('error', err.message || 'Could not apply the template');
    } finally {
      setApplyingTemplate('');
    }
  };

  const openPrescription = async () => {
    try {
      const res = await apiFetch(`/api/queue/${entry.id}/prescription`);
      if (!res.ok) throw new Error('Could not build the prescription');
      setPrescription(await res.json());
    } catch (err: any) {
      addToast('error', err.message || 'Could not build the prescription');
    }
  };

  const handleAssess = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch(`/api/queue/${entry.id}/assess`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          careType,
          diagnosis: diagnosis.trim() || undefined,
          doctorNotes: doctorNotes.trim() || undefined,
          patientNotes: patientNotes.trim() || undefined,
          staffNotes: staffNotes.trim() || undefined,
          consultationFee: consultationFee ? Number(consultationFee) : undefined,
          nextAppointmentDate: nextAppointmentDate || undefined,
          treatmentId: treatmentId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to save assessment');
      addToast('success', `Patient routed to ${careType} — recorded in the day book`);
      onChanged();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to save assessment');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestAdmission = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestingAdmit(true);
    try {
      const res = await apiFetch(`/api/queue/${entry.id}/request-admission`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: admitReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to recommend admission');
      addToast('success', 'Sent to the ward — a nurse will complete the admission');
      setShowAdmitRequest(false);
      setAdmitReason('');
      onChanged();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to recommend admission');
    } finally {
      setRequestingAdmit(false);
    }
  };

  const performOrder = async (orderId: string) => {
    setBusyOrderId(orderId);
    try {
      const res = await apiFetch(`/api/care-orders/${orderId}/perform`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to mark done');
      addToast('success', 'Marked as done');
      onChanged();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to mark done');
    } finally {
      setBusyOrderId(null);
    }
  };

  const dispenseOrder = async (orderId: string) => {
    setBusyOrderId(orderId);
    try {
      const res = await apiFetch(`/api/care-orders/${orderId}/dispense`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to dispense');
      addToast('success', 'Dispensed — stock updated');
      onChanged();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to dispense');
    } finally {
      setBusyOrderId(null);
    }
  };

  const setStatus = async (status: string) => {
    try {
      const res = await apiFetch(`/api/queue/${entry.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update status');
      addToast('success', `Marked ${QUEUE_STATUS_LABEL[status] || status}`);
      onChanged();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to update status');
    }
  };

  const orders = entry.careOrders || [];
  const pharmacyTotal = orders
    .filter((o) => ['MEDICINE', 'INJECTION'].includes(o.orderType) && o.status !== 'CANCELLED')
    .reduce((s, o) => s + Number(o.totalPrice), 0);

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      <div className="bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border cursor-pointer shrink-0"
              title="Back to queue"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded bg-brand-soft border border-brand/20 text-brand-deep font-mono font-semibold text-xs">
                  {entry.tokenNumber}
                </span>
                {entry.isRegular && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-brand-soft text-brand-deep border border-brand/20">
                    <Repeat className="w-2.5 h-2.5" /> Regular patient
                  </span>
                )}
              </div>
              <h2 className="text-lg font-semibold text-ink-primary tracking-tight mt-1">{entry.patient?.name}</h2>
              <p className="text-xs text-ink-secondary mt-0.5 font-mono">{entry.patient?.phone}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <StatusBadge label={QUEUE_STATUS_LABEL[entry.status] || entry.status} variant={queueStatusVariant(entry.status)} />
            {entry.careType && (
              <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-surface-page border border-border">
                {entry.careType}
              </span>
            )}
            {entry.admissionId ? (
              <StatusBadge label="Admitted to ward" variant="success" />
            ) : (
              entry.admissionRequestedAt && <StatusBadge label="Admission requested — awaiting nurse" variant="warning" />
            )}
            {isAssessed && (
              <button
                onClick={openPrescription}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded-md cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Prescription
              </button>
            )}
            {canAssess && isAssessed && !entry.admissionId && !entry.admissionRequestedAt && entry.status !== 'CANCELLED' && (
              <button
                onClick={() => setShowAdmitRequest(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-status-warning hover:opacity-90 rounded-md shadow-xs cursor-pointer"
              >
                <BedDouble className="w-3.5 h-3.5" /> Recommend for Admission
              </button>
            )}
            {entry.status !== 'COMPLETED' && entry.status !== 'CANCELLED' && (
              <button
                onClick={() => setStatus('COMPLETED')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Complete Visit
              </button>
            )}
          </div>
        </div>

        {entry.complaint && (
          <div className="bg-surface-page p-3 rounded-lg border border-border text-xs">
            <span className="text-ink-secondary font-medium block mb-0.5">Reason for visit (from reception)</span>
            <p className="text-ink-primary">{entry.complaint}</p>
          </div>
        )}

        {isAssessed && (entry.diagnosis || entry.doctorNotes || entry.patientNotes || entry.staffNotes) && (
          <div className="bg-surface-page p-3 rounded-lg border border-border text-xs space-y-1">
            {entry.diagnosis && (
              <p>
                <span className="text-ink-secondary font-medium">Diagnosis: </span>
                <span className="text-ink-primary">{entry.diagnosis}</span>
              </p>
            )}
            {entry.patientNotes && (
              <div>
                <span className="text-ink-secondary font-medium">Advice for patient: </span>
                <span className="text-ink-primary">{entry.patientNotes}</span>
              </div>
            )}
            {/* Internal only — the printed prescription never carries this. */}
            {entry.staffNotes && (
              <div className="p-2 rounded bg-status-warning/10 border border-status-warning/20">
                <span className="text-status-warning font-semibold">For nurse / staff only: </span>
                <span className="text-ink-primary">{entry.staffNotes}</span>
              </div>
            )}
            {entry.nextAppointmentDate && (
              <div>
                <span className="text-ink-secondary font-medium">Next appointment: </span>
                <span className="font-mono text-ink-primary">{entry.nextAppointmentDate}</span>
              </div>
            )}
            {!!entry.consultationFee && Number(entry.consultationFee) > 0 && (
              <div>
                <span className="text-ink-secondary font-medium">Consultation fee: </span>
                <span className="font-mono text-ink-primary">{money(entry.consultationFee)}</span>
              </div>
            )}
            {entry.doctorNotes && (
              <p>
                <span className="text-ink-secondary font-medium">Doctor's notes: </span>
                <span className="text-ink-primary">{entry.doctorNotes}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Doctor's assessment — decides OPD vs IPD and writes the day-book entry */}
      {canAssess && entry.status !== 'CANCELLED' && (
        <form onSubmit={handleAssess} className="bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs space-y-4">
          <h3 className="text-sm font-semibold text-ink-primary flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-brand" />
            {isAssessed ? 'Update Assessment' : 'Doctor Assessment'}
          </h3>

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
              <select value={treatmentId} onChange={(e) => setTreatmentId(e.target.value)} className={inputClass}>
                <option value="">Consultation only</option>
                {treatments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {templates.length > 0 && (
            <div className="p-3 rounded-lg bg-brand-soft/50 border border-brand/20">
              <label className="block text-xs font-semibold text-brand-deep mb-1">
                Apply one of your templates
              </label>
              <select
                value=""
                disabled={!!applyingTemplate}
                onChange={(e) => applyTemplate(e.target.value)}
                className={inputClass}
              >
                <option value="">
                  {applyingTemplate ? 'Applying…' : 'Choose a saved prescription…'}
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.condition ? ` — ${t.condition}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-ink-secondary/70 mt-1">
                Fills the diagnosis and advice, and raises the template's orders.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Diagnosis / what happened</label>
            <textarea
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              rows={2}
              placeholder="Clinical findings"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Clinical notes (record)</label>
            <textarea
              value={doctorNotes}
              onChange={(e) => setDoctorNotes(e.target.value)}
              rows={2}
              placeholder="Assessment recorded against the visit"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Advice for patient <span className="text-[10px] font-normal text-ink-secondary/70">(printed on prescription)</span>
              </label>
              <textarea
                value={patientNotes}
                onChange={(e) => setPatientNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Avoid sun for 48 hours. Apply sunscreen every 3 hours."
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Notes for nurse / staff <span className="text-[10px] font-normal text-status-warning">(internal — never printed)</span>
              </label>
              <textarea
                value={staffNotes}
                onChange={(e) => setStaffNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Patch test before first sitting. Watch for erythema."
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Consultation fee (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={consultationFee}
                onChange={(e) => setConsultationFee(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
              <p className="text-[10px] text-ink-secondary/70 mt-1">Added to the patient's bill at reception.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Next appointment</label>
              <input
                type="date"
                value={nextAppointmentDate}
                onChange={(e) => setNextAppointmentDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : isAssessed ? 'Update Assessment' : `Save & Route to ${careType}`}
            </button>
          </div>
        </form>
      )}

      <div className="bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs space-y-4">
        <div className="flex items-center gap-1 border-b border-border">
          {[
            { key: 'orders' as Tab, label: 'Care Orders', icon: ClipboardList },
            { key: 'history' as Tab, label: 'Patient History', icon: FileText },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 cursor-pointer transition-colors ${
                  tab === t.key ? 'border-brand text-brand-deep' : 'border-transparent text-ink-secondary hover:text-ink-primary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'orders' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-ink-secondary">
                Treatments, drugs and injections the doctor ordered. Staff mark them done; pharmacy dispenses stock items.
              </p>
              {canAssess && isAssessed && <AddCareOrderForm queueId={entry.id} onOrderAdded={onChanged} />}
            </div>

            {canAssess && !isAssessed && (
              <div className="text-xs text-ink-secondary py-6 text-center bg-surface-page rounded-lg border border-border">
                Save the assessment above before adding orders.
              </div>
            )}

            {orders.length === 0 ? (
              isAssessed && (
                <div className="text-ink-secondary text-xs py-8 text-center bg-surface-page rounded-lg border border-border">
                  No orders yet for this patient.
                </div>
              )
            ) : (
              <>
                <div className="space-y-2">
                  {orders.map((o) => {
                    const isStock = ['MEDICINE', 'INJECTION'].includes(o.orderType);
                    return (
                      <div key={o.id} className="bg-surface-page p-3 rounded-lg border border-border space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-ink-primary">{o.description}</span>
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-card border border-border text-ink-secondary">
                                {ORDER_TYPE_LABEL[o.orderType] || o.orderType}
                              </span>
                            </div>
                            <p className="text-[11px] text-ink-secondary mt-0.5">
                              Qty {o.quantity}
                              {o.dosage && ` · ${o.dosage}`}
                              {o.route && ` · ${o.route}`}
                              {o.frequency && ` · ${o.frequency}`}
                              {Number(o.totalPrice) > 0 && ` · ${money(o.totalPrice)}`}
                            </p>
                            {o.instructions && (
                              <p className="text-[11px] text-ink-secondary/80 italic mt-0.5">{o.instructions}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <StatusBadge
                              label={o.status === 'DONE' ? 'Done' : o.status === 'CANCELLED' ? 'Cancelled' : 'Ordered'}
                              variant={o.status === 'DONE' ? 'success' : o.status === 'CANCELLED' ? 'danger' : 'warning'}
                            />
                            {isStock && (
                              <span
                                className={`text-[10px] font-medium ${o.dispensedAt ? 'text-status-success' : 'text-status-warning'}`}
                              >
                                {o.dispensedAt ? 'Dispensed' : 'Not dispensed'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {canPerform && o.status === 'ORDERED' && (
                            <button
                              onClick={() => performOrder(o.id)}
                              disabled={busyOrderId === o.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-status-success bg-status-success/10 hover:bg-status-success/20 border border-status-success/20 rounded cursor-pointer disabled:opacity-50"
                            >
                              <Check className="w-3 h-3" /> Mark Done
                            </button>
                          )}
                          {canDispense && isStock && !o.dispensedAt && o.status !== 'CANCELLED' && (
                            <button
                              onClick={() => dispenseOrder(o.id)}
                              disabled={busyOrderId === o.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-brand-deep bg-brand-soft hover:bg-brand-soft/70 border border-brand/20 rounded cursor-pointer disabled:opacity-50"
                            >
                              <Package className="w-3 h-3" /> Dispense
                            </button>
                          )}
                          {o.performedBy && (
                            <span className="text-[10px] text-ink-secondary/70 ml-auto">
                              Done by {o.performedBy.name}
                              {o.performedAt && ` · ${new Date(o.performedAt).toLocaleTimeString()}`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {pharmacyTotal > 0 && (
                  <div className="flex items-center justify-between bg-brand-soft/60 border border-brand/20 rounded-lg p-3">
                    <span className="text-xs font-medium text-ink-primary flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-brand-deep" /> Pharmacy total for this patient
                    </span>
                    <span className="text-sm font-semibold text-brand-deep">{money(pharmacyTotal)}</span>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <PatientHistoryPanel patient={entry.patient} />
        )}
      </div>

      <PrintablePrescription prescription={prescription} onClose={() => setPrescription(null)} />

      {showAdmitRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-lg w-full">
            <div className="bg-brand px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BedDouble className="w-5 h-5" />
                <div>
                  <h3 className="text-base font-semibold">Recommend for Admission</h3>
                  <p className="text-xs text-white/80">{entry.patient?.name} will be sent to the ward for a nurse to admit</p>
                </div>
              </div>
              <button onClick={() => setShowAdmitRequest(false)} className="p-1 rounded hover:bg-white/10 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRequestAdmission} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Reason for Admission <span className="text-status-danger">*</span>
                </label>
                <textarea
                  required
                  value={admitReason}
                  onChange={(e) => setAdmitReason(e.target.value)}
                  rows={4}
                  placeholder="Clinical reason this patient needs inpatient care..."
                  className="w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
                />
                <p className="text-[10px] text-ink-secondary/70 mt-1">
                  This appears on the nurse's ward dashboard, where they'll pick a bed and complete the admission.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdmitRequest(false)}
                  className="px-4 py-2 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestingAdmit}
                  className="px-4 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {requestingAdmit ? 'Sending...' : 'Send to Ward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
