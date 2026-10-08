import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, Receipt, Check, Lock, AlertCircle, CreditCard, Banknote, Sparkles } from 'lucide-react';
import { VisitRecord } from '../Visits/VisitList';
import { money } from '../../utils/money';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onInvoiceGenerated: () => void;
}

export const GenerateInvoiceModal: React.FC<Props> = ({ isOpen, onClose, onInvoiceGenerated }) => {
  const { token , apiFetch } = useAuth();
  
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [selectedVisitId, setSelectedVisitId] = useState<string>('');
  const [selectedVisit, setSelectedVisit] = useState<VisitRecord | null>(null);
  
  const [taxableValue, setTaxableValue] = useState<number>(3500);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('bank');
  const [paymentRef, setPaymentRef] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasInteracted = useRef(false);

  useEffect(() => {
    if (isOpen) {
      hasInteracted.current = false;

      apiFetch('/api/visits')
        .then((res) => res.json())
        .then((result) => {
          const data = Array.isArray(result) ? result : (result.data || []);
          if (Array.isArray(data)) {
            setVisits(data);
            if (!hasInteracted.current && data.length > 0) {
              setSelectedVisitId(data[0].id);
              setSelectedVisit(data[0]);
              setTaxableValue(data[0].treatmentPrice || data[0].treatment?.price || 3500);
            }
          }
        });
    }
  }, [isOpen]);

  const handleVisitChange = (visitId: string) => {
    hasInteracted.current = true;
    setSelectedVisitId(visitId);
    const found = visits.find((v) => v.id === visitId);
    if (found) {
      setSelectedVisit(found);
      setTaxableValue(found.treatmentPrice || found.treatment?.price || 3500);
    }
  };

  // BUSINESS RULE 4 LIVE CALCULATOR:
  const isTaxable = selectedVisit ? selectedVisit.isGstTaxable : true;
  const cgstAmount = isTaxable ? Math.round(taxableValue * 0.09 * 100) / 100 : 0;
  const sgstAmount = isTaxable ? Math.round(taxableValue * 0.09 * 100) / 100 : 0;
  const totalAmount = Math.round((taxableValue + cgstAmount + sgstAmount) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisitId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify({
          visitId: selectedVisitId,
          taxableValue: Number(taxableValue),
          paymentMethod,
          paymentRef: paymentRef || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to generate invoice');

      onInvoiceGenerated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating GST invoice');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-xl w-full mx-2 sm:mx-0 my-4 sm:my-8 overflow-hidden">
        
        {/* Header */}
        <div className="bg-brand px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/10">
              <Receipt className="w-5 h-5 text-brand-soft" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Generate GST Tax Invoice</h2>
              <p className="text-xs text-white/80">Enforces Business Rule 4 intra-state CGST (9%) + SGST (9%) split</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {error && (
            <div className="p-3 rounded-lg bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs">
              {error}
            </div>
          )}

          {/* Select Visit */}
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Select Patient Visit Record <span className="text-status-danger">*</span>
            </label>
            <select
              required
              value={selectedVisitId}
              onChange={(e) => handleVisitChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border text-xs font-semibold bg-surface-card text-ink-primary"
            >
              {visits.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.date} — {v.patient?.name} ({v.patient?.uhid}) — {v.treatmentName}
                </option>
              ))}
            </select>
          </div>

          {/* Taxable Base Amount */}
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Procedure Base Value / Taxable Amount (₹) <span className="text-status-danger">*</span>
            </label>
            <input
              type="number"
              required
              min={0}
              step="any"
              value={taxableValue}
              onChange={(e) => setTaxableValue(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-border text-xs font-bold text-ink-primary bg-surface-card"
            />
          </div>

          {/* Business Rule 4 GST Calculator Box */}
          <div className="bg-surface-page border border-border rounded-xl p-4 space-y-2.5 border-l-2 border-l-brand">
            <div className="flex items-center justify-between text-xs font-bold text-ink-primary">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brand" /> Business Rule 4 GST Calculation
              </span>
              <span className={`px-2.5 py-0.5 rounded text-[11px] uppercase tracking-wider ${
                isTaxable ? 'bg-status-warning/10 text-status-warning border border-status-warning/20 font-extrabold' : 'bg-status-success/10 text-status-success border border-status-success/20 font-extrabold'
              }`}>
                {isTaxable ? 'Intra-State 18% GST (9% CGST + 9% SGST)' : '0% Exempt (Medical Care)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/80 text-xs">
              <div className="bg-surface-card p-2 rounded border border-border">
                <span className="text-[10px] text-ink-secondary block">Base Taxable Value</span>
                <span className="font-bold text-ink-primary">{money(taxableValue)}</span>
              </div>
              <div className="bg-surface-card p-2 rounded border border-border">
                <span className="text-[10px] text-ink-secondary block">CGST (9%)</span>
                <span className="font-bold text-ink-primary">{money(cgstAmount)}</span>
              </div>
              <div className="bg-surface-card p-2 rounded border border-border">
                <span className="text-[10px] text-ink-secondary block">SGST (9%)</span>
                <span className="font-bold text-ink-primary">{money(sgstAmount)}</span>
              </div>
              <div className="bg-brand-deep text-white p-2 rounded border border-brand-deep">
                <span className="text-[10px] text-brand-soft block">Final Total Invoice</span>
                <span className="font-extrabold text-sm">{money(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Method <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-3 pt-1">
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="payMethod"
                    value="bank"
                    checked={paymentMethod === 'bank'}
                    onChange={() => setPaymentMethod('bank')}
                    className="text-brand focus:ring-brand"
                  />
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded bg-brand/10 text-brand-soft border border-brand/20">
                    <CreditCard className="w-3.5 h-3.5" /> Bank / UPI
                  </span>
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                  <input
                    type="radio"
                    name="payMethod"
                    value="cash"
                    checked={paymentMethod === 'cash'}
                    onChange={() => setPaymentMethod('cash')}
                    className="text-brand focus:ring-brand"
                  />
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded bg-status-success/10 text-status-success border border-status-success/20">
                    <Banknote className="w-3.5 h-3.5" /> Cash
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Payment Ref / UTR / Cash Receipt #
              </label>
              <input
                type="text"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="e.g. UPI-9876543210 or Receipt #12"
                className="w-full px-3 py-2 rounded-lg border border-border text-xs bg-surface-card"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-ink-secondary hover:text-ink-primary rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Generating Invoice...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Issue GST Tax Invoice</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
