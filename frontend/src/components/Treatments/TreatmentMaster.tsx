import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { Pagination } from '../common/Pagination';
import { exportToCsv } from '../../utils/exportToCsv';
import { Search, Plus, Check, X, AlertTriangle, Download, IndianRupee } from 'lucide-react';
import { money } from '../../utils/money';

interface Treatment {
  id: string;
  name: string;
  price: number;
  isGstTaxable: boolean;
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';


/**
 * The price list. Everything the clinic charges for is here, and until a treatment
 * has a price its visits bill at zero — so the unpriced count is shown up front
 * rather than left to be discovered on a bill.
 */
export const TreatmentMaster: React.FC = () => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [unpricedOnly, setUnpricedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Inline editing — the whole point is changing many prices quickly.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftPrice, setDraftPrice] = useState('');
  const [draftTaxable, setDraftTaxable] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newTaxable, setNewTaxable] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/treatments');
      if (!res.ok) throw new Error('Could not load the price list');
      const data = await res.json();
      setTreatments((Array.isArray(data) ? data : data.data || []).map((t: any) => ({ ...t, price: Number(t.price) })));
    } catch (err: any) {
      addToast('error', err.message || 'Could not load the price list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setPage(1), [search, unpricedOnly]);

  const unpricedCount = useMemo(() => treatments.filter((t) => !t.price).length, [treatments]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return treatments.filter(
      (t) => (!term || t.name.toLowerCase().includes(term)) && (!unpricedOnly || !t.price),
    );
  }, [treatments, search, unpricedOnly]);

  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  const startEdit = (t: Treatment) => {
    setEditingId(t.id);
    setDraftPrice(t.price ? String(t.price) : '');
    setDraftTaxable(t.isGstTaxable);
  };

  const saveEdit = async (t: Treatment) => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/treatments/${t.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: t.name, price: Number(draftPrice || 0), isGstTaxable: draftTaxable }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || 'Could not save that price');
      setTreatments((prev) =>
        prev.map((x) => (x.id === t.id ? { ...x, price: Number(draftPrice || 0), isGstTaxable: draftTaxable } : x)),
      );
      setEditingId(null);
    } catch (err: any) {
      addToast('error', err.message || 'Could not save that price');
    } finally {
      setSaving(false);
    }
  };

  const createTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch('/api/treatments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), price: Number(newPrice || 0), isGstTaxable: newTaxable }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || 'Could not add that treatment');
      addToast('success', `${newName.trim()} added`);
      setNewName('');
      setNewPrice('');
      setNewTaxable(false);
      setShowNew(false);
      load();
    } catch (err: any) {
      addToast('error', err.message || 'Could not add that treatment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 font-sans text-ink-primary">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">Treatments &amp; Prices</h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            What the clinic charges for. A treatment with no price bills at zero.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-ink-secondary/60 absolute left-3 top-2.5" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search treatments..."
              className={`${inputClass} pl-9`}
            />
          </div>
          <button
            onClick={() => setUnpricedOnly((v) => !v)}
            className={`px-3 py-2 text-xs font-medium rounded-md border transition-colors cursor-pointer shrink-0 ${
              unpricedOnly
                ? 'bg-triage-wait text-white border-triage-wait'
                : 'bg-surface-card text-ink-primary border-border hover:bg-surface-page'
            }`}
          >
            Needs a price
          </button>
          <button
            onClick={() =>
              exportToCsv('treatment-prices', treatments, [
                { key: 'name', label: 'Treatment' },
                { key: 'price', label: 'Price' },
                { key: 'isGstTaxable', label: 'GST Taxable' },
              ])
            }
            className="p-2 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border cursor-pointer shrink-0"
            title="Export price list"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowNew((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {!loading && unpricedCount > 0 && (
        <div className="bg-triage-wait/10 border border-triage-wait/25 rounded-[10px] p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-triage-wait shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-triage-wait">
              {unpricedCount} of {treatments.length} treatments have no price
            </p>
            <p className="text-ink-secondary mt-0.5">
              Visits using them bill at ₹0 and charge no GST. Click a price below to set it — the list saves as you go.
            </p>
          </div>
        </div>
      )}

      {showNew && (
        <form onSubmit={createTreatment} className="bg-surface-card p-4 rounded-[10px] border border-border shadow-xs">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="block eyebrow text-ink-secondary mb-1">Treatment name</label>
              <input required value={newName} onChange={(e) => setNewName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block eyebrow text-ink-secondary mb-1">Price (₹)</label>
              <input type="number" min="0" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block eyebrow text-ink-secondary mb-1">GST</label>
              <select value={newTaxable ? 'yes' : 'no'} onChange={(e) => setNewTaxable(e.target.value === 'yes')} className={inputClass}>
                <option value="no">Exempt</option>
                <option value="yes">Taxable (18%)</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" onClick={() => setShowNew(false)} className="px-3.5 py-1.5 text-xs font-medium text-ink-primary bg-surface-page border border-border rounded-md cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-3.5 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md cursor-pointer disabled:opacity-50">
              {saving ? 'Adding...' : 'Add treatment'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <div className="bg-surface-card rounded-[10px] border border-border p-12 text-center space-y-2">
          <p className="text-sm font-semibold">No treatments match</p>
          <p className="text-xs text-ink-secondary">
            {unpricedOnly ? 'Every treatment has a price — nothing left to do here.' : `Nothing matches "${search}".`}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-surface-card rounded-[10px] border border-border shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-page">
                  <tr className="border-b border-border text-ink-secondary font-medium">
                    <th className="py-2.5 px-4">Treatment</th>
                    <th className="py-2.5 px-4 text-right">Price</th>
                    <th className="py-2.5 px-4">GST</th>
                    <th className="py-2.5 px-4 text-right">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {visible.map((t) => {
                    const editing = editingId === t.id;
                    return (
                      <tr key={t.id} className={`hover:bg-surface-page/60 ${!t.price ? 'bg-triage-wait/5' : ''}`}>
                        <td className="py-2 px-4 font-medium max-w-[320px] truncate" title={t.name}>
                          {t.name}
                        </td>
                        <td className="py-2 px-4 text-right">
                          {editing ? (
                            <input
                              autoFocus
                              type="number"
                              min="0"
                              step="0.01"
                              value={draftPrice}
                              onChange={(e) => setDraftPrice(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit(t);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              className="w-28 px-2 py-1 rounded border border-brand text-xs bg-surface-card text-right font-mono focus:outline-none focus:ring-1 focus:ring-brand"
                            />
                          ) : (
                            <button
                              onClick={() => startEdit(t)}
                              className={`font-mono cursor-pointer hover:underline ${
                                t.price ? 'text-ink-primary' : 'text-triage-wait font-semibold'
                              }`}
                            >
                              {t.price ? money(t.price) : 'Set price'}
                            </button>
                          )}
                        </td>
                        <td className="py-2 px-4">
                          {editing ? (
                            <select
                              value={draftTaxable ? 'yes' : 'no'}
                              onChange={(e) => setDraftTaxable(e.target.value === 'yes')}
                              className="px-2 py-1 rounded border border-border text-xs bg-surface-card"
                            >
                              <option value="no">Exempt</option>
                              <option value="yes">Taxable</option>
                            </select>
                          ) : (
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${
                                t.isGstTaxable
                                  ? 'bg-triage-active/10 text-triage-active border-triage-active/25'
                                  : 'bg-surface-sunken text-ink-secondary border-border'
                              }`}
                            >
                              {t.isGstTaxable ? '18%' : 'Exempt'}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-right whitespace-nowrap">
                          {editing ? (
                            <span className="inline-flex gap-1">
                              <button
                                onClick={() => saveEdit(t)}
                                disabled={saving}
                                className="p-1.5 rounded text-white bg-brand hover:bg-brand-deep cursor-pointer disabled:opacity-50"
                                title="Save (Enter)"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 rounded text-ink-secondary bg-surface-page border border-border cursor-pointer"
                                title="Cancel (Esc)"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ) : (
                            <button
                              onClick={() => startEdit(t)}
                              className="p-1.5 rounded text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border cursor-pointer"
                              title="Edit price"
                            >
                              <IndianRupee className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};
