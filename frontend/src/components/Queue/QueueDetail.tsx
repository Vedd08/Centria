import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PrintablePrescription, PrescriptionData } from './PrintablePrescription';
import { StatusBadge } from '../common/StatusBadge';
import { PatientHistoryPanel } from '../PatientHistory/PatientHistoryPanel';
import { AddCareOrderForm } from './AddCareOrderForm';
import { AssignDoctorModal } from './AssignDoctorModal';
import { PrescriptionTemplates } from '../Templates/PrescriptionTemplates';
import { BulletListEditor } from '../common/BulletListEditor';
import { ConfirmDialog } from '../common/ConfirmDialog';
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
  Settings,
  Tag,
  Syringe,
  AlignLeft,
  Banknote,
  ArrowUp,
  ArrowDown,
  ArrowRight,
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
  const [diagnosis, setDiagnosis] = useState(entry.diagnosis || (entry.visitId ? '' : entry.complaint) || '');
  const [conditionTrend, setConditionTrend] = useState<string>(entry.visit?.conditionTrend || '');
  const [diagnosisTouched, setDiagnosisTouched] = useState(false);
  const [doctorNotes, setDoctorNotes] = useState(entry.doctorNotes || '');
  const [patientNotes, setPatientNotes] = useState(entry.patientNotes || '');
  const [staffNotes, setStaffNotes] = useState(entry.staffNotes || '');
  const [consultationFee, setConsultationFee] = useState(
    entry.consultationFee ? String(entry.consultationFee) : '',
  );
  const [nextAppointmentDate, setNextAppointmentDate] = useState(entry.nextAppointmentDate || '');
  const [templates, setTemplates] = useState<{ id: string; name: string; condition?: string; diagnosis?: string; patientNotes?: string; staffNotes?: string; }[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [applyingTemplate, setApplyingTemplate] = useState('');
  const [prescription, setPrescription] = useState<PrescriptionData | null>(null);
  const [treatmentId, setTreatmentId] = useState(entry.visit?.treatmentId ?? '');
  const [treatments, setTreatments] = useState<TreatmentOption[]>([]);
  
  const [patientPurchases, setPatientPurchases] = useState<any[]>([]);
  const [usePackagePurchaseId, setUsePackagePurchaseId] = useState(entry.visit?.packagePurchaseId || '');
  
  const [packageTypes, setPackageTypes] = useState<any[]>([]);
  const [recommendedPackageTypeId, setRecommendedPackageTypeId] = useState(entry.recommendedPackageTypeId || '');
  
  const [saving, setSaving] = useState(false);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [showAdmitRequest, setShowAdmitRequest] = useState(false);
  const [admitReason, setAdmitReason] = useState('');
  const [requestingAdmit, setRequestingAdmit] = useState(false);
  const [showAssignDoctor, setShowAssignDoctor] = useState(false);
  const [showManageTemplates, setShowManageTemplates] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [appliedTemplates, setAppliedTemplates] = useState<{
    id: string;
    templateId: string;
    templateName: string;
    addedDiagnosis: string;
    addedPatientNotes: string;
    addedStaffNotes: string;
    addedOrderIds: string[];
  }[]>([]);

  const allAppliedTemplateNames = new Set<string>();
  (entry.careOrders || []).forEach(o => {
    if (o.sourceTemplates) {
      o.sourceTemplates.split(' | ').forEach(t => allAppliedTemplateNames.add(t));
    }
  });
  appliedTemplates.forEach(t => allAppliedTemplateNames.add(t.templateName));
  const activeTemplateNames = Array.from(allAppliedTemplateNames);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string, action: 'delete' | 'cancel' | 'untag', title: string, message: string, templateName?: string } | null>(null);

  const [showConfig, setShowConfig] = useState(false);
  const [showDetails, setShowDetails] = useState(() => {
    const saved = localStorage.getItem('careOrderDisplayConfig');
    return saved ? JSON.parse(saved) : {
      showTags: true,
      showDosage: true,
      showInstructions: true,
      showPrice: true,
    };
  });

  const toggleDetail = (key: string) => {
    setShowDetails((prev: any) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('careOrderDisplayConfig', JSON.stringify(next));
      return next;
    });
  };

  const canAssess = hasRole('DOCTOR');
  const canPerform = hasRole('DOCTOR', 'NURSE', 'STAFF');
  const canDispense = hasRole('PHARMACY');
  const isAssessed = !!entry.visitId;

  useEffect(() => {
    if (!canAssess) return;
    (async () => {
      try {
        const res = await apiFetch('/api/treatments');
        const data = await res.json();
        setTreatments(Array.isArray(data) ? data : data.data || []);

        const purRes = await apiFetch(`/api/packages/purchases?patientId=${entry.patientId}`);
        const purData = await purRes.json();
        setPatientPurchases(Array.isArray(purData) ? purData : purData.data || []);
        
        const ptRes = await apiFetch('/api/packages/types');
        const ptData = await ptRes.json();
        setPackageTypes(Array.isArray(ptData) ? ptData : ptData.data || []);
      } catch {
        // Non-fatal — the doctor can save without picking a treatment.
      }
    })();
  }, [canAssess, apiFetch, entry.patientId]);

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
      const template = templates.find((t) => t.id === templateId);
      if (!template) return;

      const existingOrderIds = new Set((entry.careOrders || []).map((o) => o.id));

      const res = await apiFetch(`/api/prescription-templates/${templateId}/apply/${entry.id}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not apply the template');

      const updatedQueue = data.queue;
      const notStocked = data.notStocked || [];

      const newOrders = (updatedQueue.careOrders || []).filter((o: any) => !existingOrderIds.has(o.id));
      const applyId = Date.now().toString();

      if (notStocked.length > 0) {
        addToast('warning', `${notStocked.length} medicine(s) aren't stocked in your pharmacy — added as prescription only (buy outside)`);
      }
      
      setAppliedTemplates((prev) => [
        ...prev,
        {
          id: applyId,
          templateId,
          templateName: template.name,
          addedDiagnosis: template.diagnosis || '',
          addedPatientNotes: template.patientNotes || '',
          addedStaffNotes: template.staffNotes || '',
          addedOrderIds: newOrders.map((o: any) => o.id),
        },
      ]);

      const dx = template.diagnosis;
      if (dx) setDiagnosis((prev) => (prev ? `${prev}\n${dx}` : dx));
      const px = template.patientNotes;
      if (px) setPatientNotes((prev) => (prev ? `${prev}\n${px}` : px));
      const sx = template.staffNotes;
      if (sx) setStaffNotes((prev) => (prev ? `${prev}\n${sx}` : sx));
      
      addToast('success', 'Template applied — orders added');
      onChanged();
    } catch (err: any) {
      addToast('error', err.message || 'Could not apply the template');
    } finally {
      setApplyingTemplate('');
    }
  };

  const removeAppliedTemplate = async (templateName: string) => {
    const template = templates.find((t) => t.name === templateName);
    if (!template) {
      addToast('error', 'Cannot remove an unknown template');
      return;
    }
    setApplyingTemplate(template.id);
    try {
      const revertText = (existing: string, toRemove?: string) => {
        if (!existing || !toRemove) return existing;
        const removeLines = new Set(toRemove.split('\n').map(l => l.trim()).filter(Boolean));
        return existing.split('\n')
          .map(l => l.trim())
          .filter(l => !removeLines.has(l))
          .join('\n');
      };

      const newDiagnosis = revertText(diagnosis, template.diagnosis);
      const newPatientNotes = revertText(patientNotes, template.patientNotes);
      const newStaffNotes = revertText(staffNotes, template.staffNotes);

      setDiagnosis(newDiagnosis);
      setPatientNotes(newPatientNotes);
      setStaffNotes(newStaffNotes);

      await apiFetch(`/api/prescription-templates/${template.id}/applied/${entry.id}`, { method: 'DELETE' });

      await apiFetch(`/api/queue/${entry.id}/assess`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          careType: entry.careType || 'OPD',
          diagnosis: newDiagnosis || undefined,
          patientNotes: newPatientNotes || undefined,
          staffNotes: newStaffNotes || undefined,
        }),
      });

      setAppliedTemplates(prev => prev.filter(a => a.templateName !== templateName));
      addToast('success', `Removed template: ${templateName}`);
      onChanged();
    } catch (err: any) {
      addToast('error', 'Could not fully remove template');
    } finally {
      setApplyingTemplate('');
    }
  };

  const handleSaveAsTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) return;
    setSavingTemplate(true);
    try {
      const payloadItems = (entry.careOrders || []).map((o) => ({
        orderType: o.orderType,
        medicineId: ['MEDICINE', 'INJECTION'].includes(o.orderType) ? o.medicineId : undefined,
        treatmentId: o.orderType === 'TREATMENT' ? o.treatmentId : undefined,
        description: o.description,
        dosage: o.dosage,
        route: o.route,
        frequency: o.frequency,
        instructions: o.instructions,
        quantity: o.quantity || 1,
      }));

      const body = {
        name: newTemplateName.trim(),
        diagnosis: diagnosis.trim() || undefined,
        patientNotes: patientNotes.trim() || undefined,
        staffNotes: staffNotes.trim() || undefined,
        items: payloadItems,
      };

      const res = await apiFetch('/api/prescription-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Could not save template');
      addToast('success', 'Saved as new template');
      setShowSaveTemplate(false);
      setNewTemplateName('');
      // Reload templates
      const tRes = await apiFetch('/api/prescription-templates');
      const tData = await tRes.json();
      setTemplates(Array.isArray(tData) ? tData : tData.data || []);
    } catch (err: any) {
      addToast('error', err.message || 'Could not save template');
    } finally {
      setSavingTemplate(false);
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
          conditionTrend: conditionTrend || undefined,
          doctorNotes: doctorNotes.trim() || undefined,
          patientNotes: patientNotes.trim() || undefined,
          staffNotes: staffNotes.trim() || undefined,
          consultationFee: consultationFee ? Number(consultationFee) : undefined,
          nextAppointmentDate: nextAppointmentDate || undefined,
          treatmentId: treatmentId || undefined,
          usePackagePurchaseId: usePackagePurchaseId || undefined,
          recommendedPackageTypeId: recommendedPackageTypeId || null,
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

  const deleteCareOrder = async (orderId: string) => {
    const o = entry.careOrders.find(x => x.id === orderId);
    if (!o) return;
    
    setBusyOrderId(orderId);
    try {
      const res = await apiFetch(`/api/care-orders/${orderId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete');
      addToast('success', 'Order deleted');
      onChanged();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to delete');
    } finally {
      setBusyOrderId(null);
    }
  };

  const cancelOrder = async (orderId: string) => {
    setBusyOrderId(orderId);
    try {
      const res = await apiFetch(`/api/care-orders/${orderId}/cancel`, { method: 'PATCH' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to cancel');
      addToast('success', 'Order cancelled');
      onChanged();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to cancel');
    } finally {
      setBusyOrderId(null);
    }
  };

  const untagOrder = async (orderId: string, templateName: string) => {
    setBusyOrderId(orderId);
    try {
      const res = await apiFetch(`/api/care-orders/${orderId}/untag`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to untag order');
      addToast('success', `Removed from ${templateName}`);
      onChanged();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to untag order');
    } finally {
      setBusyOrderId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { id, action, templateName } = deleteTarget;
    setDeleteTarget(null);
    
    if (action === 'delete') await deleteCareOrder(id);
    else if (action === 'cancel') await cancelOrder(id);
    else if (action === 'untag' && templateName) await untagOrder(id, templateName);
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

  const groupedOrders = React.useMemo(() => {
    const acc: Record<string, typeof orders> = {
      'Manually Added': [],
    };
    
    activeTemplateNames.forEach(t => { acc[t] = []; });

    orders.forEach(o => {
      if (!o.sourceTemplates) {
        acc['Manually Added'].push(o);
      } else {
        const templates = o.sourceTemplates.split(' | ');
        templates.forEach(t => {
          if (!acc[t]) acc[t] = [];
          acc[t].push(o);
        });
      }
    });
    return acc;
  }, [orders, activeTemplateNames]);

  const sortedGroupNames = Object.keys(groupedOrders).filter(k => k !== 'Manually Added' && groupedOrders[k].length > 0).sort((a, b) => {
    const minA = Math.min(...groupedOrders[a].map(o => o.createdAt ? new Date(o.createdAt).getTime() : 0));
    const minB = Math.min(...groupedOrders[b].map(o => o.createdAt ? new Date(o.createdAt).getTime() : 0));
    return minA - minB;
  });
  if (groupedOrders['Manually Added'].length > 0) {
    sortedGroupNames.push('Manually Added');
  }

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
              <div className="flex items-center gap-2 mt-1">
                <p className="text-[11px] text-ink-secondary">
                  Doctor: <span className="font-medium text-ink-primary">{entry.doctor?.name || 'Unassigned'}</span>
                </p>
                <button
                  onClick={() => setShowAssignDoctor(true)}
                  className="text-[10px] text-brand hover:underline cursor-pointer"
                >
                  {entry.doctor ? 'Change' : 'Assign'}
                </button>
              </div>
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

        {isAssessed && (entry.diagnosis || entry.visit?.treatmentName || entry.doctorNotes || entry.patientNotes || entry.staffNotes || (entry.careOrders && entry.careOrders.filter(o => o.status !== 'CANCELLED').length > 0) || entry.nextAppointmentDate) && (
          <div className="bg-surface-page p-3 rounded-lg border border-border text-xs space-y-1">
            {entry.diagnosis && (
              <p>
                <span className="text-ink-secondary font-medium">Diagnosis: </span>
                <span className="text-ink-primary">{entry.diagnosis}</span>
              </p>
            )}
            
            {(entry.visit?.treatmentName || entry.patientNotes || entry.nextAppointmentDate || (entry.careOrders && entry.careOrders.filter(o => o.status !== 'CANCELLED').length > 0)) && (
              <div className="pt-1">
                <span className="text-ink-secondary font-medium block mb-1">What to do:</span>
                <ul className="space-y-1">
                  {entry.visit?.treatmentName && (
                    <li className="flex gap-2">
                      <span className="text-ink-secondary">•</span>
                      <span className="text-ink-primary">{entry.visit.treatmentName}</span>
                    </li>
                  )}
                  {(entry.careOrders || []).filter(o => o.status !== 'CANCELLED').map(o => (
                    <li key={o.id} className="flex gap-2">
                      <span className="text-ink-secondary">•</span>
                      <span className="text-ink-primary">
                        {[o.description, o.dosage, o.frequency, o.quantity ? `x${o.quantity}` : null].filter(Boolean).join(' · ')}
                      </span>
                    </li>
                  ))}
                  {entry.patientNotes && entry.patientNotes.split('\n').map(l => l.trim()).filter(Boolean).map((line, i) => (
                    <li key={`pn-${i}`} className="flex gap-2">
                      <span className="text-ink-secondary">•</span>
                      <span className="text-ink-primary">{line}</span>
                    </li>
                  ))}
                  {entry.nextAppointmentDate && (
                    <li className="flex gap-2">
                      <span className="text-ink-secondary">•</span>
                      <span className="text-ink-primary">Come back on {entry.nextAppointmentDate}</span>
                    </li>
                  )}
                </ul>
              </div>
            )}
            
            {/* Internal only — the printed prescription never carries this. */}
            {entry.staffNotes && (
              <div className="p-2 mt-2 rounded bg-status-warning/10 border border-status-warning/20">
                <span className="text-status-warning font-semibold">For nurse / staff only: </span>
                <span className="text-ink-primary">{entry.staffNotes}</span>
              </div>
            )}
            {!!entry.consultationFee && Number(entry.consultationFee) > 0 && (
              <div className="pt-1">
                <span className="text-ink-secondary font-medium">Consultation fee: </span>
                <span className="font-mono text-ink-primary">{money(entry.consultationFee)}</span>
              </div>
            )}
            {entry.doctorNotes && (
              <p className="pt-1">
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

          <div className="p-3 rounded-lg bg-brand-soft/50 border border-brand/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3 flex-1">
                <label className="block text-xs font-semibold text-brand-deep shrink-0">
                  Prescription Templates
                </label>
                {templates.length > 5 && (
                  <input
                    type="text"
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Search templates..."
                    className="flex-1 max-w-[200px] px-2 py-1 rounded border border-brand/20 text-[11px] bg-white text-brand-deep focus:outline-none focus:border-brand/40 placeholder:text-brand/40"
                  />
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowSaveTemplate(true)}
                  className="text-[10px] font-medium text-brand hover:underline cursor-pointer"
                >
                  Save Current as Template
                </button>
                <button
                  type="button"
                  onClick={() => setShowManageTemplates(true)}
                  className="text-[10px] font-medium text-brand hover:underline cursor-pointer"
                >
                  Manage
                </button>
              </div>
            </div>
            
            {templates.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {[...templates]
                    .filter(t => t.name.toLowerCase().includes(templateSearch.toLowerCase()) || (t.condition && t.condition.toLowerCase().includes(templateSearch.toLowerCase())))
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      disabled={!!applyingTemplate}
                      onClick={() => applyTemplate(t.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-brand/20 hover:border-brand/40 text-brand-deep text-[11px] font-medium rounded-md shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                      title={t.condition ? `For ${t.condition}` : ''}
                    >
                      {applyingTemplate === t.id ? 'Applying...' : t.name}
                    </button>
                  ))}
                  {templateSearch && templates.filter(t => t.name.toLowerCase().includes(templateSearch.toLowerCase()) || (t.condition && t.condition.toLowerCase().includes(templateSearch.toLowerCase()))).length === 0 && (
                    <p className="text-[11px] text-ink-secondary italic py-1">No templates found matching "{templateSearch}"</p>
                  )}
                </div>
                {activeTemplateNames.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[10px] font-medium text-ink-secondary">Currently applied:</p>
                    <div className="flex flex-wrap gap-2">
                      {activeTemplateNames.map(templateName => (
                        <div key={templateName} className="inline-flex items-center gap-1 bg-status-warning/10 border border-status-warning/20 text-status-warning pl-2 pr-1 py-1 rounded-md">
                          <span className="text-[10px] font-medium">{templateName}</span>
                          <button
                            type="button"
                            disabled={!!applyingTemplate}
                            onClick={() => removeAppliedTemplate(templateName)}
                            className="p-0.5 rounded hover:bg-status-warning/20 cursor-pointer disabled:opacity-50"
                            title="Remove template text and orders"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-ink-secondary/70">
                You haven't saved any templates yet. Fill out the assessment below and click "Save Current as Template".
              </p>
            )}
            <p className="text-[10px] text-ink-secondary/70 mt-2">
              Clicking a template appends its diagnosis, advice, and orders to the current patient.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-ink-secondary">Diagnosis / what happened</label>
              {(entry.patient?._count?.visits ?? 0) - (entry.visitId ? 1 : 0) === 0 ? (
                <span className="text-[10px] font-medium text-ink-secondary/70 bg-surface-page px-2 py-0.5 rounded border border-border">
                  Baseline
                </span>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setConditionTrend(conditionTrend === 'IMPROVING' ? '' : 'IMPROVING')}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                      conditionTrend === 'IMPROVING'
                        ? 'bg-status-success text-white'
                        : 'bg-surface-page text-ink-secondary hover:bg-surface-hover border border-border'
                    }`}
                  >
                    <ArrowUp className="w-3 h-3" /> Better
                  </button>
                  <button
                    type="button"
                    onClick={() => setConditionTrend(conditionTrend === 'SAME' ? '' : 'SAME')}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                      conditionTrend === 'SAME'
                        ? 'bg-ink-secondary text-white'
                        : 'bg-surface-page text-ink-secondary hover:bg-surface-hover border border-border'
                    }`}
                  >
                    <ArrowRight className="w-3 h-3" /> Same
                  </button>
                  <button
                    type="button"
                    onClick={() => setConditionTrend(conditionTrend === 'WORSENING' ? '' : 'WORSENING')}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                      conditionTrend === 'WORSENING'
                        ? 'bg-status-danger text-white'
                        : 'bg-surface-page text-ink-secondary hover:bg-surface-hover border border-border'
                    }`}
                  >
                    <ArrowDown className="w-3 h-3" /> Worse
                  </button>
                </div>
              )}
            </div>
            <textarea
              value={diagnosis}
              onChange={(e) => {
                setDiagnosis(e.target.value);
                setDiagnosisTouched(true);
              }}
              rows={2}
              placeholder="Clinical findings"
              className={inputClass}
            />
            {!diagnosisTouched && diagnosis && diagnosis === entry.complaint && !entry.visitId && (
              <p className="text-[10px] text-ink-secondary mt-1">Prefilled from reception — edit before saving</p>
            )}
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
              <BulletListEditor
                value={patientNotes}
                onChange={setPatientNotes}
                placeholder="Avoid sun for 48 hours..."
                containerClass="w-full p-2 rounded-md border border-surface text-sm bg-surface-hover text-ink shadow-sm transition-shadow hover:shadow-md flex flex-col gap-2"
                buttonClass="self-start text-[11px] font-bold text-ink-secondary hover:text-ink bg-surface-hover hover:bg-surface-active px-2 py-1 rounded transition-colors mt-1 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Notes for nurse / staff <span className="text-[10px] font-normal text-status-warning">(internal — never printed)</span>
              </label>
              <BulletListEditor
                value={staffNotes}
                onChange={setStaffNotes}
                placeholder="Patch test before first sitting..."
                containerClass="w-full p-2 rounded-md border border-surface text-sm bg-surface-hover text-ink shadow-sm transition-shadow hover:shadow-md flex flex-col gap-2"
                buttonClass="self-start text-[11px] font-bold text-status-warning hover:text-status-warning bg-status-warning-bg px-2 py-1 rounded transition-colors mt-1 cursor-pointer"
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
              <div className="flex items-center gap-2 relative">
                <button
                  type="button"
                  onClick={() => setShowConfig(!showConfig)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded shadow-xs transition-colors cursor-pointer ${
                    showConfig ? 'bg-brand/10 text-brand border border-brand/20' : 'text-ink-secondary bg-surface-card border border-border hover:bg-surface-page'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" /> Configure View
                </button>
                {showConfig && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowConfig(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 p-1.5 bg-surface-card border border-border rounded-xl shadow-xl z-20 flex flex-col gap-0.5 origin-top-right animate-in fade-in zoom-in-95 duration-200">
                      <div className="px-3 py-2 text-[10px] font-bold text-ink-secondary uppercase tracking-wider mb-1">
                        Display Settings
                      </div>
                      
                      <button type="button" onClick={() => toggleDetail('showTags')} className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg hover:bg-surface-page transition-colors group cursor-pointer text-left">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-md transition-colors ${showDetails.showTags ? 'bg-brand/10 text-brand' : 'bg-surface-page text-ink-secondary group-hover:text-ink-primary'}`}>
                            <Tag className="w-3.5 h-3.5" />
                          </div>
                          <span className={`text-[11px] font-medium transition-colors ${showDetails.showTags ? 'text-ink-primary' : 'text-ink-secondary'}`}>Template Tags</span>
                        </div>
                        <div className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${showDetails.showTags ? 'bg-brand' : 'bg-border'}`}>
                          <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${showDetails.showTags ? 'translate-x-3' : 'translate-x-0.5'}`} />
                        </div>
                      </button>

                      <button type="button" onClick={() => toggleDetail('showDosage')} className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg hover:bg-surface-page transition-colors group cursor-pointer text-left">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-md transition-colors ${showDetails.showDosage ? 'bg-brand/10 text-brand' : 'bg-surface-page text-ink-secondary group-hover:text-ink-primary'}`}>
                            <Syringe className="w-3.5 h-3.5" />
                          </div>
                          <span className={`text-[11px] font-medium transition-colors ${showDetails.showDosage ? 'text-ink-primary' : 'text-ink-secondary'}`}>Dosage & Freq</span>
                        </div>
                        <div className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${showDetails.showDosage ? 'bg-brand' : 'bg-border'}`}>
                          <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${showDetails.showDosage ? 'translate-x-3' : 'translate-x-0.5'}`} />
                        </div>
                      </button>

                      <button type="button" onClick={() => toggleDetail('showInstructions')} className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg hover:bg-surface-page transition-colors group cursor-pointer text-left">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-md transition-colors ${showDetails.showInstructions ? 'bg-brand/10 text-brand' : 'bg-surface-page text-ink-secondary group-hover:text-ink-primary'}`}>
                            <AlignLeft className="w-3.5 h-3.5" />
                          </div>
                          <span className={`text-[11px] font-medium transition-colors ${showDetails.showInstructions ? 'text-ink-primary' : 'text-ink-secondary'}`}>Instructions</span>
                        </div>
                        <div className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${showDetails.showInstructions ? 'bg-brand' : 'bg-border'}`}>
                          <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${showDetails.showInstructions ? 'translate-x-3' : 'translate-x-0.5'}`} />
                        </div>
                      </button>

                      <button type="button" onClick={() => toggleDetail('showPrice')} className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg hover:bg-surface-page transition-colors group cursor-pointer text-left">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-md transition-colors ${showDetails.showPrice ? 'bg-brand/10 text-brand' : 'bg-surface-page text-ink-secondary group-hover:text-ink-primary'}`}>
                            <Banknote className="w-3.5 h-3.5" />
                          </div>
                          <span className={`text-[11px] font-medium transition-colors ${showDetails.showPrice ? 'text-ink-primary' : 'text-ink-secondary'}`}>Prices</span>
                        </div>
                        <div className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${showDetails.showPrice ? 'bg-brand' : 'bg-border'}`}>
                          <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${showDetails.showPrice ? 'translate-x-3' : 'translate-x-0.5'}`} />
                        </div>
                      </button>
                    </div>
                  </>
                )}
                {canAssess && isAssessed && <AddCareOrderForm queueId={entry.id} onOrderAdded={onChanged} />}
              </div>
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
                <div className="space-y-5">
                  {sortedGroupNames.map(groupName => {
                    const groupOrders = groupedOrders[groupName];
                    return (
                    <div key={groupName} className="bg-surface-page border border-border rounded-xl shadow-xs overflow-hidden">
                      <div className="bg-surface-card border-b border-border px-4 py-2.5 flex items-center gap-2">
                        {groupName === 'Manually Added' ? (
                           <span className="text-[11px] font-bold text-ink-primary uppercase tracking-wide">Manually Added</span>
                        ) : (
                           <span className="text-[11px] font-bold text-brand-deep uppercase tracking-wide">Template: {groupName}</span>
                        )}
                        <span className="text-[10px] font-bold bg-border/50 text-ink-secondary px-1.5 py-0.5 rounded-full">{groupOrders.length}</span>
                      </div>
                      <div className="p-3 space-y-2">
                        {groupOrders.map((o) => {
                          const isStock = ['MEDICINE', 'INJECTION'].includes(o.orderType);
                          const isShared = o.sourceTemplates && o.sourceTemplates.split(' | ').length > 1;
                          const otherTemplates = o.sourceTemplates?.split(' | ').filter(t => t !== groupName);
                          const canDelete = o.status === 'ORDERED' && !o.dispensedAt && !o.performedAt;
                          
                          const handleRemoveClick = () => {
                            if (isShared && groupName !== 'Manually Added') {
                              setDeleteTarget({
                                id: o.id,
                                action: 'untag',
                                templateName: groupName,
                                title: 'Remove from Template',
                                message: `Remove this order from "${groupName}"? It will still remain under "${otherTemplates?.join('", "')}".`
                              });
                            } else if (canDelete) {
                              setDeleteTarget({
                                id: o.id,
                                action: 'delete',
                                title: 'Delete Care Order',
                                message: `Permanently delete "${o.description}"?`
                              });
                            } else {
                              setDeleteTarget({
                                id: o.id,
                                action: 'cancel',
                                title: 'Cancel Care Order',
                                message: `This order is already processed. Mark "${o.description}" as cancelled instead?`
                              });
                            }
                          };

                          return (
                            <div key={o.id} className="bg-surface-card p-3 rounded-lg border border-border space-y-2 relative group">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-semibold text-ink-primary">{o.description}</span>
                                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-page border border-border text-ink-secondary">
                                      {ORDER_TYPE_LABEL[o.orderType] || o.orderType}
                                    </span>
                                    {isShared && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-status-warning/10 border border-status-warning/20 text-status-warning" title={`Also in: ${otherTemplates?.join(', ')}`}>
                                        Shared
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-ink-secondary mt-0.5">
                                    Qty {o.quantity}
                                    {showDetails.showDosage && o.dosage && ` · ${o.dosage}`}
                                    {showDetails.showDosage && o.route && ` · ${o.route}`}
                                    {showDetails.showDosage && o.frequency && ` · ${o.frequency}`}
                                    {showDetails.showPrice && Number(o.totalPrice) > 0 && ` · ${money(o.totalPrice)}`}
                                  </p>
                                  {showDetails.showInstructions && o.instructions && (
                                    <p className="text-[11px] text-ink-secondary/80 italic mt-0.5">{o.instructions}</p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <StatusBadge
                                    label={o.status === 'DONE' ? 'Done' : o.status === 'CANCELLED' ? 'Cancelled' : 'Ordered'}
                                    variant={o.status === 'DONE' ? 'success' : o.status === 'CANCELLED' ? 'danger' : 'warning'}
                                  />
                                  {isStock && (
                                    o.medicineId ? (
                                      <span
                                        className={`text-[10px] font-medium ${o.dispensedAt ? 'text-status-success' : 'text-status-warning'}`}
                                      >
                                        {o.dispensedAt ? 'Dispensed' : 'Not dispensed'}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-status-danger/10 text-status-danger border border-status-danger/20">
                                        Not stocked — buy outside
                                      </span>
                                    )
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {canDispense && isStock && o.medicineId && !o.dispensedAt && o.status !== 'CANCELLED' && (
                                  <button
                                    onClick={() => dispenseOrder(o.id)}
                                    disabled={busyOrderId === o.id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-brand-deep bg-brand-soft hover:bg-brand-soft/70 border border-brand/20 rounded cursor-pointer disabled:opacity-50"
                                  >
                                    <Package className="w-3 h-3" /> Dispense
                                  </button>
                                )}
                                {canAssess && (
                                  <button
                                    onClick={handleRemoveClick}
                                    disabled={busyOrderId === o.id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-status-danger bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/20 rounded cursor-pointer disabled:opacity-50"
                                  >
                                    <X className="w-3 h-3" /> Remove
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

      <AssignDoctorModal
        isOpen={showAssignDoctor}
        onClose={() => setShowAssignDoctor(false)}
        onAssigned={onChanged}
        entry={entry}
      />

      {showSaveTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-sm w-full">
            <div className="bg-brand px-6 py-5 text-white flex items-center justify-between rounded-t-[10px]">
              <h3 className="text-base font-semibold">Save as Template</h3>
              <button onClick={() => setShowSaveTemplate(false)} className="p-1 rounded hover:bg-white/10 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveAsTemplate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Template Name <span className="text-status-danger">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.g. Standard Viral Fever"
                  className={inputClass}
                />
              </div>
              <p className="text-[10px] text-ink-secondary">
                This will save your current diagnosis, notes, and the {entry.careOrders?.length || 0} care orders below as a reusable template.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSaveTemplate(false)}
                  className="px-4 py-2 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded-md cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTemplate}
                  className="px-4 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {savingTemplate ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showManageTemplates && (
        <div className="fixed inset-0 z-50 flex flex-col p-4 sm:p-8 bg-black/50 backdrop-blur-xs">
          <div className="bg-surface-card rounded-[10px] border border-border shadow-xl w-full max-w-5xl mx-auto flex flex-col max-h-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-page">
              <h2 className="text-lg font-semibold text-ink-primary tracking-tight">Manage Templates</h2>
              <button
                onClick={() => {
                  setShowManageTemplates(false);
                  // Refresh templates in QueueDetail
                  apiFetch('/api/prescription-templates').then(r => r.json()).then(d => setTemplates(Array.isArray(d) ? d : d.data || []));
                }}
                className="p-1.5 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-card border border-transparent hover:border-border cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 relative">
              <PrescriptionTemplates />
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={deleteTarget?.title || 'Confirm'}
        message={deleteTarget?.message || 'Are you sure?'}
        confirmLabel={deleteTarget?.action === 'delete' ? 'Delete' : deleteTarget?.action === 'cancel' ? 'Cancel Order' : 'Remove'}
        variant={deleteTarget?.action === 'delete' ? 'danger' : 'warning'}
        loading={busyOrderId === deleteTarget?.id}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
