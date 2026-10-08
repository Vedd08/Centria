import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { X, Plus, Package } from 'lucide-react';
import { PackageTypeItem } from './PackageList';
import { money } from '../../utils/money';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export const PackageTypeModal: React.FC<Props> = ({ isOpen, onClose, onUpdate }) => {
  const { token, user , apiFetch } = useAuth();
  const { addToast } = useToast();
  
  const [packageTypes, setPackageTypes] = useState<PackageTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPrice, setNewPrice] = useState<number>(5000);
  const [newSittings, setNewSittings] = useState<number>(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const fetchPackageTypes = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/packages/types', {
        });
      const data = await res.json();
      if (res.ok) {
        setPackageTypes(data);
      }
    } catch (err: any) {
      addToast('error', err.message || 'Failed to load package types');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchPackageTypes();
  }, [isOpen]);

  const handleAddPackageType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch('/api/packages/types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          price: Number(newPrice),
          totalSittings: Number(newSittings),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add package type');

      setNewName('');
      setNewDescription('');
      setNewPrice(5000);
      setNewSittings(5);
      fetchPackageTypes();
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Error adding package type');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePackageType = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      const res = await apiFetch(`/api/packages/types/${id}`, {
        method: 'DELETE',
        });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete package type');
      }
      setDeletingId(null);
      fetchPackageTypes();
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Error deleting package type');
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    await handleDeletePackageType(confirmDelete.id);
    setConfirmDelete(null);
  };

  const canEdit = user?.role === 'MASTER' || user?.role === 'SUPER_ADMIN';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-3xl w-full mx-2 sm:mx-0 my-4 sm:my-8 overflow-hidden">
        
        <div className="bg-brand-deep px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/10">
              <Package className="w-5 h-5 text-brand-soft" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Package Types Catalog</h2>
              <p className="text-xs text-white/80">Admin editable catalog for multi-sitting packages</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {canEdit && (
            <form onSubmit={handleAddPackageType} className="bg-surface-page border border-border p-4 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-ink-primary uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-brand" /> Add New Package Type
              </h3>

              {error && (
                <div className="p-2.5 rounded-lg bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Package Name (e.g. PRP 5 Sessions)"
                  className="w-full px-3 py-2 rounded-lg border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card"
                />
                
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Description (Optional)"
                  className="w-full px-3 py-2 rounded-lg border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card"
                />

                <input
                  type="number"
                  required
                  min={0}
                  step="any"
                  value={newPrice}
                  onChange={(e) => setNewPrice(Number(e.target.value))}
                  placeholder="Price ₹"
                  className="w-full px-3 py-2 rounded-lg border border-border text-xs font-mono focus:ring-1 focus:ring-brand bg-surface-card"
                />

                <input
                  type="number"
                  required
                  min={1}
                  value={newSittings}
                  onChange={(e) => setNewSittings(Number(e.target.value))}
                  placeholder="Total Sittings"
                  className="w-full px-3 py-2 rounded-lg border border-border text-xs font-mono focus:ring-1 focus:ring-brand bg-surface-card"
                />
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add Package Type'}
                </button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-ink-secondary px-1">
              <span>Package Title ({packageTypes.length} items)</span>
              <span>Price & Sittings</span>
            </div>

            <div className="max-h-80 overflow-y-auto border border-border rounded-xl divide-y divide-border/60 bg-surface-card">
              {packageTypes.map((pkg) => (
                <div key={pkg.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-surface-page transition-colors text-xs">
                  <div>
                    <span className="font-semibold text-ink-primary block">{pkg.name}</span>
                    {pkg.description && <span className="text-ink-secondary text-[11px] block mt-0.5">{pkg.description}</span>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono font-bold text-ink-primary">{money(pkg.price)}</span>
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-brand/10 text-brand-soft border border-brand/20">
                      {pkg.totalSittings} Sittings
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => setConfirmDelete({ id: pkg.id, name: pkg.name })}
                        disabled={deletingId === pkg.id}
                        className="text-status-danger hover:text-status-danger/80 text-[11px] font-medium ml-1 cursor-pointer disabled:opacity-50"
                        title="Delete package type"
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

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete Package Type"
        message={`Are you sure you want to delete "${confirmDelete?.name}"? Purchases made against this package type will remain intact, but it will no longer be available for new purchases.`}
        confirmLabel="Delete Package Type"
        variant="danger"
        loading={deletingId === confirmDelete?.id}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />

    </div>
  );
};
