import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { X, Plus, Package, Pencil, Trash2, ArrowLeft, Check, Stethoscope } from 'lucide-react';
import { PackageTypeItem } from './PackageList';
import { PackageTypeLine } from './packagePlan';
import { money } from '../../utils/money';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  /** Open straight into editing this package (from a catalog card's Edit button). */
  editPackage?: PackageTypeItem | null;
}

interface Line extends PackageTypeLine {
  key: string;
  editing: boolean;
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';
const labelClass = 'block text-[11px] font-semibold text-ink-secondary mb-1';

let lineSeq = 0;
const newLine = (l?: Partial<PackageTypeLine>, editing = false): Line => ({
  key: `l${++lineSeq}`,
  treatmentId: l?.treatmentId ?? null,
  name: l?.name ?? '',
  sittings: l?.sittings ?? 3,
  sittingGapDays: l?.sittingGapDays ?? 30,
  editing,
});

/**
 * Package catalogue, as cards. A package holds one or more treatments, each with its
 * own sittings and gap; the validity covers the whole package.
 */
export const PackageTypeModal: React.FC<Props> = ({ isOpen, onClose, onUpdate, editPackage }) => {
  const { user, apiFetch } = useAuth();
  const { addToast } = useToast();

  const [packageTypes, setPackageTypes] = useState<PackageTypeItem[]>([]);
  const [treatments, setTreatments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state — `view === 'form'` while adding / editing.
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('5000');
  const [validityDays, setValidityDays] = useState('90');
  const [skipSundays, setSkipSundays] = useState(true);
  const [skipHolidays, setSkipHolidays] = useState(true);
  const [lines, setLines] = useState<Line[]>([newLine(undefined, true)]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const canEdit = user?.role === 'MASTER' || user?.role === 'SUPER_ADMIN' || user?.role === 'DOCTOR';
  // Admins edit any package; a doctor edits their own and clinic-wide ones, deletes only their own.
  const canEditPkg = (pkg: PackageTypeItem) => canEdit && (user?.role !== 'DOCTOR' || !pkg.doctorId || pkg.doctorId === user?.id);
  const canDeletePkg = (pkg: PackageTypeItem) => canEdit && (user?.role !== 'DOCTOR' || pkg.doctorId === user?.id);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [res, tRes] = await Promise.all([apiFetch('/api/packages/types'), apiFetch('/api/treatments')]);
      const data = await res.json();
      if (res.ok) setPackageTypes(data);
      const tData = await tRes.json();
      if (tRes.ok) setTreatments(Array.isArray(tData) ? tData : tData.data || []);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setPrice('5000');
    setValidityDays('90');
    setSkipSundays(true);
    setSkipHolidays(true);
    setLines([newLine(undefined, true)]);
    setError(null);
  };

  const startNew = () => {
    resetForm();
    setView('form');
  };

  const startEdit = (pkg: PackageTypeItem) => {
    setEditingId(pkg.id);
    setName(pkg.name);
    setDescription(pkg.description || '');
    setPrice(String(Number(pkg.price)));
    setValidityDays(pkg.validityDays ? String(pkg.validityDays) : '');
    setSkipSundays(pkg.skipSundays !== false);
    setSkipHolidays(pkg.skipHolidays !== false);
    const existing = pkg.items?.length
      ? pkg.items
      : [{ treatmentId: pkg.treatmentId, name: pkg.name, sittings: pkg.totalSittings, sittingGapDays: pkg.sittingGapDays }];
    setLines(existing.map((l) => newLine(l)));
    setError(null);
    setView('form');
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchAll();
    if (editPackage) startEdit(editPackage);
    else {
      resetForm();
      setView('list');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editPackage?.id]);

  if (!isOpen) return null;

  const updateLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const lineLabel = (l: Line) => l.name || treatments.find((t) => t.id === l.treatmentId)?.name || 'New treatment';
  const totalSittings = lines.reduce((s, l) => s + (Number(l.sittings) || 0), 0);
  const validity = Number(validityDays) || 0;
  const lineTooLong = (l: Line) => validity > 0 && (Number(l.sittings) || 0) > 1 && (Number(l.sittingGapDays) || 0) * ((Number(l.sittings) || 0) - 1) > validity;

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) return setError('Enter the package name');
    if (!lines.length) return setError('Add at least one treatment');
    const bad = lines.find((l) => !(l.treatmentId || l.name.trim()) || !(Number(l.sittings) >= 1));
    if (bad) return setError('Each treatment needs a name (or a catalogue treatment) and at least 1 sitting');

    setSubmitting(true);
    try {
      const res = await apiFetch(editingId ? `/api/packages/types/${editingId}` : '/api/packages/types', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          price: Number(price) || 0,
          validityDays: validity > 0 ? Math.floor(validity) : null,
          skipSundays,
          skipHolidays,
          items: lines.map((l) => ({
            treatmentId: l.treatmentId || undefined,
            name: l.treatmentId ? undefined : l.name.trim(),
            sittings: Math.floor(Number(l.sittings)),
            sittingGapDays: Number(l.sittingGapDays) > 0 ? Math.floor(Number(l.sittingGapDays)) : null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Failed to save the package');
      addToast('success', editingId ? `${data.name} updated — applies to new sales` : `${data.name} added`);
      resetForm();
      setView('list');
      fetchAll();
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Error saving the package');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete.id);
    try {
      const res = await apiFetch(`/api/packages/types/${confirmDelete.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to delete the package');
      addToast('success', data.message || 'Package deleted');
      fetchAll();
      onUpdate();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to delete the package');
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-4xl w-full my-4 overflow-hidden">
        <div className="bg-brand-deep px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/10">
              <Package className="w-5 h-5 text-brand-soft" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Package Types Catalog</h2>
              <p className="text-xs text-white/80">Each package can hold several treatments, each with its own sittings and gap</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {view === 'list' ? (
          <div className="p-6">
            {loading ? (
              <p className="text-xs text-ink-secondary py-8 text-center">Loading…</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {canEdit && (
                  <button
                    onClick={startNew}
                    className="min-h-[170px] rounded-[10px] border-2 border-dashed border-brand/40 hover:border-brand hover:bg-brand-soft/40 text-brand-deep flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Plus className="w-6 h-6" />
                    <span className="text-sm font-semibold">New package</span>
                    <span className="text-[11px] text-ink-secondary px-6 text-center">Add treatments, sittings, gaps and validity</span>
                  </button>
                )}
                {packageTypes.map((pkg) => {
                  const pkgLines: PackageTypeLine[] = pkg.items?.length
                    ? pkg.items
                    : [{ name: pkg.name, sittings: pkg.totalSittings, sittingGapDays: pkg.sittingGapDays }];
                  return (
                    <div key={pkg.id} className={`rounded-[10px] border border-border bg-surface-card p-4 flex flex-col gap-3 shadow-xs ${pkg.isActive === false ? 'opacity-60' : ''}`}>
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-bold text-ink-primary leading-snug">{pkg.name}</h4>
                          {pkg.isActive === false && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-surface-page text-ink-secondary border border-border">Inactive</span>
                          )}
                        </div>
                        {pkg.description && <p className="text-[11px] text-ink-secondary mt-0.5">{pkg.description}</p>}
                      </div>
                      <ul className="space-y-1">
                        {pkgLines.map((l, i) => (
                          <li key={i} className="flex items-center justify-between gap-2 text-[11px] px-2 py-1 rounded bg-surface-page border border-border">
                            <span className="font-medium text-ink-primary truncate">{l.name}</span>
                            <span className="shrink-0 text-ink-secondary">
                              {l.sittings} sitting{l.sittings === 1 ? '' : 's'}{l.sittingGapDays ? ` · ${l.sittingGapDays}d` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap gap-1">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${pkg.validityDays ? 'bg-surface-page text-ink-secondary border-border' : 'bg-status-warning/10 text-status-warning border-status-warning/20'}`}>
                          {pkg.validityDays ? `Valid ${pkg.validityDays} days` : 'No expiry'}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-brand/10 text-brand-deep border-brand/20">
                          {pkg.totalSittings} sittings in all
                        </span>
                      </div>
                      <div className="mt-auto pt-2 border-t border-border/60 flex items-center justify-between">
                        <span className="text-sm font-extrabold text-ink-primary">{money(pkg.price)}</span>
                        <div className="flex items-center gap-1.5">
                          {canEditPkg(pkg) && (
                            <button
                              onClick={() => startEdit(pkg)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-ink-primary bg-surface-page hover:bg-border/50 border border-border rounded-lg cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </button>
                          )}
                          {canDeletePkg(pkg) && (
                            <button
                              onClick={() => setConfirmDelete({ id: pkg.id, name: pkg.name })}
                              disabled={deletingId === pkg.id}
                              className="p-1.5 text-ink-secondary hover:text-status-danger rounded-lg cursor-pointer disabled:opacity-50"
                              title="Delete package"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <button
                onClick={() => { resetForm(); setView('list'); }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> All packages
              </button>
              <h3 className="text-sm font-bold text-ink-primary">{editingId ? `Edit ${name || 'package'}` : 'New package'}</h3>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs">{error}</div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Package name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pigmentation Combo" className={inputClass} disabled={submitting} />
              </div>
              <div>
                <label className={labelClass}>Description (optional)</label>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the package covers" className={inputClass} disabled={submitting} />
              </div>
              <div>
                <label className={labelClass}>Price (₹) *</label>
                <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} disabled={submitting} />
              </div>
              <div>
                <label className={labelClass}>Validity (days) — whole package expires after</label>
                <input type="number" min="1" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} placeholder="e.g. 120 — empty for no expiry" className={inputClass} disabled={submitting} />
              </div>
              <label className="flex items-center gap-2 text-xs text-ink-primary cursor-pointer select-none">
                <input type="checkbox" checked={skipSundays} onChange={(e) => setSkipSundays(e.target.checked)} className="rounded border-border text-brand" disabled={submitting} />
                Skip Sundays (move the sitting to Monday)
              </label>
              <label className="flex items-center gap-2 text-xs text-ink-primary cursor-pointer select-none">
                <input type="checkbox" checked={skipHolidays} onChange={(e) => setSkipHolidays(e.target.checked)} className="rounded border-border text-brand" disabled={submitting} />
                Skip clinic holidays
              </label>
            </div>

            {/* Treatments in the package */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-ink-primary uppercase tracking-wider">Treatments in this package ({lines.length})</h4>
                <span className="text-[11px] text-ink-secondary">{totalSittings} sittings in all</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {lines.map((l) => (
                  <div key={l.key} className={`rounded-lg border p-3 ${l.editing ? 'border-brand/40 bg-brand-soft/30' : 'border-border bg-surface-page'}`}>
                    {l.editing ? (
                      <div className="space-y-2">
                        <div>
                          <label className={labelClass}>Treatment</label>
                          <select
                            value={l.treatmentId || ''}
                            onChange={(e) => updateLine(l.key, { treatmentId: e.target.value || null, name: e.target.value ? '' : l.name })}
                            className={inputClass}
                          >
                            <option value="">Not in the catalogue — type a name</option>
                            {treatments.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                        {!l.treatmentId && (
                          <input type="text" value={l.name} onChange={(e) => updateLine(l.key, { name: e.target.value })} placeholder="Treatment name" className={inputClass} />
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={labelClass}>Sittings</label>
                            <input type="number" min="1" value={l.sittings} onChange={(e) => updateLine(l.key, { sittings: Number(e.target.value) })} className={inputClass} />
                          </div>
                          <div>
                            <label className={labelClass}>Gap (days)</label>
                            <input type="number" min="1" value={l.sittingGapDays ?? ''} onChange={(e) => updateLine(l.key, { sittingGapDays: e.target.value ? Number(e.target.value) : null })} className={inputClass} />
                          </div>
                        </div>
                        {lineTooLong(l) && (
                          <p className="text-[10px] text-status-warning">
                            {l.sittings} sittings {l.sittingGapDays} days apart need {(Number(l.sittingGapDays) || 0) * (Number(l.sittings) - 1)} days — more than the {validity}-day validity.
                          </p>
                        )}
                        <div className="flex justify-between pt-1">
                          <button
                            type="button"
                            onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                            disabled={lines.length === 1}
                            className="text-[11px] text-ink-secondary hover:text-status-danger cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => updateLine(l.key, { editing: false })}
                            disabled={!(l.treatmentId || l.name.trim()) || !(Number(l.sittings) >= 1)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-brand hover:bg-brand-deep rounded-md cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-3 h-3" /> Done
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <Stethoscope className="w-4 h-4 text-brand mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink-primary truncate">{lineLabel(l)}</p>
                            <p className="text-[11px] text-ink-secondary">
                              {l.sittings} sitting{Number(l.sittings) === 1 ? '' : 's'}{l.sittingGapDays ? ` · every ${l.sittingGapDays} days` : ' · no fixed gap'}
                            </p>
                            {lineTooLong(l) && <p className="text-[10px] text-status-warning mt-0.5">Won't fit in the validity</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateLine(l.key, { editing: true })}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-ink-primary bg-surface-card border border-border hover:bg-border/40 rounded cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                            disabled={lines.length === 1}
                            className="p-1 text-ink-secondary hover:text-status-danger rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={lines.length === 1 ? 'A package needs at least one treatment' : 'Remove treatment'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setLines((ls) => [...ls, newLine(undefined, true)])}
                  className="min-h-[72px] rounded-lg border-2 border-dashed border-brand/40 hover:border-brand hover:bg-brand-soft/40 text-brand-deep text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add treatment
                </button>
              </div>
            </div>

            <div className="text-xs text-ink-secondary bg-surface-page p-3 rounded-lg border border-border">
              <strong className="text-ink-primary">Summary: </strong>
              {name || 'This package'} — {lines.map((l) => `${l.sittings}× ${lineLabel(l)}${l.sittingGapDays ? ` every ${l.sittingGapDays} days` : ''}`).join(', ')} for {money(Number(price) || 0)}.
              {skipSundays || skipHolidays ? ` Sittings never fall on ${[skipSundays && 'a Sunday', skipHolidays && 'a clinic holiday'].filter(Boolean).join(' or ')}.` : ''}
              {validity > 0 ? ` The whole package is valid for ${validity} days from the sale.` : ' No expiry.'}
              {editingId && ' Changes apply to new sales; packages already sold keep their terms.'}
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { resetForm(); setView('list'); }}
                className="px-4 py-2 text-xs font-medium text-ink-primary bg-surface-page border border-border hover:bg-border/40 rounded-md cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Add Package'}
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete Package Type"
        message={`Delete "${confirmDelete?.name}"? Packages already sold stay as they are; it just can't be sold any more.`}
        confirmLabel="Delete Package"
        variant="danger"
        loading={deletingId === confirmDelete?.id}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};
