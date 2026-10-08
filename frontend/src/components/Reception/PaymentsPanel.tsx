import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { PrintableInvoiceModal, InvoiceItem } from '../Invoices/PrintableInvoiceModal';
import { PrintablePatientBill, PatientBill } from './PrintablePatientBill';
import { Receipt, Printer, Banknote, CreditCard, FileText, Repeat } from 'lucide-react';
import { money } from '../../utils/money';

interface QueueEntry {
  id: string;
  tokenNumber: number;
  status: string;
  careType?: string;
  isRegular: boolean;
  patient: { id: string; name: string; phone: string };
  doctor?: { name: string };
  careOrders?: { id: string }[];
}

interface VisitOption {
  id: string;
  date: string;
  visitType: string;
  treatmentName: string;
  treatmentPrice: number;
  isGstTaxable: boolean;
  patient: { id: string; name: string; phone: string; uhid: string };
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';


/**
 * Collect payment against a visit and hand the patient a printable GST receipt.
 * Reuses the same invoice record and print layout as the Invoices module.
 */
export const PaymentsPanel: React.FC = () => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();

  const [visits, setVisits] = useState<VisitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [visitId, setVisitId] = useState('');
  const [taxableValue, setTaxableValue] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [recent, setRecent] = useState<InvoiceItem[]>([]);
  const [printing, setPrinting] = useState<InvoiceItem | null>(null);
  const [encounters, setEncounters] = useState<QueueEntry[]>([]);
  const [bill, setBill] = useState<PatientBill | null>(null);
  const [loadingBillFor, setLoadingBillFor] = useState<string | null>(null);

  const selectedVisit = visits.find((v) => v.id === visitId) || null;

