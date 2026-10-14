import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { PrintableInvoiceModal, InvoiceItem } from '../Invoices/PrintableInvoiceModal';
import { PrintablePatientBill, PatientBill } from './PrintablePatientBill';
import { Receipt, Printer, FileText, Repeat } from 'lucide-react';
import { money } from '../../utils/money';
import { PaymentModeFields } from '../common/payment/PaymentModeFields';
import {
  PAYMENT_MODE_LABEL,
  PaymentDetailsDraft,
  PaymentMode,
  missingPaymentDetail,
  toPaymentDetails,
} from '../common/payment/paymentModes';

interface QueueEntry {
  id: string;
  tokenNumber: number;
  status: string;
  careType?: string;
  isRegular: boolean;
  patient: { id: string; name: string; phone: string };
  doctor?: { name: string };
  visitId?: string | null;
  careOrders?: { id: string }[];
  bills?: QueueBill[];
}

interface QueueBill {
  kind: 'PATIENT' | 'PHARMACY';
  billNumber: string;
  paymentStatus: 'PAID' | 'UNPAID';
  paymentMode?: PaymentMode | null;
  paidAmount?: number | string | null;
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
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetailsDraft>({});
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
    const missing = missingPaymentDetail(paymentMode, paymentDetails);
    if (missing) {
      addToast('error', missing);
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
          paymentMode,
          paymentDetails: toPaymentDetails(paymentMode, paymentDetails),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not record payment');

      addToast('success', `Payment recorded — invoice ${data.invoiceNumber}`);
      setPrinting(data); // Open the printable receipt straight away.
      setVisitId('');
      setTaxableValue('');
      setPaymentDetails({});
      load();
    } catch (err: any) {
      addToast('error', err.message || 'Could not record payment');
    } finally {
      setSubmitting(false);
    }
  };

  // Show a bill, keeping the list's paid/unpaid badge in step with it.
  const showBill = (saved: PatientBill) => {
    setBill(saved);
    setEncounters((prev) =>
      prev.map((q) =>
        q.id !== saved.queueId
          ? q
          : {
              ...q,
              bills: [
                ...(q.bills ?? []).filter((b) => b.kind !== saved.kind),
                {
                  kind: saved.kind,
                  billNumber: saved.billNumber,
                  paymentStatus: saved.paymentStatus,
                  paymentMode: saved.paymentMode,
                  paidAmount: saved.paidAmount,
                },
              ],
            },
      ),
    );
  };

  /** After a bill is paid or un-paid its invoice appears in / leaves the receipts list. */
  const refreshReceipts = async () => {
    try {
      const res = await apiFetch('/api/invoices?pageSize=10');
      const data = await res.json();
      setRecent((Array.isArray(data) ? data : data.data || []).slice(0, 8));
    } catch {
      // Non-fatal — the list refreshes on next visit.
    }
  };

  // Visits that came through today's queue are paid on their Patient Bill, not here.
  const queueVisitIds = new Set(encounters.map((q) => q.visitId).filter(Boolean));
  const looseVisits = visits.filter((v) => !queueVisitIds.has(v.id));

  const gstPreview =selectedVisit?.isGstTaxable ? Number(taxableValue || 0) * 0.18 : 0;

  const billBadge = (b: QueueBill | undefined, label: string) => {
    if (!b) return null;
    const paid = b.paymentStatus === 'PAID';
    return (
      <span
        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${
          paid
            ? 'bg-status-success/10 text-status-success border-status-success/20'
            : 'bg-status-danger/10 text-status-danger border-status-danger/20'
        }`}
        title={b.billNumber}
      >
        {label}: {paid ? `Paid ${money(b.paidAmount)}${b.paymentMode ? ` · ${PAYMENT_MODE_LABEL[b.paymentMode]}` : ''}` : 'Unpaid'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-ink-primary">Payments</h3>
        <p className="text-xs text-ink-secondary mt-0.5">
          Open a patient's bill, take payment by cash, UPI, card or online, and print it. A paid bill becomes a GST
          invoice with the same number, so it shows in Accounts and Invoices.
        </p>
      </div>

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : (
        <>
          {/* Consolidated bill for a whole encounter — treatment plus everything the
              doctor ordered, on one printable sheet. This is where reception takes payment. */}
          <div>
            <h4 className="text-xs font-semibold text-ink-secondary mb-2">Today's patient bills</h4>
            {encounters.length === 0 ? (
              <div className="text-ink-secondary text-xs py-6 text-center bg-surface-page rounded-lg border border-border">
                No patients checked in today. Bills appear here once reception checks someone in.
              </div>
            ) : (
              <div className="space-y-2">
                {encounters.map((q) => (
                  <div key={q.id} className="bg-surface-page p-3 rounded-lg border border-border flex flex-wrap items-center justify-between gap-3">
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
                    <div className="flex flex-wrap items-center gap-2 ml-auto">
                      {billBadge(q.bills?.find((x) => x.kind === 'PATIENT'), 'Bill')}
                      {billBadge(q.bills?.find((x) => x.kind === 'PHARMACY'), 'Pharmacy')}
                      <button
                        onClick={async () => {
                          setLoadingBillFor(q.id);
                          try {
                            const res = await apiFetch(`/api/queue/${q.id}/bill`);
                            if (!res.ok) throw new Error('Could not build the bill');
                            showBill(await res.json());
                          } catch (err: any) {
                            addToast('error', err.message || 'Could not build the bill');
                          } finally {
                            setLoadingBillFor(null);
                          }
                        }}
                        disabled={loadingBillFor === q.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-white bg-brand hover:bg-brand-deep rounded cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        <FileText className="w-3 h-3" />
                        {loadingBillFor === q.id ? 'Loading...' : 'Patient Bill'}
                      </button>
                    </div>
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
                        {inv.itemTitle} • <span className="font-semibold text-ink-primary">{money(inv.totalAmount)}</span> •{' '}
                        {inv.paymentMode ? PAYMENT_MODE_LABEL[inv.paymentMode] : inv.paymentMethod}
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

          {/* For day-book visits entered directly (not checked in through the queue),
              which therefore have no Patient Bill. */}
          <details className="bg-surface-page rounded-lg border border-border">
            <summary className="px-4 py-3 text-xs font-semibold text-ink-primary cursor-pointer select-none">
              Collect payment for a visit not checked in through the queue
            </summary>
            <form onSubmit={handleCollect} className="px-4 pb-4 space-y-3">
              <p className="text-[11px] text-ink-secondary">
                For day-book visits logged directly. Patients checked in today are paid on their Patient Bill above.
              </p>
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Visit <span className="text-status-danger">*</span>
                </label>
                <select required value={visitId} onChange={(e) => setVisitId(e.target.value)} className={inputClass}>
                  <option value="">Select the visit being paid for</option>
                  {looseVisits.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.date} — {v.patient?.name} — {v.treatmentName} [{v.visitType}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:w-1/3">
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
                <label className="block text-xs font-semibold text-ink-secondary mb-1">Payment mode</label>
                <PaymentModeFields
                  mode={paymentMode}
                  details={paymentDetails}
                  onModeChange={setPaymentMode}
                  onDetailsChange={setPaymentDetails}
                  disabled={submitting}
                />
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
          </details>
        </>
      )}

      <PrintableInvoiceModal invoice={printing} onClose={() => setPrinting(null)} />
      <PrintablePatientBill
        bill={bill}
        onClose={() => setBill(null)}
        onChange={(saved) => {
          showBill(saved);
          refreshReceipts();
        }}
      />
    </div>
  );
};
