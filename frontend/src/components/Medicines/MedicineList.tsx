import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { Pill, Plus, Search, RefreshCw, AlertTriangle, Minus, X, History, Clock, User, LayoutGrid, List } from 'lucide-react';
import { ShelfView } from './ShelfView';

export interface MedicineItem {
  id: string;
  name: string;
  unit: string;
  stockQty: number;
  reorderPoint: number;
  unitPrice: number;
  shelf?: string;
  isActive: boolean;
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

export const MedicineList: React.FC = () => {
  const { token, hasRole , apiFetch } = useAuth();

  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'shelf'>('list');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('tablet');
  const [newStockQty, setNewStockQty] = useState(0);
  const [newReorderPoint, setNewReorderPoint] = useState(10);
  const [newUnitPrice, setNewUnitPrice] = useState(0);
  const [newShelf, setNewShelf] = useState('');
  const [newGstTaxable, setNewGstTaxable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // id of the row whose inline stock editor is open
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState(0);

  // Stock movement history modal
  const [movementsMedicineId, setMovementsMedicineId] = useState<string | null>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const { addToast } = useToast();
  const canManageStock = hasRole('PHARMACY');

  const authHeaders = useMemo(
    () => ({ }),
    [token],
  );

  const fetchMedicines = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/medicines', { headers: authHeaders, signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load pharmacy catalog');
      setMedicines(Array.isArray(data) ? data : []);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Could not reach the pharmacy service');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchMedicines(controller.signal);
    return () => controller.abort();
  }, []);

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await apiFetch('/api/medicines', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          unit: newUnit.trim(),
          stockQty: Number(newStockQty),
          reorderPoint: Number(newReorderPoint),
          unitPrice: Number(newUnitPrice),
          shelf: newShelf.trim() || undefined,
          isGstTaxable: newGstTaxable,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add medicine');

      setIsAddOpen(false);
      setNewName('');
      setNewUnit('tablet');
      setNewStockQty(0);
      setNewReorderPoint(10);
      setNewGstTaxable(false);
      setNewUnitPrice(0);
      setNewShelf('');
      fetchMedicines();
    } catch (err: any) {
      setFormError(err.message || 'Error adding medicine');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustStock = async (id: string, delta: number) => {
    if (!delta) return;
    setError(null);
    try {
      const res = await apiFetch(`/api/medicines/${id}/stock`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Stock adjustment failed');

      setAdjustingId(null);
      setAdjustDelta(0);
      fetchMedicines();
    } catch (err: any) {
      setError(err.message || 'Stock adjustment failed');
    }
  };

  const visible = medicines
    .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    .filter((m) => (lowStockOnly ? m.stockQty <= m.reorderPoint : true));

  const lowStockCount = medicines.filter((m) => m.stockQty <= m.reorderPoint).length;
  const stockValue = medicines.reduce((sum, m) => sum + m.stockQty * m.unitPrice, 0);

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-semibold text-ink-primary tracking-tight flex items-center gap-2">
            <Pill className="w-4.5 h-4.5 text-brand" /> Pharmacy Inventory
          </h2>
          <p className="hidden sm:block text-xs text-ink-secondary mt-0.5">
            Consumables and medicine stock with reorder-point alerts. Dispensing a prescription
            deducts stock automatically.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 text-ink-secondary/60 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search medicine..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-border text-xs focus:outline-none focus:ring-1 focus:ring-brand bg-surface-card"
            />
          </div>

          <button
            onClick={() => fetchMedicines()}
            disabled={loading}
            className="p-2 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border transition-colors cursor-pointer shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {canManageStock && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Medicine</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs">
          {error}
        </div>
      )}

      {/* Summary strip */}
      <div className="bg-surface-card rounded-[10px] border border-border p-4 shadow-xs flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border/60">
        <div className="flex-1 p-3">
          <div className="text-xs font-medium text-ink-secondary">Catalog Items</div>
          <div className="text-[22px] font-bold font-mono leading-tight">{medicines.length}</div>
        </div>
        <div className="flex-1 p-3">
          <div className="text-xs font-medium text-ink-secondary">At / Below Reorder Point</div>
          <div
            className={`text-[22px] font-bold font-mono leading-tight ${
              lowStockCount > 0 ? 'text-status-danger' : ''
            }`}
          >
            {lowStockCount}
          </div>
        </div>
        <div className="flex-1 p-3">
          <div className="text-xs font-medium text-ink-secondary">Stock Value at Cost</div>
          <div className="text-[22px] font-bold font-mono leading-tight">
            ₹{stockValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Low stock filter */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">
          Medicine Catalog ({visible.length} shown)
        </h3>
        
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-ink-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded text-brand focus:ring-brand"
            />
            <span>Show only items needing reorder</span>
          </label>
          
          <div className="flex items-center bg-surface-card border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 transition-colors ${viewMode === 'list' ? 'bg-brand text-white' : 'text-ink-secondary hover:bg-surface-page'}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('shelf')}
              className={`p-1.5 transition-colors ${viewMode === 'shelf' ? 'bg-brand text-white' : 'text-ink-secondary hover:bg-surface-page'}`}
              title="Interactive Shelf View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* View Rendering */}
      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : visible.length === 0 ? (
        <div className="bg-surface-card rounded-[10px] border border-border p-8 text-center text-xs text-ink-secondary shadow-xs">
          {medicines.length === 0
            ? 'No medicines in the catalog yet.'
            : 'No medicines match the current filter.'}
        </div>
      ) : viewMode === 'shelf' ? (
        <ShelfView medicines={visible} />
      ) : (
        <div className="bg-surface-card rounded-[10px] border border-border overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-page border-b border-border text-ink-secondary font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 px-4">Medicine</th>
                  <th className="py-3.5 px-4">Unit</th>
                  <th className="py-3.5 px-4 text-right">Unit Price</th>
                  <th className="py-3.5 px-4">Shelf</th>
                  <th className="py-3.5 px-4 text-right">In Stock</th>
                  <th className="py-3.5 px-4 text-right">Reorder At</th>
                  <th className="py-3.5 px-4">Status</th>
                  {canManageStock && <th className="py-3.5 px-4 text-right">Adjust Stock</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {visible.map((m) => {
                  const isLow = m.stockQty <= m.reorderPoint;
                  return (
                    <tr key={m.id} className="hover:bg-surface-page/60 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-ink-primary">{m.name}</td>
                      <td className="py-3.5 px-4 text-ink-secondary">{m.unit}</td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        ₹{m.unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-ink-secondary">
                        {m.shelf || '-'}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono font-bold ${
                          isLow ? 'text-status-danger' : 'text-ink-primary'
                        }`}
                      >
                        {m.stockQty}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-ink-secondary">
                        {m.reorderPoint}
                      </td>
                      <td className="py-3.5 px-4">
                        {!m.isActive ? (
                          <StatusBadge label="Discontinued" variant="neutral" />
                        ) : isLow ? (
                          <StatusBadge label="Reorder Now" variant="danger" />
                        ) : (
                          <StatusBadge label="In Stock" variant="success" />
                        )}
                      </td>
                      {canManageStock && (
                        <td className="py-3.5 px-4">
                          {adjustingId === m.id ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <input
                                type="number"
                                autoFocus
                                value={adjustDelta}
                                onChange={(e) => setAdjustDelta(Number(e.target.value))}
                                className="w-20 px-2 py-1 rounded border border-border text-xs font-mono text-right"
                                placeholder="+/-"
                              />
                              <button
                                onClick={() => handleAdjustStock(m.id, adjustDelta)}
                                className="px-2 py-1 rounded bg-brand text-white text-xs font-medium hover:bg-brand-deep cursor-pointer"
                              >
                                Apply
                              </button>
                              <button
                                onClick={() => {
                                  setAdjustingId(null);
                                  setAdjustDelta(0);
                                }}
                                className="p-1 rounded text-ink-secondary hover:bg-surface-page cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleAdjustStock(m.id, -1)}
                                disabled={m.stockQty === 0}
                                className="p-1 rounded border border-border text-ink-secondary hover:text-status-danger hover:border-status-danger/40 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                title="Deduct one unit"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleAdjustStock(m.id, 1)}
                                className="p-1 rounded border border-border text-ink-secondary hover:text-brand hover:border-brand/40 cursor-pointer"
                                title="Receive one unit"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                                              <button
                                onClick={() => {
                                  setAdjustingId(m.id);
                                  setAdjustDelta(0);
                                }}
                                className="px-2 py-1 rounded bg-brand-soft text-brand-deep text-[11px] font-medium hover:bg-brand hover:text-white transition-colors cursor-pointer"
                              >
                                Bulk
                              </button>
                              <button
                                onClick={async () => {
                                  setMovementsMedicineId(m.id);
                                  setMovementsLoading(true);
                                  try {
                                    const res = await apiFetch(`/api/medicines/${m.id}/movements`, { headers: authHeaders });
                                    if (res.ok) {
                                      setMovements(await res.json());
                                    }
                                  } catch (err: any) {
                                    addToast('error', err.message || 'Failed to load movements');
                                  } finally {
                                    setMovementsLoading(false);
                                  }
                                }}
                                className="px-2 py-1 rounded bg-surface-page text-ink-secondary text-[11px] font-medium hover:bg-brand-soft hover:text-brand-deep transition-colors border border-border cursor-pointer"
                                title="View stock movement history"
                              >
                                History
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Medicine Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface-card rounded-[10px] border border-border p-6 max-w-md w-full space-y-4 shadow-xl mx-2 sm:mx-0 my-4 sm:my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Pill className="w-4 h-4 text-brand" /> Add Medicine to Catalog
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1 rounded text-ink-secondary hover:bg-surface-page cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-md bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddMedicine} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Medicine Name <span className="text-status-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Minoxidil 5% Topical Solution"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Dispensing Unit <span className="text-status-danger">*</span>
                  </label>
                  <select
                    required
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className={inputClass}
                  >
                    {['tablet', 'capsule', 'bottle', 'tube', 'vial', 'syringe', 'ml', 'sachet'].map(
                      (u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Unit Price (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={newUnitPrice}
                    onChange={(e) => setNewUnitPrice(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Shelf Location
                  </label>
                  <input
                    type="text"
                    value={newShelf}
                    onChange={(e) => setNewShelf(e.target.value)}
                    placeholder="e.g. A1, Rack 3"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">GST on sale</label>
                  <select
                    value={newGstTaxable ? 'yes' : 'no'}
                    onChange={(e) => setNewGstTaxable(e.target.value === 'yes')}
                    className={inputClass}
                  >
                    <option value="no">Exempt</option>
                    <option value="yes">Taxable (18%)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Opening Stock
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newStockQty}
                    onChange={(e) => setNewStockQty(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Reorder Point
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newReorderPoint}
                    onChange={(e) => setNewReorderPoint(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-ink-secondary bg-surface-page p-2.5 rounded border border-border/60">
                <AlertTriangle className="w-3.5 h-3.5 text-status-warning shrink-0" />
                <span>
                  The dashboard flags an item as low stock once quantity falls to or below the
                  reorder point.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-ink-secondary hover:text-ink-primary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-brand text-white text-xs font-medium rounded-md shadow-xs hover:bg-brand-deep disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Adding...' : 'Add to Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Movement History Modal */}
      {movementsMedicineId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface-card rounded-[10px] border border-border p-6 max-w-lg w-full space-y-4 shadow-xl mx-2 sm:mx-0 my-4 sm:my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <History className="w-4 h-4 text-brand" /> Stock Movement History
              </h3>
              <button
                onClick={() => { setMovementsMedicineId(null); setMovements([]); }}
                className="p-1 rounded text-ink-secondary hover:bg-surface-page cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {movementsLoading ? (
              <div className="py-8 text-center text-xs text-ink-secondary">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                Loading movements...
              </div>
            ) : movements.length === 0 ? (
              <div className="py-8 text-center text-xs text-ink-secondary">
                No stock movements recorded for this item yet.
              </div>
            ) : (
              <div className="space-y-2">
                {movements.map((m: any) => (
                  <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg bg-surface-page border border-border text-xs">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      m.delta > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    }`}>
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`font-bold ${m.delta > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {m.delta > 0 ? '+' : ''}{m.delta} units
                        </span>
                        <span className="text-ink-secondary font-mono text-[10px]">
                          {new Date(m.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-ink-secondary mt-0.5">
                        {m.reason || (m.delta > 0 ? 'Stock received' : 'Stock deducted')}
                      </div>
                      {m.performedBy && (
                        <div className="text-[10px] text-ink-secondary/70 mt-0.5 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {m.performedBy.name} ({m.performedBy.role})
                        </div>
                      )}
                      <div className="text-[10px] text-ink-secondary/50 mt-0.5">
                        Balance after: {m.newQty}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-border flex justify-end">
              <button
                onClick={() => { setMovementsMedicineId(null); setMovements([]); }}
                className="px-4 py-1.5 text-xs font-medium text-ink-secondary bg-surface-page hover:bg-surface-page/80 border border-border rounded cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