  const load = async () => {
    setLoading(true);
    try {
      const [visitsRes, invoicesRes, queueRes] = await Promise.all([
        apiFetch('/api/visits?pageSize=40'),
        apiFetch('/api/invoices?pageSize=10'),
        apiFetch('/api/queue'),
      ]);
      const vData = await visitsRes.json();
      const iData = await invoicesRes.json();
      const qData = await queueRes.json();
      setVisits(Array.isArray(vData) ? vData : vData.data || []);
      const invoices = Array.isArray(iData) ? iData : iData.data || [];
      setRecent(invoices.slice(0, 8));
      setEncounters(Array.isArray(qData) ? qData : qData.data || []);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Default the amount to the treatment's list price when a visit is picked.
  useEffect(() => {
    if (selectedVisit) setTaxableValue(String(selectedVisit.treatmentPrice || ''));
  }, [visitId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitId || !taxableValue) {
      addToast('error', 'Pick a visit and enter an amount');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitId,
          taxableValue: Number(taxableValue),
          paymentMethod,
          paymentRef: paymentRef.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not record payment');

      addToast('success', `Payment recorded — invoice ${data.invoiceNumber}`);
      setPrinting(data); // Open the printable receipt straight away.
      setVisitId('');
      setTaxableValue('');
      setPaymentRef('');
      load();
    } catch (err: any) {
      addToast('error', err.message || 'Could not record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const gstPreview = selectedVisit?.isGstTaxable ? Number(taxableValue || 0) * 0.18 : 0;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-ink-primary">Collect Payment</h3>
        <p className="text-xs text-ink-secondary mt-0.5">
          Record what the patient paid and print their receipt. GST is applied automatically for taxable treatments.
        </p>
      </div>

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : (
        <>
          <form onSubmit={handleCollect} className="bg-surface-page p-4 rounded-lg border border-border space-y-3">
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Visit <span className="text-status-danger">*</span>
              </label>
              <select required value={visitId} onChange={(e) => setVisitId(e.target.value)} className={inputClass}>
                <option value="">Select the visit being paid for</option>
                {visits.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.date} — {v.patient?.name} — {v.treatmentName} [{v.visitType}]
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Amount (₹) <span className="text-status-danger">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={taxableValue}
                  onChange={(e) => setTaxableValue(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">Method</label>
                <div className="flex gap-2">
                  {(['cash', 'bank'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                        paymentMethod === m
                          ? 'bg-brand text-white border-brand shadow-xs'
                          : 'bg-surface-card text-ink-primary border-border hover:bg-surface-page'
                      }`}
                    >
                      {m === 'cash' ? <Banknote className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
                      {m === 'cash' ? 'Cash' : 'Bank'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">Payment Ref</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="UTR / receipt no."
                  className={inputClass}
                />
              </div>
            </div>

            {selectedVisit && taxableValue && (
              <div className="p-2.5 rounded-md bg-surface-card border border-border text-xs flex flex-wrap gap-x-5 gap-y-1">
                <span className="text-ink-secondary">
                  Taxable <span className="font-semibold text-ink-primary">{money(Number(taxableValue))}</span>
                </span>
                <span className="text-ink-secondary">
                  GST{' '}
                  <span className="font-semibold text-ink-primary">
                    {selectedVisit.isGstTaxable ? money(gstPreview) : 'Exempt'}
                  </span>
                </span>
                <span className="text-ink-secondary">
                  Total{' '}
                  <span className="font-semibold text-brand-deep">{money(Number(taxableValue) + gstPreview)}</span>
                </span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>{submitting ? 'Recording...' : 'Record & Print Receipt'}</span>
              </button>
            </div>
          </form>

          {/* Consolidated bill for a whole encounter — treatment plus everything the
              doctor ordered, on one printable sheet. */}
          <div>
            <h4 className="text-xs font-semibold text-ink-secondary mb-2">Today's patient bills</h4>
            {encounters.length === 0 ? (
              <div className="text-ink-secondary text-xs py-6 text-center bg-surface-page rounded-lg border border-border">
                No patients checked in today. Bills appear here once reception checks someone in.
              </div>
            ) : (
              <div className="space-y-2">
                {encounters.map((q) => (
                  <div key={q.id} className="bg-surface-page p-3 rounded-lg border border-border flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-ink-primary">
                        <span className="font-mono text-brand-deep">#{q.tokenNumber}</span> {q.patient?.name}
                        {q.isRegular && (
                          <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-soft text-brand-deep border border-brand/20">
                            <Repeat className="w-2.5 h-2.5" /> Regular
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-ink-secondary">
                        {q.patient?.phone}
                        {q.careType && ` • ${q.careType}`}
                        {q.doctor && ` • ${q.doctor.name}`}
                        {` • ${q.careOrders?.length ?? 0} order(s)`}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        setLoadingBillFor(q.id);
                        try {
                          const res = await apiFetch(`/api/queue/${q.id}/bill`);
                          if (!res.ok) throw new Error('Could not build the bill');
                          setBill(await res.json());
                        } catch (err: any) {
                          addToast('error', err.message || 'Could not build the bill');
                        } finally {
                          setLoadingBillFor(null);
                        }
                      }}
                      disabled={loadingBillFor === q.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-ink-primary bg-surface-card hover:bg-surface-page border border-border rounded cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      <FileText className="w-3 h-3" />
                      {loadingBillFor === q.id ? 'Loading...' : 'Patient Bill'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-xs font-semibold text-ink-secondary mb-2">Recent receipts</h4>
            {recent.length === 0 ? (
              <div className="text-ink-secondary text-xs py-6 text-center bg-surface-page rounded-lg border border-border">
                No payments recorded yet.
              </div>
            ) : (
              <div className="space-y-2">
                {recent.map((inv) => (
                  <div key={inv.id} className="bg-surface-page p-3 rounded-lg border border-border flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-ink-primary">
                        {inv.patientName} <span className="font-mono text-ink-secondary">· {inv.invoiceNumber}</span>
                      </p>
                      <p className="text-[11px] text-ink-secondary">
                        {inv.itemTitle} • {money(inv.totalAmount)} • {inv.paymentMethod}
                      </p>
                    </div>
                    <button
                      onClick={() => setPrinting(inv)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-ink-primary bg-surface-card hover:bg-surface-page border border-border rounded cursor-pointer shrink-0"
                    >
                      <Printer className="w-3 h-3" />
                      Print
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <PrintableInvoiceModal invoice={printing} onClose={() => setPrinting(null)} />
      <PrintablePatientBill bill={bill} onClose={() => setBill(null)} />
    </div>
  );
};
