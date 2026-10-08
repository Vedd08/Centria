import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { ShoppingCart, Plus, Search, RefreshCw, X, Info } from 'lucide-react';
import { money } from '../../utils/money';

type ItcEligibility = 'Full' | 'Mixed Use' | 'Ineligible';
type InputClassification = 'Capital Goods' | 'Consumables' | 'Medicine Stock' | 'Other';

const INPUT_CLASSIFICATIONS: InputClassification[] = [
  'Capital Goods',
  'Consumables',
  'Medicine Stock',
  'Other',
];
const ITC_ELIGIBILITIES: ItcEligibility[] = ['Full', 'Mixed Use', 'Ineligible'];

export interface PurchaseItem {
  id: string;
  vendorName: string;
  vendorGstn: string;
  invoiceNumber: string;
  invoiceDate: string;
  itemDescription: string;
  inputClassification: string;
  itcEligibility: string;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  totalValue: number;
  recordedBy?: { name: string; role: string };
}

interface ItcBucket {
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  totalTax: number;
  count: number;
}

interface ItcSummary {
  purchaseCount: number;
  fullyClaimableTax: number;
  apportionableTax: number;
  ineligibleTax: number;
  byClassification: Record<string, ItcBucket>;
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

const eligibilityVariant = (e: string) =>
  e === 'Full' ? 'success' : e === 'Mixed Use' ? 'warning' : 'danger';


export const PurchaseList: React.FC = () => {
  const { token, hasRole , apiFetch } = useAuth();

  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [summary, setSummary] = useState<ItcSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [vendorName, setVendorName] = useState('');
  const [vendorGstn, setVendorGstn] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [itemDescription, setItemDescription] = useState('');
  const [inputClassification, setInputClassification] =
    useState<InputClassification>('Consumables');
  const [itcEligibility, setItcEligibility] = useState<ItcEligibility>('Full');
  const [taxableValue, setTaxableValue] = useState(0);
  // Intra-state supplies split tax into CGST + SGST; inter-state carry IGST instead.
  const [supplyType, setSupplyType] = useState<'intra' | 'inter'>('intra');
  const [gstRate, setGstRate] = useState(18);

  const authHeaders = useMemo(() => ({ }), []);

  // Derived tax preview, mirroring what the server will compute and store.
  const totalTax = Math.round(taxableValue * (gstRate / 100) * 100) / 100;
  const igst = supplyType === 'inter' ? totalTax : 0;
  const cgst = supplyType === 'intra' ? Math.round((totalTax / 2) * 100) / 100 : 0;
  const sgst = cgst;
  const totalValue = Math.round((taxableValue + igst + cgst + sgst) * 100) / 100;

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resPurchases, resSummary] = await Promise.all([
        apiFetch('/api/purchases', { headers: authHeaders }),
        apiFetch('/api/purchases/itc-summary', { headers: authHeaders }),
      ]);

      const dataPurchases = await resPurchases.json();
      if (!resPurchases.ok) {
        throw new Error(dataPurchases.message || 'Failed to load purchase register');
      }
      setPurchases(Array.isArray(dataPurchases) ? dataPurchases : []);

