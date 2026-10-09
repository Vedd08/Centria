import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PrintablePrescription, PrescriptionData } from './PrintablePrescription';
import { StatusBadge } from '../common/StatusBadge';
import { PatientHistoryPanel } from '../PatientHistory/PatientHistoryPanel';
import { CollapsibleStep } from './assessment/CollapsibleStep';
import { Step1Diagnosis } from './assessment/Step1Diagnosis';
import { Step2Treatment } from './assessment/Step2Treatment';
import { Step3Orders } from './assessment/Step3Orders';
import { Step4Advice } from './assessment/Step4Advice';
import { Step5Fee } from './assessment/Step5Fee';
import { CareOrdersList } from './assessment/CareOrdersList';
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
  const canAssess = hasRole('DOCTOR');
  const [tab, setTab] = useState<Tab>(canAssess ? 'history' : 'orders');
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
  
  const formSnapshot = useRef<any>(null);
  
  const takeSnapshot = () => ({
    careType, diagnosis, conditionTrend, doctorNotes, patientNotes, staffNotes,
    consultationFee, nextAppointmentDate, treatmentId, usePackagePurchaseId, recommendedPackageTypeId
  });
  
  useEffect(() => {
    if (!formSnapshot.current) formSnapshot.current = takeSnapshot();
  }, []);
  
  const isDirty = React.useMemo(() => {
    if (!formSnapshot.current) return false;
    const current = takeSnapshot();
    return JSON.stringify(current) !== JSON.stringify(formSnapshot.current);
  }, [careType, diagnosis, conditionTrend, doctorNotes, patientNotes, staffNotes, consultationFee, nextAppointmentDate, treatmentId, usePackagePurchaseId, recommendedPackageTypeId]);
  
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
      formSnapshot.current = takeSnapshot();
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

  const careOrdersProps = {
    orders,
    groupedOrders,
    sortedGroupNames,
    pharmacyTotal,
    showConfig,
    setShowConfig,
    showDetails,
    toggleDetail,
    canAssess,
    canPerform,
    canDispense,
    busyOrderId,
    dispenseOrder,
    performOrder,
    setDeleteTarget
  };

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
        <form id="assessment-form" onSubmit={handleAssess} className="relative z-0 space-y-4">
          <CollapsibleStep step={1} title="Diagnosis">
             <Step1Diagnosis
               diagnosis={diagnosis} setDiagnosis={setDiagnosis}
               diagnosisTouched={diagnosisTouched} setDiagnosisTouched={setDiagnosisTouched}
               entry={entry} conditionTrend={conditionTrend} setConditionTrend={setConditionTrend}
               doctorNotes={doctorNotes} setDoctorNotes={setDoctorNotes}
               templates={templates} templateSearch={templateSearch} setTemplateSearch={setTemplateSearch}
               applyingTemplate={applyingTemplate} applyTemplate={applyTemplate}
               activeTemplateNames={activeTemplateNames} removeAppliedTemplate={removeAppliedTemplate}
               setShowSaveTemplate={setShowSaveTemplate} setShowManageTemplates={setShowManageTemplates}
             />
          </CollapsibleStep>
          
          <CollapsibleStep step={2} title="Treatment & package">
             <Step2Treatment
               careType={careType} setCareType={setCareType}
               treatmentId={treatmentId} setTreatmentId={setTreatmentId} treatments={treatments}
               setUsePackagePurchaseId={setUsePackagePurchaseId} patientPurchases={patientPurchases} usePackagePurchaseId={usePackagePurchaseId}
               setRecommendedPackageTypeId={setRecommendedPackageTypeId} recommendedPackageTypeId={recommendedPackageTypeId} packageTypes={packageTypes}
               setNextAppointmentDate={setNextAppointmentDate}
             />
          </CollapsibleStep>
          
          <CollapsibleStep step={3} title="Orders">
             <Step3Orders
               queueId={entry.id} isAssessed={isAssessed} onOrderAdded={onChanged}
               {...careOrdersProps}
             />
          </CollapsibleStep>
          
          <CollapsibleStep step={4} title="Advice for patient · Notes for nurse / staff">
             <Step4Advice
               patientNotes={patientNotes} setPatientNotes={setPatientNotes}
               staffNotes={staffNotes} setStaffNotes={setStaffNotes}
             />
          </CollapsibleStep>
          
          <CollapsibleStep step={5} title="Fee & next visit">
             <Step5Fee
               consultationFee={consultationFee} setConsultationFee={setConsultationFee}
               nextAppointmentDate={nextAppointmentDate} setNextAppointmentDate={setNextAppointmentDate}
             />
          </CollapsibleStep>

          <div className="sticky bottom-0 mt-4 p-3 sm:p-4 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 bg-surface-card border-t border-border rounded-b-[10px] flex items-center justify-between z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-2 text-ink-secondary">
              {isDirty ? (
                 <><div className="w-2 h-2 rounded-full bg-status-warning animate-pulse" /> <span className="text-xs font-medium">Unsaved changes</span></>
              ) : (
                 <><Check className="w-4 h-4 text-status-success" /> <span className="text-xs font-medium">Saved</span></>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                form="assessment-form"
                disabled={saving}
                className="px-4 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Saving...' : isAssessed ? 'Update Assessment' : `Save & Route to ${careType}`}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs space-y-4">
        <div className="flex items-center gap-1 border-b border-border">
          {[
            ...(!canAssess ? [{ key: 'orders' as Tab, label: 'Care Orders', icon: ClipboardList }] : []),
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
          <CareOrdersList {...careOrdersProps} />
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
