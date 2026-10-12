import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { X, Save, Truck, Package, Banknote, Plus, Check, AlertTriangle, Sparkles, Settings2 } from 'lucide-react';
import {
  CATEGORY_LABEL,
  COMMON_MEDICINES,
  COMMON_UNITS,
  CommonMedicine,
  DEFAULT_CATEGORY_RACK,
  MedicineCategory,
} from './commonMedicines';

interface RefillItem {
  id: string; // temp id for UI
  /** Set for catalogue medicines; empty for one that will be created on submit. */
  medicineId: string;
  name: string;
  /** New-medicine fields — only used when medicineId is empty. */
  unit: string;
  sellingPrice: number;
  shelf: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  costPrice: number;
}

interface CatalogueMedicine {
  id: string;
  name: string;
  unit: string;
  stockQty: number;
  reorderPoint: number;
  shelf?: string | null;
  isActive: boolean;
}

export interface StockRefillProps {
  prefillPurchase?: {
    id: string;
    vendorName: string;
    vendorGstn?: string;
    invoiceNumber: string;
    invoiceDate: string;
  };
  onComplete?: () => void;
  onCancel?: () => void;
}

type QuickTab = 'low' | 'common';

const RACKS_KEY = 'hms.refill.categoryRacks';

/** The pharmacist's rack per category, remembered on this computer. */
function loadCategoryRacks(): Record<MedicineCategory, string> {
  try {
    const saved = JSON.parse(localStorage.getItem(RACKS_KEY) || '{}');
    return { ...DEFAULT_CATEGORY_RACK, ...saved };
  } catch {
    return { ...DEFAULT_CATEGORY_RACK };
  }
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const cellInput = 'w-full px-2 py-1.5 border border-border rounded text-xs bg-surface-page';

export const StockRefill: React.FC<StockRefillProps> = ({ prefillPurchase, onComplete, onCancel }) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();

  const [medicines, setMedicines] = useState<CatalogueMedicine[]>([]);
  const [saving, setSaving] = useState(false);

  // Form State
  const [vendorName, setVendorName] = useState(prefillPurchase?.vendorName || '');
  const [vendorGstn, setVendorGstn] = useState(prefillPurchase?.vendorGstn || '');
  const [invoiceNumber, setInvoiceNumber] = useState(prefillPurchase?.invoiceNumber || '');
  const [invoiceDate, setInvoiceDate] = useState(prefillPurchase?.invoiceDate || new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<RefillItem[]>([]);
  const [search, setSearch] = useState('');

  // Quick add
  const [quickTab, setQuickTab] = useState<QuickTab>('low');
  const [category, setCategory] = useState<MedicineCategory | 'ALL'>('ALL');
  const [categoryRacks, setCategoryRacks] = useState(loadCategoryRacks);
  const [editingRacks, setEditingRacks] = useState(false);

  const fetchMedicines = async () => {
    try {
      const res = await apiFetch('/api/medicines');
      if (res.ok) setMedicines(await res.json());
    } catch {
      addToast('error', 'Failed to load medicines');
    }
  };

  useEffect(() => {
    fetchMedicines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiFetch, addToast]);

  const updateCategoryRack = (cat: MedicineCategory, rack: string) => {
    const next = { ...categoryRacks, [cat]: rack };
    setCategoryRacks(next);
    try {
      localStorage.setItem(RACKS_KEY, JSON.stringify(next));
    } catch {
      // Storage blocked — the racks still apply for this session.
    }
  };

  /** Which preset a catalogue medicine matches, so it can fall back to that category's rack. */
  const categoryOf = (name: string) => COMMON_MEDICINES.find((c) => sameName(c.name, name))?.category;

  const newRow = (fields: Partial<RefillItem> & { name: string }): RefillItem => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    medicineId: '',
    unit: '',
    sellingPrice: 0,
    shelf: '',
    batchNumber: '',
    expiryDate: '',
    quantity: 1,
    costPrice: 0,
    ...fields,
  });

  const rowForCatalogue = (med: CatalogueMedicine) => {
    const cat = categoryOf(med.name);
    return newRow({
      medicineId: med.id,
      name: med.name,
      unit: med.unit,
      // The medicine's existing rack wins; a known preset falls back to its category rack.
      shelf: med.shelf || (cat ? categoryRacks[cat] : ''),
      // Low-stock lines default to topping back up past the reorder point.
      quantity: med.stockQty <= med.reorderPoint ? Math.max(1, med.reorderPoint * 2 - med.stockQty) : 1,
    });
  };

  const addItem = (med: CatalogueMedicine) => {
    setItems((prev) => [...prev, rowForCatalogue(med)]);
    setSearch('');
  };

  /** A preset: reuse the catalogue entry if one exists, otherwise create it on submit. */
  const addCommon = (c: CommonMedicine) => {
    const existing = medicines.find((med) => sameName(med.name, c.name));
    if (existing) {
      setItems((prev) => [...prev, { ...rowForCatalogue(existing), shelf: existing.shelf || categoryRacks[c.category] }]);
    } else {
      setItems((prev) => [...prev, newRow({ name: c.name, unit: c.unit, shelf: categoryRacks[c.category] })]);
    }
  };

  const addNewByName = (name: string) => {
    setItems((prev) => [...prev, newRow({ name: name.trim(), unit: 'tablet' })]);
    setSearch('');
  };

  const updateItem = (id: string, field: keyof RefillItem, value: any) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const lowStock = useMemo(
    () => medicines.filter((m) => m.isActive && m.stockQty <= m.reorderPoint).sort((a, b) => a.stockQty - b.stockQty),
    [medicines],
  );
  const isAdded = (name: string) => items.some((i) => sameName(i.name, name));
  const lowStockToAdd = lowStock.filter((m) => !isAdded(m.name));

  const commonShown = COMMON_MEDICINES.filter((c) => category === 'ALL' || c.category === category);

  // Every rack already in use, offered as suggestions in the Rack column.
  const knownRacks = useMemo(
    () =>
      Array.from(
        new Set([...medicines.map((m) => m.shelf).filter(Boolean), ...Object.values(categoryRacks).filter(Boolean)] as string[]),
      ).sort(),
    [medicines, categoryRacks],
  );

  const totalValue = items.reduce((sum, item) => sum + item.quantity * item.costPrice, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName || !invoiceNumber || !invoiceDate) {
      addToast('error', 'Please fill in all vendor and invoice details');
      return;
    }
    if (items.length === 0) {
      addToast('error', 'Please add at least one item');
      return;
    }

    // validate items
    for (const item of items) {
      if (!item.medicineId && !item.unit.trim()) return addToast('error', `Unit required for new medicine ${item.name}`);
      if (!item.batchNumber) return addToast('error', `Batch number required for ${item.name}`);
      if (!item.expiryDate) return addToast('error', `Expiry date required for ${item.name}`);
      if (item.quantity <= 0) return addToast('error', `Quantity must be > 0 for ${item.name}`);
      if (item.costPrice < 0) return addToast('error', `Cost price cannot be negative for ${item.name}`);
    }

    setSaving(true);
    try {
      const payload = {
        purchaseId: prefillPurchase?.id,
        vendorName,
        vendorGstn,
        invoiceNumber,
        invoiceDate,
        totalValue,
        items: items.map((i) => ({
          ...(i.medicineId
            ? { medicineId: i.medicineId }
            : { newMedicine: { name: i.name, unit: i.unit.trim(), unitPrice: Number(i.sellingPrice) || 0 } }),
          shelf: i.shelf.trim() || undefined,
          batchNumber: i.batchNumber,
          expiryDate: i.expiryDate,
          quantity: Number(i.quantity),
          costPrice: Number(i.costPrice),
        })),
      };

      const res = await apiFetch('/api/medicines/refill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Failed to submit refill');

      const created = items.filter((i) => !i.medicineId).length;
      addToast(
        'success',
        `Stock refilled${created ? `, ${created} new medicine${created > 1 ? 's' : ''} added to the catalogue` : ''} — wholesaler bill sent to accounts!`,
      );

      // Reset form
      setVendorName('');
      setVendorGstn('');
      setInvoiceNumber('');
      setItems([]);
      fetchMedicines();

      if (onComplete) onComplete();
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredSearch = search.trim()
    ? medicines.filter((m) => m.name.toLowerCase().includes(search.toLowerCase())).slice(0, 5)
    : [];
  const exactMatch = medicines.some((m) => sameName(m.name, search));

  const chipClass = (added: boolean) =>
    `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${
      added
        ? 'bg-brand-soft/40 border-brand/30 text-brand-deep cursor-default'
        : 'bg-surface-card border-border text-ink-primary hover:border-brand hover:bg-brand-soft/20 cursor-pointer'
    }`;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-surface-card rounded-xl border border-border shadow-sm p-5">
        <h2 className="text-lg font-bold text-ink-primary flex items-center gap-2 mb-4">
          <Truck className="w-5 h-5 text-brand" /> Wholesaler Bill (Stock Refill)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Vendor / Supplier Name *</label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              disabled={!!prefillPurchase}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface-page focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm disabled:opacity-50"
              placeholder="e.g. PharmaCo Ltd"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Vendor GSTN</label>
            <input
              type="text"
              value={vendorGstn}
              onChange={(e) => setVendorGstn(e.target.value)}
              disabled={!!prefillPurchase}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface-page focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm disabled:opacity-50"
              placeholder="e.g. 27AAAAA0000A1Z5"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Invoice Number *</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              disabled={!!prefillPurchase}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface-page focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm disabled:opacity-50"
              placeholder="INV-12345"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Invoice Date *</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              disabled={!!prefillPurchase}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface-page focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* Quick add — one click per line for what usually arrives on a refill. */}
      <div className="bg-surface-card rounded-xl border border-border shadow-sm p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-surface-page p-1 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setQuickTab('low')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                quickTab === 'low' ? 'bg-surface-card text-brand-deep shadow-xs' : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Low stock ({lowStock.length})
            </button>
            <button
              type="button"
              onClick={() => setQuickTab('common')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer ${
                quickTab === 'common' ? 'bg-surface-card text-brand-deep shadow-xs' : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Common medicines
            </button>
          </div>

          {quickTab === 'low' ? (
            <button
              type="button"
              disabled={lowStockToAdd.length === 0}
              onClick={() => setItems((prev) => [...prev, ...lowStockToAdd.map(rowForCatalogue)])}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" /> Add all low stock ({lowStockToAdd.length})
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditingRacks((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-primary bg-surface-card hover:bg-surface-page border border-border rounded-md cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" /> {editingRacks ? 'Done' : 'Set rack per category'}
            </button>
          )}
        </div>

        {quickTab === 'low' ? (
          lowStock.length === 0 ? (
            <p className="text-xs text-ink-secondary py-2">Nothing is at or below its reorder point.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {lowStock.map((m) => {
                const added = isAdded(m.name);
                return (
                  <button key={m.id} type="button" disabled={added} onClick={() => addItem(m)} className={chipClass(added)}>
                    {added ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {m.name}
                    <span className={`text-[10px] font-semibold ${m.stockQty === 0 ? 'text-status-danger' : 'text-status-warning'}`}>
                      {m.stockQty} left
                    </span>
                    {m.shelf && <span className="text-[10px] text-ink-secondary">· {m.shelf}</span>}
                  </button>
                );
              })}
            </div>
          )
        ) : (
          <>
            {editingRacks && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-3 rounded-lg bg-surface-page border border-border">
                {(Object.keys(CATEGORY_LABEL) as MedicineCategory[]).map((cat) => (
                  <div key={cat}>
                    <label className="block text-[10px] font-semibold text-ink-secondary mb-1">{CATEGORY_LABEL[cat]}</label>
                    <input
                      type="text"
                      value={categoryRacks[cat]}
                      onChange={(e) => updateCategoryRack(cat, e.target.value)}
                      className={cellInput}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {(['ALL', ...Object.keys(CATEGORY_LABEL)] as (MedicineCategory | 'ALL')[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer ${
                    category === cat ? 'bg-brand text-white border-brand' : 'bg-surface-card text-ink-secondary border-border hover:text-ink-primary'
                  }`}
                >
                  {cat === 'ALL' ? 'All' : `${CATEGORY_LABEL[cat]} · ${categoryRacks[cat] || 'no rack'}`}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {commonShown.map((c) => {
                const added = isAdded(c.name);
                const inCatalogue = medicines.some((m) => sameName(m.name, c.name));
                return (
                  <button key={c.name} type="button" disabled={added} onClick={() => addCommon(c)} className={chipClass(added)}>
                    {added ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    {c.name}
                    {!inCatalogue && (
                      <span className="text-[9px] font-bold uppercase px-1 rounded bg-status-warning/10 text-status-warning border border-status-warning/20">
                        New
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-ink-secondary">
              Items marked <span className="font-semibold text-status-warning">New</span> aren't in your catalogue yet — they are added
              automatically when you submit this bill, on the rack shown.
            </p>
          </>
        )}
      </div>

      <div className="bg-surface-card rounded-xl border border-border shadow-sm p-5">
        <h3 className="text-md font-bold text-ink-primary mb-4">Stock Items</h3>

        <div className="relative mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search medicine to add to bill..."
            className="w-full px-4 py-3 border border-border rounded-lg bg-surface-page text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
          />
          {search.trim() && (
            <div className="absolute z-10 w-full mt-1 bg-surface-card border border-border rounded-lg shadow-lg overflow-hidden">
              {filteredSearch.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => addItem(m)}
                  className="w-full text-left px-4 py-3 hover:bg-brand-soft/20 text-sm font-medium text-ink-primary border-b border-border/50 last:border-0"
                >
                  {m.name}{' '}
                  <span className="text-ink-secondary text-xs ml-2">
                    ({m.stockQty} {m.unit} in stock{m.shelf ? ` · ${m.shelf}` : ''})
                  </span>
                </button>
              ))}
              {!exactMatch && (
                <button
                  type="button"
                  onClick={() => addNewByName(search)}
                  className="w-full text-left px-4 py-3 hover:bg-brand-soft/20 text-sm font-medium text-brand-deep inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add "{search.trim()}" as a new medicine
                </button>
              )}
            </div>
          )}
        </div>

        <datalist id="refill-racks">
          {knownRacks.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <datalist id="refill-units">
          {COMMON_UNITS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-border text-ink-secondary">
                <th className="pb-2 font-semibold">Medicine</th>
                <th className="pb-2 font-semibold">Rack</th>
                <th className="pb-2 font-semibold">Batch No.</th>
                <th className="pb-2 font-semibold">Expiry Date</th>
                <th className="pb-2 font-semibold text-right">Quantity</th>
                <th className="pb-2 font-semibold text-right">Cost/Unit</th>
                <th className="pb-2 font-semibold text-right">Total</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-ink-secondary">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    No items added to this refill bill yet.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="py-3 pr-2 min-w-[200px]">
                      <div className="font-semibold text-ink-primary flex items-center gap-1.5">
                        {item.name}
                        {!item.medicineId && (
                          <span className="text-[9px] font-bold uppercase px-1 rounded bg-status-warning/10 text-status-warning border border-status-warning/20">
                            New
                          </span>
                        )}
                      </div>
                      {!item.medicineId && (
                        <div className="flex gap-1.5 mt-1.5">
                          <input
                            type="text"
                            list="refill-units"
                            value={item.unit}
                            onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                            placeholder="Unit"
                            title="Dispensing unit (tablet, tube, bottle…)"
                            className={`${cellInput} w-24`}
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.sellingPrice || ''}
                            onChange={(e) => updateItem(item.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                            placeholder="Sell ₹/unit"
                            title="Selling price per unit at the counter"
                            className={`${cellInput} w-24`}
                          />
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-2">
                      <input
                        type="text"
                        list="refill-racks"
                        value={item.shelf}
                        onChange={(e) => updateItem(item.id, 'shelf', e.target.value)}
                        placeholder="e.g. Rack A"
                        className={`${cellInput} w-28`}
                      />
                    </td>
                    <td className="py-3 pr-2">
                      <input
                        type="text"
                        value={item.batchNumber}
                        onChange={(e) => updateItem(item.id, 'batchNumber', e.target.value)}
                        placeholder="BATCH-01"
                        className={`${cellInput} uppercase`}
                      />
                    </td>
                    <td className="py-3 pr-2">
                      <input
                        type="date"
                        value={item.expiryDate}
                        onChange={(e) => updateItem(item.id, 'expiryDate', e.target.value)}
                        className={cellInput}
                      />
                    </td>
                    <td className="py-3 pr-2">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity || ''}
                        onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                        className={`${cellInput} w-20 text-right float-right`}
                      />
                    </td>
                    <td className="py-3 pr-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.costPrice || ''}
                        onChange={(e) => updateItem(item.id, 'costPrice', parseFloat(e.target.value) || 0)}
                        className={`${cellInput} w-24 text-right float-right`}
                      />
                    </td>
                    <td className="py-3 font-mono font-bold text-right text-brand-deep">₹{(item.quantity * item.costPrice).toFixed(2)}</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 text-status-danger/70 hover:text-status-danger hover:bg-status-danger/10 rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-between items-center pt-4 border-t border-border">
          <div className="flex items-center gap-3 text-ink-secondary text-sm">
            <Banknote className="w-5 h-5 text-emerald-500" />
            This bill will be automatically sent to the Accounts department.
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wider mb-1">Total Bill Value</p>
            <p className="text-3xl font-bold text-brand-deep">₹{totalValue.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-6 py-3 bg-surface-page hover:bg-surface-card border border-border text-ink-primary font-semibold rounded-lg shadow-sm transition-all"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={saving || items.length === 0}
          className="flex items-center gap-2 px-6 py-3 bg-brand hover:bg-brand-deep text-white font-semibold rounded-lg shadow-md transition-all disabled:opacity-50"
        >
          {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-5 h-5" />}
          Submit Stock Refill
        </button>
      </div>
    </div>
  );
};
