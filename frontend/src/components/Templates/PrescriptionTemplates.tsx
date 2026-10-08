import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { FileStack, Plus, X, Trash2, Edit3, Pill } from 'lucide-react';
import { BulletListEditor } from '../common/BulletListEditor';

interface TemplateItem {
  orderType: string;
  medicineId?: string;
  treatmentId?: string;
  description: string;
  notStocked?: boolean;
  dosage?: string;
  route?: string;
  frequency?: string;
  instructions?: string;
  quantity: number;
}

interface Template {
  id: string;
  name: string;
  condition?: string;
  diagnosis?: string;
  patientNotes?: string;
  staffNotes?: string;
  items: (TemplateItem & { id: string; medicine?: { name: string } })[];
  doctor?: { name: string };
}

interface MedicineOption {
  id: string;
  name: string;
  unit: string;
  isActive: boolean;
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

const ROUTES = ['Oral', 'IV', 'IM', 'Subcutaneous', 'Topical', 'Inhalation'];

const emptyItem = (): TemplateItem => ({
  orderType: 'MEDICINE',
  description: '',
  quantity: 1,
  dosage: '',
  frequency: '',
  route: 'Oral',
  instructions: '',
});

/**
 * A doctor's personal library of prescriptions for conditions they treat often.
 * Applying one during an encounter fills the diagnosis, advice and orders in one go.
 */
export const PrescriptionTemplates: React.FC = () => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [medicines, setMedicines] = useState<MedicineOption[]>([]);
  const [treatments, setTreatments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [condition, setCondition] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [patientNotes, setPatientNotes] = useState('');
  const [staffNotes, setStaffNotes] = useState('');
  const [items, setItems] = useState<TemplateItem[]>([emptyItem()]);

  const load = async () => {
    setLoading(true);
    try {
      const [tRes, mRes, trRes] = await Promise.all([apiFetch('/api/prescription-templates'), apiFetch('/api/medicines'), apiFetch('/api/treatments')]);
      if (!tRes.ok) throw new Error('Failed to load templates');
      const tData = await tRes.json();
      const mData = await mRes.json();
      const trData = await trRes.json();
      setTemplates(Array.isArray(tData) ? tData : tData.data || []);
      const meds: MedicineOption[] = Array.isArray(mData) ? mData : mData.data || [];
      setMedicines(meds.filter((m) => m.isActive));
      setTreatments(Array.isArray(trData) ? trData : trData.data || []);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNew = () => {
    setEditing(null);
    setName('');
    setCondition('');
    setDiagnosis('');
    setPatientNotes('');
    setStaffNotes('');
    setItems([emptyItem()]);
    setShowForm(true);
  };

  const openEdit = (t: Template) => {
    setEditing(t);
    setName(t.name);
    setCondition(t.condition || '');
    setDiagnosis(t.diagnosis || '');
    setPatientNotes(t.patientNotes || '');
    setStaffNotes(t.staffNotes || '');
    setItems(
      t.items.length
        ? t.items.map((i) => ({
            orderType: i.orderType,
            medicineId: i.medicineId || undefined,
            notStocked: ['MEDICINE', 'INJECTION'].includes(i.orderType) && !i.medicineId ? true : undefined,
            treatmentId: i.treatmentId || undefined,
            description: i.description,
            dosage: i.dosage || '',
            route: i.route || 'Oral',
            frequency: i.frequency || '',
            instructions: i.instructions || '',
            quantity: i.quantity,
          }))
        : [emptyItem()],
    );
    setShowForm(true);
  };

  const updateItem = (idx: number, patch: Partial<TemplateItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for unlinked stock items that have a description (not just a blank row)
    const unlinked = items.some(i => ['MEDICINE', 'INJECTION'].includes(i.orderType) && !i.medicineId && !i.notStocked && i.description.trim());
    if (unlinked) {
      addToast('error', 'Please resolve all unlinked medicines before saving');
      return;
    }

    // Drop blank rows so an untouched extra line doesn't fail validation.
    const payloadItems = items.filter(
      (i) => (['MEDICINE', 'INJECTION'].includes(i.orderType) && i.medicineId) || (i.orderType === 'TREATMENT' && i.treatmentId) || i.description.trim(),
    );

    setSubmitting(true);
    try {
      const body = {
        name: name.trim(),
        condition: condition.trim() || undefined,
        diagnosis: diagnosis.trim() || undefined,
        patientNotes: patientNotes.trim() || undefined,
        staffNotes: staffNotes.trim() || undefined,
        items: payloadItems.map((i) => ({
          orderType: i.orderType,
          medicineId: ['MEDICINE', 'INJECTION'].includes(i.orderType) ? i.medicineId : undefined,
          notStocked: i.notStocked || undefined,
          treatmentId: i.orderType === 'TREATMENT' ? i.treatmentId : undefined,
          description: i.description.trim() || undefined,
          dosage: i.dosage?.trim() || undefined,
          route: i.route || undefined,
          frequency: i.frequency?.trim() || undefined,
          instructions: i.instructions?.trim() || undefined,
          quantity: i.quantity || 1,
        })),
      };

      const res = await apiFetch(
        editing ? `/api/prescription-templates/${editing.id}` : '/api/prescription-templates',
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not save the template');

      addToast('success', editing ? 'Template updated' : 'Template created');
      setShowForm(false);
      load();
    } catch (err: any) {
      addToast('error', err.message || 'Could not save the template');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/prescription-templates/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete the template');
      addToast('success', 'Template deleted');
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      addToast('error', err.message || 'Could not delete the template');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <FileStack className="w-5 h-5 text-brand" />
            My Prescription Templates
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Save a prescription per condition you treat often, then apply it to a patient in one click. Only you can
            see and edit your templates.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {templates.length > 5 && (
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search templates..."
              className="px-3 py-1.5 rounded-md border border-border text-xs bg-surface-page text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand"
            />
          )}
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Template</span>
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{editing ? 'Edit template' : 'New template'}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="p-1 rounded text-ink-secondary hover:text-ink-primary cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Template Name <span className="text-status-danger">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acne Vulgaris — Grade II"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Health Issue / Condition</label>
              <input
                type="text"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                placeholder="e.g. Acne"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Default Diagnosis</label>
            <input type="text" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className={inputClass} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Advice for Patient <span className="text-[10px] font-normal text-ink-secondary/70">(printed)</span>
              </label>
              <BulletListEditor
                value={patientNotes}
                onChange={setPatientNotes}
                placeholder="e.g. Avoid direct sun for 48 hours..."
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Notes for Staff <span className="text-[10px] font-normal text-status-warning">(internal — never printed)</span>
              </label>
              <BulletListEditor
                value={staffNotes}
                onChange={setStaffNotes}
                placeholder="e.g. Patch test before first sitting..."
                containerClass="w-full p-2.5 rounded-md border border-border bg-surface-page text-ink-primary flex flex-col gap-1 border-l-2 border-l-status-warning"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ink-secondary">Medicines / Procedures</label>
              <button
                type="button"
                onClick={() => setItems((p) => [...p, emptyItem()])}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add line
              </button>
            </div>

            {items.map((item, idx) => {
              const isStock = ['MEDICINE', 'INJECTION'].includes(item.orderType);
              const isUnlinked = isStock && !item.medicineId && !item.notStocked && item.description.trim().length > 0;
              const isIntentionallyNotStocked = isStock && !item.medicineId && item.notStocked && item.description.trim().length > 0;
              return (
                <div key={idx} className={`bg-surface-page p-3 rounded-lg border space-y-2 ${isUnlinked ? 'border-status-danger bg-status-danger/5' : 'border-border'}`}>
                  {isIntentionallyNotStocked && (
                    <div className="flex items-center gap-1.5 p-2 bg-surface-card border border-border rounded-md text-xs text-ink-secondary font-medium">
                      <span>ℹ️</span> Not dispensed here — buy outside
                    </div>
                  )}
                  {isUnlinked && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-status-danger/10 border border-status-danger/20 rounded-md text-xs">
                      <div className="flex items-center gap-1.5 text-status-danger font-medium">
                        <span>⚠️</span> "{item.description}" is not in the pharmacy catalogue.
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          type="button" 
                          onClick={() => updateItem(idx, { notStocked: true })}
                          className="px-2 py-1 bg-surface-card border border-border rounded hover:bg-surface-page font-medium text-ink-primary whitespace-nowrap cursor-pointer"
                        >
                          Keep as prescription only (Not dispensed)
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <select value={item.orderType} onChange={(e) => updateItem(idx, { orderType: e.target.value })} className={inputClass}>
                      <option value="MEDICINE">Medicine</option>
                      <option value="INJECTION">Injection</option>
                      <option value="TREATMENT">Treatment</option>
                      <option value="OTHER">Other (Prescription only)</option>
                    </select>

                    {isStock ? (
                      <select
                        value={item.medicineId || ''}
                        onChange={(e) => updateItem(idx, { medicineId: e.target.value, description: medicines.find(m => m.id === e.target.value)?.name || item.description })}
                        className={`${inputClass} col-span-2 ${isUnlinked ? 'ring-1 ring-status-danger border-status-danger' : ''}`}
                      >
                        <option value="">Select from pharmacy to link</option>
                        {medicines.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.unit})
                          </option>
                        ))}
                      </select>
                    ) : item.orderType === 'TREATMENT' ? (
                      <select
                        value={item.treatmentId || ''}
                        onChange={(e) => updateItem(idx, { treatmentId: e.target.value, description: treatments.find(t => t.id === e.target.value)?.name || item.description })}
                        className={`${inputClass} col-span-2`}
                      >
                        <option value="">Select from treatments</option>
                        {treatments.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(idx, { description: e.target.value })}
                        placeholder="Describe the procedure/medicine"
                        className={`${inputClass} col-span-2`}
                      />
                    )}

                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                        placeholder="Qty"
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                        className="p-2 rounded-md text-status-danger bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/20 cursor-pointer shrink-0"
                        title="Remove line"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input type="text" value={item.dosage} onChange={(e) => updateItem(idx, { dosage: e.target.value })} placeholder="Dosage" className={inputClass} />
                    <input type="text" value={item.frequency} onChange={(e) => updateItem(idx, { frequency: e.target.value })} placeholder="Frequency e.g. 1-0-1" className={inputClass} />
                    <select value={item.route} onChange={(e) => updateItem(idx, { route: e.target.value })} className={inputClass}>
                      {ROUTES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <input type="text" value={item.instructions} onChange={(e) => updateItem(idx, { instructions: e.target.value })} placeholder="Instructions" className={inputClass} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded-md cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50">
              {submitting ? 'Saving...' : editing ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : templates.length === 0 ? (
        <div className="bg-surface-card rounded-[10px] border border-border p-12 text-center space-y-2">
          <p className="text-sm font-semibold">No templates yet</p>
          <p className="text-xs text-ink-secondary">
            Create one for a condition you see often — it becomes a one-click prescription.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {templates
            .filter(t => !searchTerm || t.name.toLowerCase().includes(searchTerm.toLowerCase()) || (t.condition && t.condition.toLowerCase().includes(searchTerm.toLowerCase())))
            .map((t) => (
            <div key={t.id} className="bg-surface-card p-4 rounded-[10px] border border-border shadow-xs space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{t.name}</h3>
                  {t.condition && <p className="text-[11px] text-ink-secondary">{t.condition}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border cursor-pointer">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDeleteTarget(t)} className="p-1.5 rounded text-status-danger bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/20 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {t.diagnosis && (
                <p className="text-xs text-ink-secondary">
                  <span className="font-medium text-ink-primary">Dx:</span> {t.diagnosis}
                </p>
              )}

              {t.items.length > 0 && (
                <ul className="text-[11px] text-ink-secondary space-y-0.5 pt-1 border-t border-border">
                  {t.items.map((i) => (
                    <li key={i.id} className="flex items-center gap-1.5">
                      <Pill className="w-3 h-3 text-brand shrink-0" />
                      <span>
                        {i.description}
                        {i.dosage && ` · ${i.dosage}`}
                        {i.frequency && ` · ${i.frequency}`}
                        {` · x${i.quantity}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Template"
        message={`Delete "${deleteTarget?.name}"? Prescriptions already written from it are unaffected.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
