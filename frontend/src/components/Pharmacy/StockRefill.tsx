import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Plus, Minus, X, Check, Save, Truck, Package, Banknote } from 'lucide-react';

interface RefillItem {
  id: string; // temp id for UI
  medicineId: string;
  name: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  costPrice: number;
}

export const StockRefill: React.FC = () => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();

  const [medicines, setMedicines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [vendorName, setVendorName] = useState('');
  const [vendorGstn, setVendorGstn] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [items, setItems] = useState<RefillItem[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchMedicines = async () => {
      try {
        setLoading(true);
        const res = await apiFetch('/api/medicines');
        if (res.ok) {
          const data = await res.json();
          setMedicines(data);
        }
      } catch (err) {
        addToast('error', 'Failed to load medicines');
      } finally {
        setLoading(false);
      }
    };
    fetchMedicines();
  }, [apiFetch, addToast]);

  const addItem = (med: any) => {
    setItems([
      ...items,
      {
        id: Date.now().toString(),
        medicineId: med.id,
        name: med.name,
        batchNumber: '',
        expiryDate: '',
        quantity: 1,
        costPrice: 0,
      }
    ]);
    setSearch('');
  };

  const updateItem = (id: string, field: keyof RefillItem, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const totalValue = items.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);

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
      if (!item.batchNumber) return addToast('error', `Batch number required for ${item.name}`);
      if (!item.expiryDate) return addToast('error', `Expiry date required for ${item.name}`);
      if (item.quantity <= 0) return addToast('error', `Quantity must be > 0 for ${item.name}`);
      if (item.costPrice < 0) return addToast('error', `Cost price cannot be negative for ${item.name}`);
    }

    setSaving(true);
    try {
      const payload = {
        vendorName,
        vendorGstn,
        invoiceNumber,
        invoiceDate,
        totalValue,
        items: items.map(i => ({
          medicineId: i.medicineId,
          batchNumber: i.batchNumber,
          expiryDate: i.expiryDate,
          quantity: Number(i.quantity),
          costPrice: Number(i.costPrice)
        }))
      };

      const res = await apiFetch('/api/medicines/refill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit refill');

      addToast('success', 'Stock refilled and wholesaler bill sent to accounts!');
      
      // Reset form
      setVendorName('');
      setVendorGstn('');
      setInvoiceNumber('');
      setItems([]);
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredSearch = search.trim() 
    ? medicines.filter(m => m.name.toLowerCase().includes(search.toLowerCase())).slice(0, 5)
    : [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
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
              onChange={e => setVendorName(e.target.value)} 
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface-page focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm" 
              placeholder="e.g. PharmaCo Ltd"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Vendor GSTN</label>
            <input 
              type="text" 
              value={vendorGstn} 
              onChange={e => setVendorGstn(e.target.value)} 
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface-page focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm" 
              placeholder="e.g. 27AAAAA0000A1Z5"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Invoice Number *</label>
            <input 
              type="text" 
              value={invoiceNumber} 
              onChange={e => setInvoiceNumber(e.target.value)} 
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface-page focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm" 
              placeholder="INV-12345"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Invoice Date *</label>
            <input 
              type="date" 
              value={invoiceDate} 
              onChange={e => setInvoiceDate(e.target.value)} 
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface-page focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm" 
            />
          </div>
        </div>
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
          {search && (
            <div className="absolute z-10 w-full mt-1 bg-surface-card border border-border rounded-lg shadow-lg overflow-hidden">
              {filteredSearch.length > 0 ? (
                filteredSearch.map(m => (
                  <button
                    key={m.id}
                    onClick={() => addItem(m)}
                    className="w-full text-left px-4 py-3 hover:bg-brand-soft/20 text-sm font-medium text-ink-primary border-b border-border/50 last:border-0"
                  >
                    {m.name} <span className="text-ink-secondary text-xs ml-2">({m.stockQty} {m.unit} in stock)</span>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-ink-secondary">No medicines found</div>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-border text-ink-secondary">
                <th className="pb-2 font-semibold">Medicine</th>
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
                  <td colSpan={7} className="py-8 text-center text-ink-secondary">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    No items added to this refill bill yet.
                  </td>
                </tr>
              ) : items.map(item => (
                <tr key={item.id}>
                  <td className="py-3 font-semibold text-ink-primary">{item.name}</td>
                  <td className="py-3 pr-2">
                    <input 
                      type="text" 
                      value={item.batchNumber} 
                      onChange={e => updateItem(item.id, 'batchNumber', e.target.value)}
                      placeholder="BATCH-01"
                      className="w-full px-2 py-1.5 border border-border rounded text-xs bg-surface-page uppercase"
                    />
                  </td>
                  <td className="py-3 pr-2">
                    <input 
                      type="date" 
                      value={item.expiryDate} 
                      onChange={e => updateItem(item.id, 'expiryDate', e.target.value)}
                      className="w-full px-2 py-1.5 border border-border rounded text-xs bg-surface-page"
                    />
                  </td>
                  <td className="py-3 pr-2">
                    <input 
                      type="number" 
                      min="1"
                      value={item.quantity || ''} 
                      onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                      className="w-20 px-2 py-1.5 border border-border rounded text-xs bg-surface-page text-right float-right"
                    />
                  </td>
                  <td className="py-3 pr-2">
                    <input 
                      type="number"
                      step="0.01" 
                      min="0"
                      value={item.costPrice || ''} 
                      onChange={e => updateItem(item.id, 'costPrice', parseFloat(e.target.value) || 0)}
                      className="w-24 px-2 py-1.5 border border-border rounded text-xs bg-surface-page text-right float-right"
                    />
                  </td>
                  <td className="py-3 font-mono font-bold text-right text-brand-deep">
                    ₹{(item.quantity * item.costPrice).toFixed(2)}
                  </td>
                  <td className="py-3 text-right">
                    <button onClick={() => removeItem(item.id)} className="p-1.5 text-status-danger/70 hover:text-status-danger hover:bg-status-danger/10 rounded transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
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