      if (resSummary.ok) {
        setSummary(await resSummary.json());
      }
    } catch (err: any) {
      setError(err.message || 'Could not reach the purchases service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await apiFetch('/api/purchases', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorName: vendorName.trim(),
          vendorGstn: vendorGstn.trim(),
          invoiceNumber: invoiceNumber.trim(),
          invoiceDate,
          itemDescription: itemDescription.trim(),
          inputClassification,
          itcEligibility,
          taxableValue: Number(taxableValue),
          igst,
          cgst,
          sgst,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          Array.isArray(data.message) ? data.message.join('; ') : data.message || 'Failed to record purchase',
        );
      }

      setIsAddOpen(false);
      setVendorName('');
      setVendorGstn('');
      setInvoiceNumber('');
      setItemDescription('');
      setTaxableValue(0);
      fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Error recording purchase');
    } finally {
      setSubmitting(false);
    }
  };

  const visible = purchases.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.vendorName.toLowerCase().includes(q) ||
      p.vendorGstn.toLowerCase().includes(q) ||
      p.invoiceNumber.toLowerCase().includes(q) ||
      p.itemDescription.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-4.5 h-4.5 text-brand" /> Vendor Purchase Register
          </h2>
          <p className="hidden sm:block text-xs text-ink-secondary mt-0.5">
            Inward supply invoices classified for GST input tax credit.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 text-ink-secondary/60 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Vendor, GSTIN, invoice..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-border text-xs focus:outline-none focus:ring-1 focus:ring-brand bg-surface-card"
            />
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border transition-colors cursor-pointer shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {hasRole('ACCOUNT', 'MASTER', 'SUPER_ADMIN') && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Record Purchase</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs">
          {error}
        </div>
      )}

      {/* ITC Summary */}
      {summary && (
        <div className="bg-surface-card rounded-[10px] border border-border p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight">Input Tax Credit Position</h3>
            <span className="text-xs text-ink-secondary font-mono">
              {summary.purchaseCount} invoice(s)
            </span>
          </div>
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border/60">
            <div className="flex-1 p-3">
              <div className="text-xs font-medium text-ink-secondary">Fully Claimable</div>
              <div className="text-[22px] font-bold font-mono leading-tight text-status-success">
                {money(summary.fullyClaimableTax)}
              </div>
            </div>
            <div className="flex-1 p-3">
              <div className="text-xs font-medium text-ink-secondary">
                Needs Apportionment (Mixed Use)
              </div>
              <div className="text-[22px] font-bold font-mono leading-tight text-status-warning">
                {money(summary.apportionableTax)}
              </div>
            </div>
            <div className="flex-1 p-3">
              <div className="text-xs font-medium text-ink-secondary">Ineligible</div>
              <div className="text-[22px] font-bold font-mono leading-tight text-ink-secondary">
                {money(summary.ineligibleTax)}
              </div>
            </div>
          </div>

          {Object.keys(summary.byClassification).length > 0 && (
            <div className="pt-3 border-t border-border/60 flex flex-wrap gap-2">
              {Object.entries(summary.byClassification).map(([cls, bucket]) => (
                <span
                  key={cls}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-surface-page border border-border text-ink-secondary"
                >
                  {cls}: <span className="font-mono font-semibold text-ink-primary">{money(bucket.totalTax)}</span>{' '}
                  tax on {bucket.count}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Register table */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold tracking-tight">
          Purchase Invoices ({visible.length} shown)
        </h3>

        {loading ? (
          <LoadingSkeleton rows={5} />
        ) : visible.length === 0 ? (
          <div className="bg-surface-card rounded-[10px] border border-border p-8 text-center text-xs text-ink-secondary shadow-xs">
            {purchases.length === 0
              ? 'No vendor purchases recorded yet.'
              : 'No purchases match the current search.'}
          </div>
        ) : (
          <div className="bg-surface-card rounded-[10px] border border-border overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-page border-b border-border text-ink-secondary font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Invoice Date</th>
                    <th className="py-3.5 px-4">Vendor (GSTIN)</th>
                    <th className="py-3.5 px-4">Item / Description</th>
                    <th className="py-3.5 px-4">Classification</th>
                    <th className="py-3.5 px-4 text-right">Taxable</th>
                    <th className="py-3.5 px-4 text-right">Tax</th>
                    <th className="py-3.5 px-4 text-right">Total</th>
                    <th className="py-3.5 px-4">ITC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {visible.map((p) => {
                    const tax = p.igst + p.cgst + p.sgst;
                    return (
                      <tr key={p.id} className="hover:bg-surface-page/60 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-ink-secondary">{p.invoiceDate}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-ink-primary">{p.vendorName}</div>
                          <div className="font-mono text-[11px] text-ink-secondary">
                            {p.vendorGstn}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-ink-primary">{p.itemDescription}</div>
                          <div className="font-mono text-[11px] text-ink-secondary">
                            {p.invoiceNumber}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-ink-secondary">{p.inputClassification}</td>
                        <td className="py-3.5 px-4 text-right font-mono">{money(p.taxableValue)}</td>
                        <td className="py-3.5 px-4 text-right font-mono">
                          <div>{money(tax)}</div>
                          <div className="text-[10px] text-ink-secondary">
                            {p.igst > 0 ? 'IGST' : 'CGST + SGST'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold">
                          {money(p.totalValue)}
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusBadge
                            label={p.itcEligibility}
                            variant={eligibilityVariant(p.itcEligibility) as any}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Record Purchase Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface-card rounded-[10px] border border-border p-6 max-w-xl w-full space-y-4 shadow-xl mx-2 sm:mx-0 my-4 sm:my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-brand" /> Record Vendor Purchase
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

            <form onSubmit={handleAddPurchase} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Vendor Name <span className="text-status-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="e.g. Dermaline Medical Supplies"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Vendor GSTIN <span className="text-status-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={vendorGstn}
                    onChange={(e) => setVendorGstn(e.target.value.toUpperCase())}
                    placeholder="29AABCD1234E1Z5"
                    className={`${inputClass} font-mono`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Vendor Invoice No. <span className="text-status-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="DML/2026/0417"
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Invoice Date <span className="text-status-danger">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Item / Description <span className="text-status-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="e.g. Botulinum Toxin 100U vials (batch of 5)"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Input Classification
                  </label>
                  <select
                    value={inputClassification}
                    onChange={(e) => setInputClassification(e.target.value as InputClassification)}
                    className={inputClass}
                  >
                    {INPUT_CLASSIFICATIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    ITC Eligibility
                  </label>
                  <select
                    value={itcEligibility}
                    onChange={(e) => setItcEligibility(e.target.value as ItcEligibility)}
                    className={inputClass}
                  >
                    {ITC_ELIGIBILITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Taxable Value (₹) <span className="text-status-danger">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="any"
                    value={taxableValue}
                    onChange={(e) => setTaxableValue(Number(e.target.value))}
                    className={`${inputClass} font-mono`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    Supply Type
                  </label>
                  <select
                    value={supplyType}
                    onChange={(e) => setSupplyType(e.target.value as 'intra' | 'inter')}
                    className={inputClass}
                  >
                    <option value="intra">Intra-state (CGST + SGST)</option>
                    <option value="inter">Inter-state (IGST)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">
                    GST Rate (%)
                  </label>
                  <select
                    value={gstRate}
                    onChange={(e) => setGstRate(Number(e.target.value))}
                    className={inputClass}
                  >
                    {[0, 5, 12, 18, 28].map((r) => (
                      <option key={r} value={r}>
                        {r}%
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tax preview */}
              <div className="bg-surface-page border border-border rounded-md p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-ink-primary">
                  <Info className="w-3.5 h-3.5 text-brand" /> Computed Tax Breakdown
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-surface-card p-2 rounded border border-border">
                    <span className="text-[10px] text-ink-secondary block">Taxable</span>
                    <span className="font-mono font-semibold">{money(taxableValue)}</span>
                  </div>
                  {supplyType === 'inter' ? (
                    <div className="bg-surface-card p-2 rounded border border-border">
                      <span className="text-[10px] text-ink-secondary block">IGST</span>
                      <span className="font-mono font-semibold">{money(igst)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="bg-surface-card p-2 rounded border border-border">
                        <span className="text-[10px] text-ink-secondary block">CGST</span>
                        <span className="font-mono font-semibold">{money(cgst)}</span>
                      </div>
                      <div className="bg-surface-card p-2 rounded border border-border">
                        <span className="text-[10px] text-ink-secondary block">SGST</span>
                        <span className="font-mono font-semibold">{money(sgst)}</span>
                      </div>
                    </>
                  )}
                  <div className="bg-brand text-white p-2 rounded border border-brand">
                    <span className="text-[10px] text-white/80 block">Invoice Total</span>
                    <span className="font-mono font-bold">{money(totalValue)}</span>
                  </div>
                </div>
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
                  {submitting ? 'Recording...' : 'Record Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
