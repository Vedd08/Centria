import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { X, Plus, AlertCircle, Shield } from 'lucide-react';
import { money } from '../../utils/money';

interface TreatmentItem {
  id: string;
  name: string;
  isGstTaxable: boolean;
  price: number;
  hsnCode?: string;
  taxRate?: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const TreatmentMasterModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { token, user , apiFetch } = useAuth();
  const [treatments, setTreatments] = useState<TreatmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newName, setNewName] = useState('');
  const [newIsTaxable, setNewIsTaxable] = useState(true);
  const [newPrice, setNewPrice] = useState<number>(3000);
  const [newHsnCode, setNewHsnCode] = useState('');
  const [newTaxRate, setNewTaxRate] = useState<number>(18.0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // id of the treatment whose inline price editor is open
  const { addToast } = useToast();
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const fetchTreatments = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/treatments', {
        });
      const data = await res.json();
      if (res.ok) {
        setTreatments(data);
      }
    } catch (err: any) {
      addToast('error', err.message || 'Failed to load treatments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchTreatments();
  }, [isOpen]);

  const handleAddTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch('/api/treatments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify({
          name: newName.trim(),
          isGstTaxable: newIsTaxable,
          price: Number(newPrice),
          hsnCode: newHsnCode.trim() || undefined,
          taxRate: newIsTaxable ? Number(newTaxRate) : 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add treatment');

      setNewName('');
      setNewIsTaxable(true);
      setNewPrice(3000);
      setNewHsnCode('');
      setNewTaxRate(18.0);
      fetchTreatments();
    } catch (err: any) {
      setError(err.message || 'Error adding treatment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTaxable = async (item: TreatmentItem) => {
    try {
      const res = await apiFetch(`/api/treatments/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify({ isGstTaxable: !item.isGstTaxable }),
      });
      if (res.ok) fetchTreatments();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to toggle GST taxability');
    }
  };

  const handleSavePrice = async (id: string) => {
    setError(null);
    try {
      const res = await apiFetch(`/api/treatments/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify({ price: Number(editPrice) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update price');
      setEditingPriceId(null);
      fetchTreatments();
    } catch (err: any) {
      setError(err.message || 'Failed to update price');
    }
  };

  const handleDeleteTreatment = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      const res = await apiFetch(`/api/treatments/${id}`, {
        method: 'DELETE',
        });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete treatment');
      }
      setDeletingId(null);
      fetchTreatments();
    } catch (err: any) {
      setError(err.message || 'Error deleting treatment');
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    await handleDeleteTreatment(confirmDelete.id);
    setConfirmDelete(null);
  };

  const canEdit = user?.role === 'MASTER' || user?.role === 'SUPER_ADMIN';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-3xl w-full mx-2 sm:mx-0 my-4 sm:my-8 overflow-hidden">
        
        {/* Header */}
        <div className="bg-brand-deep px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/10">
              <Shield className="w-5 h-5 text-brand-soft" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Treatment Master Catalog</h2>
              <p className="text-xs text-white/80">Admin editable catalog for Treatments, Pricing, and GST Rules</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Add Treatment Form (Master / Super Admin Only) */}
          {canEdit && (
            <form onSubmit={handleAddTreatment} className="bg-surface-page border border-border p-4 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-ink-primary uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-brand" /> Add New Master Treatment
              </h3>

              {error && (
                <div className="p-2.5 rounded-lg bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs">
                  {error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Treatment Name (e.g. PRP Facial...)"
                  className="flex-1 w-full px-3 py-2 rounded-lg border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card"
                />

                <input
                  type="number"
                  required
                  min={0}
                  step="any"
                  value={newPrice}
                  onChange={(e) => setNewPrice(Number(e.target.value))}
                  placeholder="Price ₹"
                  title="Base price — drives invoice taxable value and commission calculations"
                  className="w-full sm:w-32 px-3 py-2 rounded-lg border border-border text-xs font-mono focus:ring-1 focus:ring-brand bg-surface-card shrink-0"
                />

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                  <input
                    type="text"
                    value={newHsnCode}
                    onChange={(e) => setNewHsnCode(e.target.value)}
                    placeholder="HSN Code (e.g. 9997)"
                    className="w-full sm:w-32 px-3 py-2 rounded-lg border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card"
                  />
                  {newIsTaxable && (
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={newTaxRate}
                      onChange={(e) => setNewTaxRate(Number(e.target.value))}
                      placeholder="GST %"
                      className="w-full sm:w-24 px-3 py-2 rounded-lg border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card"
                    />
                  )}

                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-ink-secondary cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={newIsTaxable}
                      onChange={(e) => setNewIsTaxable(e.target.checked)}
                      className="rounded text-brand focus:ring-brand"
                    />
                    <span>Is Taxable?</span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Adding...' : 'Add Treatment'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Treatment Catalog List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-ink-secondary px-1">
              <span>Treatment Name ({treatments.length} items)</span>
              <span>Base Price &amp; GST Taxability Status</span>
            </div>

            <div className="max-h-80 overflow-y-auto border border-border rounded-xl divide-y divide-border/60 bg-surface-card">
              {treatments.map((tr) => (
                <div key={tr.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-page transition-colors text-xs">
                  <div>
                    <div className="font-semibold text-ink-primary">{tr.name}</div>
                    {tr.hsnCode && <div className="text-ink-secondary mt-0.5">HSN: {tr.hsnCode}</div>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {editingPriceId === tr.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          autoFocus
                          min={0}
                          step="any"
                          value={editPrice}
                          onChange={(e) => setEditPrice(Number(e.target.value))}
                          className="w-24 px-2 py-1 rounded border border-border text-xs font-mono text-right"
                        />
                        <button
                          onClick={() => handleSavePrice(tr.id)}
                          className="px-2 py-1 rounded bg-brand text-white text-[11px] font-bold hover:bg-brand-deep cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingPriceId(null)}
                          className="px-1.5 py-1 rounded text-ink-secondary hover:text-ink-primary text-[11px] cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          if (!canEdit) return;
                          setEditingPriceId(tr.id);
                          setEditPrice(tr.price);
                        }}
                        disabled={!canEdit}
                        title={canEdit ? 'Edit base price' : undefined}
                        className={`font-mono font-bold text-ink-primary px-2 py-0.5 rounded ${
                          canEdit ? 'hover:bg-brand-soft cursor-pointer' : 'cursor-default'
                        }`}
                      >
                        {money(tr.price)}
                      </button>
                    )}
                    <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                      tr.isGstTaxable
                        ? 'bg-status-warning/10 text-status-warning border border-status-warning/20'
                        : 'bg-status-success/10 text-status-success border border-status-success/20'
                    }`}>
                      {tr.isGstTaxable ? `GST Taxable (${tr.taxRate ?? 18}%)` : 'GST Exempt'}
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => handleToggleTaxable(tr)}
                        className="text-ink-secondary hover:text-brand text-[11px] font-medium underline cursor-pointer"
                      >
                        Toggle Taxability
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => setConfirmDelete({ id: tr.id, name: tr.name })}
                        disabled={deletingId === tr.id}
                        className="text-status-danger hover:text-status-danger/80 text-[11px] font-medium ml-1 cursor-pointer disabled:opacity-50"
                        title="Delete treatment"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete Treatment"
        message={`Are you sure you want to delete "${confirmDelete?.name}"? This will permanently remove this treatment from the catalog.`}
        confirmLabel="Delete Treatment"
        variant="danger"
        loading={deletingId === confirmDelete?.id}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />

    </div>
  );
};
