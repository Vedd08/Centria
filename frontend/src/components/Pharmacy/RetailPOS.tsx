import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Search, Plus, Minus, X, Receipt, Banknote, CreditCard, ShoppingBag, PauseCircle, PlayCircle, Pill, Box, AlertTriangle, Printer, User } from 'lucide-react';
import { money } from '../Queue/types';

interface RetailCartItem {
  medicineId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  maxStock: number;
  unit: string;
}

interface CartSession {
  id: string;
  items: RetailCartItem[];
  customerName: string;
  customerPhone: string;
  paymentMethod: 'cash' | 'bank';
  paymentRef: string;
}

export const RetailPOS: React.FC<{ onInvoiceGenerated: (invoice: any) => void }> = ({ onInvoiceGenerated }) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();

  const [medicines, setMedicines] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Cart Sessions (Hold Cart feature)
  const [sessions, setSessions] = useState<CartSession[]>([{
    id: '1', items: [], customerName: '', customerPhone: '', paymentMethod: 'cash', paymentRef: ''
  }]);
  const [activeId, setActiveId] = useState<string>('1');

  const activeSession = sessions.find(s => s.id === activeId) || sessions[0];

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch medicines
  useEffect(() => {
    const fetchMedicines = async () => {
      try {
        setLoading(true);
        const res = await apiFetch('/api/medicines');
        if (res.ok) {
          const data = await res.json();
          setMedicines(data.filter((m: any) => m.isActive && m.stockQty > 0));
        }
      } catch (err) {
        addToast('error', 'Failed to load medicines');
      } finally {
        setLoading(false);
      }
    };
    fetchMedicines();
  }, [apiFetch, addToast]);

  // Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'F2') {
        e.preventDefault();
        handleCheckout();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSearch('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sessions, activeId]); // re-bind when session changes so F2 has fresh data

  // Focus search on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const updateActiveSession = (updater: (s: CartSession) => CartSession) => {
    setSessions(prev => prev.map(s => s.id === activeId ? updater(s) : s));
  };

  const addToCart = (med: any) => {
    updateActiveSession(session => {
      const existing = session.items.find(item => item.medicineId === med.id);
      if (existing) {
        if (existing.quantity >= med.stockQty) {
          addToast('error', `Max stock (${med.stockQty}) reached for ${med.name}`);
          return session;
        }
        return {
          ...session,
          items: session.items.map(item => 
            item.medicineId === med.id 
              ? { ...item, quantity: item.quantity + 1 } 
              : item
          )
        };
      }
      return {
        ...session,
        items: [...session.items, {
          medicineId: med.id,
          name: med.name,
          unitPrice: Number(med.unitPrice) || 0,
          quantity: 1,
          maxStock: med.stockQty,
          unit: med.unit
        }]
      };
    });
  };

  const updateCartQty = (id: string, delta: number) => {
    updateActiveSession(session => ({
      ...session,
      items: session.items.map(item => {
        if (item.medicineId !== id) return item;
        const newQty = item.quantity + delta;
        if (newQty < 1 || newQty > item.maxStock) return item;
        return { ...item, quantity: newQty };
      })
    }));
  };

  const setExactCartQty = (id: string, qty: number) => {
    updateActiveSession(session => ({
      ...session,
      items: session.items.map(item => {
        if (item.medicineId !== id) return item;
        if (qty < 1) qty = 1;
        if (qty > item.maxStock) qty = item.maxStock;
        return { ...item, quantity: qty };
      })
    }));
  }

  const removeFromCart = (id: string) => {
    updateActiveSession(session => ({
      ...session,
      items: session.items.filter(item => item.medicineId !== id)
    }));
  };

  const holdCart = () => {
    const newId = Date.now().toString();
    setSessions(prev => [...prev, {
      id: newId, items: [], customerName: '', customerPhone: '', paymentMethod: 'cash', paymentRef: ''
    }]);
    setActiveId(newId);
    searchInputRef.current?.focus();
  };

  const closeCart = (id: string) => {
    if (sessions.length === 1) {
      // Just clear it
      updateActiveSession(() => ({
        id: '1', items: [], customerName: '', customerPhone: '', paymentMethod: 'cash', paymentRef: ''
      }));
    } else {
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeId === id) {
        setActiveId(sessions.find(s => s.id !== id)!.id);
      }
    }
  };

  const handleCheckout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (activeSession.items.length === 0) {
      addToast('error', 'Cart is empty');
      return;
    }
    setProcessing(true);

    try {
      const payload = {
        customerName: activeSession.customerName.trim() || undefined,
        customerPhone: activeSession.customerPhone.trim() || undefined,
        paymentMethod: activeSession.paymentMethod,
        paymentRef: activeSession.paymentRef.trim() || undefined,
        items: activeSession.items.map(c => ({
          medicineId: c.medicineId,
          quantity: c.quantity,
          unitPrice: c.unitPrice
        }))
      };

      const res = await apiFetch('/api/retail-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Checkout failed');

      addToast('success', 'Retail sale completed');
      onInvoiceGenerated(data);
      closeCart(activeSession.id);
    } catch (err: any) {
      addToast('error', err.message || 'Checkout failed');
    } finally {
      setProcessing(false);
    }
  };

  const cartTotal = activeSession.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
  
  const filteredMeds = useMemo(() => {
    if (!search.trim()) return medicines.slice(0, 16); // Show some defaults
    const lower = search.toLowerCase();
    return medicines
      .filter(m => m.name.toLowerCase().includes(lower) || m.shelf?.toLowerCase().includes(lower))
      .slice(0, 24);
  }, [search, medicines]);

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-[calc(100vh-200px)] min-h-[600px] bg-surface-page/50 rounded-xl p-2">
      
      {/* LEFT: Product Catalog */}
      <div className="flex-[3] flex flex-col gap-4">
        
        {/* Top Bar: Search & Session Tabs */}
        <div className="flex items-center gap-4 bg-surface-card p-3 rounded-xl border border-border shadow-sm">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-brand absolute left-3 top-2.5" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Scan barcode or type to search... (F1)"
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 border-brand/20 bg-brand-soft/5 text-sm focus:outline-none focus:ring-0 focus:border-brand transition-colors text-ink-primary font-medium"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-3 text-ink-secondary hover:text-ink-primary">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Held Carts / Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar">
            {sessions.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`relative group flex items-center gap-2 px-3 py-2 rounded-lg border transition-all shrink-0 ${
                  activeId === s.id 
                    ? 'bg-brand text-white border-brand shadow-md scale-[1.02]' 
                    : 'bg-surface-page text-ink-secondary border-border hover:bg-brand-soft hover:text-brand-deep'
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="text-xs font-bold">Cart {idx + 1}</span>
                {s.items.length > 0 && (
                  <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                    activeId === s.id ? 'bg-white text-brand' : 'bg-brand/10 text-brand'
                  }`}>
                    {s.items.length}
                  </span>
                )}
                {sessions.length > 1 && (
                  <span onClick={(e) => { e.stopPropagation(); closeCart(s.id); }} className="ml-1 opacity-50 hover:opacity-100">
                    <X className="w-3 h-3" />
                  </span>
                )}
              </button>
            ))}
            <button 
              onClick={holdCart}
              title="Hold Cart & Start New"
              className="p-2.5 rounded-lg border border-dashed border-ink-secondary/50 text-ink-secondary hover:text-brand hover:border-brand transition-colors shrink-0"
            >
              <PauseCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 bg-surface-card rounded-xl border border-border shadow-sm p-4 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-full text-ink-secondary font-medium">Loading catalog...</div>
          ) : filteredMeds.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-ink-secondary">
              <Search className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-medium">No items found matching "{search}"</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredMeds.map(m => {
                const isTablet = ['tablet', 'capsule'].includes(m.unit.toLowerCase());
                const lowStock = m.stockQty <= m.reorderPoint;
                
                return (
                  <div 
                    key={m.id} 
                    onClick={() => addToCart(m)}
                    className="group relative flex flex-col p-4 rounded-xl border-2 border-transparent bg-surface-page shadow-sm hover:border-brand/40 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer overflow-hidden"
                  >
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-brand/5 rounded-full blur-xl group-hover:bg-brand/10 transition-colors" />
                    
                    <div className="flex justify-between items-start mb-3 relative z-10">
                      <div className={`p-2 rounded-lg ${isTablet ? 'bg-sky-500/10 text-sky-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        {isTablet ? <Pill className="w-6 h-6" /> : <Box className="w-6 h-6" />}
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-lg text-ink-primary tracking-tight">{money(m.unitPrice)}</p>
                      </div>
                    </div>
                    
                    <div className="relative z-10">
                      <h4 className="font-bold text-sm text-ink-primary line-clamp-1" title={m.name}>{m.name}</h4>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${
                          lowStock ? 'bg-rose-500/10 text-rose-600' : 'bg-surface-card text-ink-secondary border border-border'
                        }`}>
                          {lowStock && <AlertTriangle className="w-3 h-3" />}
                          {m.stockQty} {m.unit}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-ink-secondary/60 bg-surface-card px-1.5 py-0.5 rounded border border-border/50">
                          {m.shelf || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Receipt Tape Cart */}
      <div className="flex-[2] flex flex-col bg-surface-card rounded-xl border-l-[8px] border-l-brand shadow-lg overflow-hidden relative">
        {/* Zig-zag receipt top edge */}
        <div className="absolute top-0 left-0 w-full h-2" style={{
          backgroundImage: 'linear-gradient(45deg, transparent 50%, #fff 50%), linear-gradient(-45deg, transparent 50%, #fff 50%)',
          backgroundSize: '10px 10px',
          backgroundRepeat: 'repeat-x',
          zIndex: 10
        }} />

        {/* Customer Header */}
        <div className="p-5 pt-6 bg-[#fafafa] border-b border-border/50">
          <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-border/60 shadow-sm focus-within:border-brand focus-within:ring-1 focus-within:ring-brand transition-all">
            <User className="w-5 h-5 text-brand shrink-0 ml-1" />
            <div className="flex-1 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Walk-in Customer Name"
                value={activeSession.customerName}
                onChange={e => updateActiveSession(s => ({ ...s, customerName: e.target.value }))}
                className="w-full text-sm bg-transparent border-none focus:ring-0 p-0 text-ink-primary placeholder:text-ink-secondary/60 font-medium"
              />
              <div className="hidden sm:block w-px h-5 bg-border my-auto" />
              <input
                type="text"
                placeholder="Phone (Opt)"
                value={activeSession.customerPhone}
                onChange={e => updateActiveSession(s => ({ ...s, customerPhone: e.target.value }))}
                className="w-full sm:w-32 text-sm bg-transparent border-none focus:ring-0 p-0 text-ink-primary placeholder:text-ink-secondary/60 font-mono"
              />
            </div>
          </div>
        </div>
        
        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-2 bg-[#fafafa]">
          {activeSession.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-ink-secondary/50">
              <Receipt className="w-16 h-16 mb-4 stroke-[1]" />
              <p className="font-medium text-sm">Cart is empty</p>
              <p className="text-xs mt-1">Scan or search items to begin</p>
            </div>
          ) : (
            <div className="space-y-1">
              {activeSession.items.map((item, index) => (
                <div key={item.medicineId} className="group flex flex-col p-3 rounded-lg bg-white border border-border/40 shadow-sm hover:border-brand/30 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex gap-2 items-start">
                      <span className="text-xs font-bold text-ink-secondary w-4 pt-0.5">{index + 1}.</span>
                      <div>
                        <span className="font-bold text-sm text-ink-primary leading-tight line-clamp-1">{item.name}</span>
                        <span className="text-[11px] text-ink-secondary font-mono">{money(item.unitPrice)} / {item.unit}</span>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-brand-deep text-sm">{money(item.quantity * item.unitPrice)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center mt-3 pl-6">
                    <div className="flex items-center h-8 bg-surface-page rounded-md border border-border/80 overflow-hidden">
                      <button onClick={() => updateCartQty(item.medicineId, -1)} className="w-8 h-full flex items-center justify-center text-ink-secondary hover:bg-surface-card hover:text-brand transition-colors"><Minus className="w-3 h-3" /></button>
                      <input 
                        type="number" 
                        value={item.quantity}
                        onChange={(e) => setExactCartQty(item.medicineId, parseInt(e.target.value) || 1)}
                        className="w-10 h-full text-center text-sm font-mono font-bold border-x border-border/80 bg-white p-0 focus:ring-0 focus:outline-none hide-arrows"
                      />
                      <button onClick={() => updateCartQty(item.medicineId, 1)} className="w-8 h-full flex items-center justify-center text-ink-secondary hover:bg-surface-card hover:text-brand transition-colors"><Plus className="w-3 h-3" /></button>
                    </div>
                    
                    <button onClick={() => removeFromCart(item.medicineId)} className="text-ink-secondary/50 hover:text-status-danger hover:bg-status-danger/10 p-1.5 rounded transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checkout Footer */}
        <div className="bg-white border-t-2 border-dashed border-border p-5">
          <div className="flex justify-between items-end mb-4">
            <span className="text-sm font-bold text-ink-secondary uppercase tracking-wider">Total</span>
            <span className="font-mono text-3xl font-extrabold text-brand-deep leading-none">{money(cartTotal)}</span>
          </div>

          <div className="flex gap-2 mb-4">
            {(['cash', 'bank'] as const).map((m) => (
              <button
                key={m}
                onClick={() => updateActiveSession(s => ({ ...s, paymentMethod: m }))}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border-2 font-bold transition-all ${
                  activeSession.paymentMethod === m
                    ? 'border-brand bg-brand-soft/20 text-brand-deep'
                    : 'border-border bg-surface-card text-ink-secondary hover:border-border-hover'
                }`}
              >
                {m === 'cash' ? <Banknote className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                {m === 'cash' ? 'CASH' : 'CARD/UPI'}
              </button>
            ))}
          </div>

          <button
            onClick={handleCheckout}
            disabled={activeSession.items.length === 0 || processing}
            className="w-full flex items-center justify-center gap-3 py-4 bg-brand hover:bg-brand-deep text-white font-bold text-lg rounded-xl shadow-lg shadow-brand/30 transition-all disabled:opacity-50 disabled:shadow-none hover:-translate-y-0.5 active:translate-y-0"
          >
            {processing ? (
              <span className="animate-pulse">Processing...</span>
            ) : (
              <>
                <Printer className="w-6 h-6" />
                CHECKOUT (F2)
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Remove global numeric input arrows visually */}
      <style>{`
        .hide-arrows::-webkit-outer-spin-button,
        .hide-arrows::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .hide-arrows {
          -moz-appearance: textfield;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};
