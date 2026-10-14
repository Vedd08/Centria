import React, { useEffect, useState } from 'react';
import { X, Printer, Save } from 'lucide-react';
import { money } from '../../utils/money';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { BrandLogo } from '../common/BrandLogo';
import { useClinicProfile } from '../../hooks/useClinicProfile';
import { PrintPortal } from '../common/PrintPortal';
import { PaymentModeFields } from '../common/payment/PaymentModeFields';
import { PaymentDetailsBlock } from '../common/payment/PaymentDetailsBlock';
import {
  PAYMENT_MODE_LABEL,
  PaymentDetails,
  PaymentDetailsDraft,
  PaymentMode,
  missingPaymentDetail,
  toPaymentDetails,
  toPaymentDraft,
} from '../common/payment/paymentModes';

export interface BillLine {
  description: string;
  kind: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxable: boolean;
  hsnCode?: string;
  taxRate?: number;
}

export type BillPaymentStatus = 'PAID' | 'UNPAID';

export interface PatientBill {
  /** PATIENT — reception's bill; PHARMACY — the OPD medicines bill from the pharmacy counter. */
  kind: 'PATIENT' | 'PHARMACY';
  queueId: string;
  tokenNumber: number;
  queueDate: string;
  billNumber: string;
  paymentStatus: BillPaymentStatus;
  paymentMode?: PaymentMode | null;
  paymentDetails?: PaymentDetails | null;
  paidAt?: string | null;
  receivedBy?: string | null;
  careType?: string;
  patient: { name: string; phone: string; uhid: string; address?: string };
  doctor?: { name: string };
  lines: BillLine[];
  subTotal: number;
  taxableValue: number;
  exemptValue: number;
  cgstRate: number;
  sgstRate: number;
  cgst: number;
  sgst: number;
  totalAmount: number;
  /** What was collected when the bill was marked paid (0 while unpaid). */
  paidAmount?: number;
  /** Charges added after payment that are still owed. */
  balanceDue?: number;
  /** Pharmacy bill only: ordered medicines not yet handed over — listed, not charged. */
  pendingLines?: BillLine[];
}


const KIND_LABEL: Record<string, string> = {
  CONSULTATION: 'Consultation',
  TREATMENT: 'Treatment',
  MEDICINE: 'Medicine',
  INJECTION: 'Injection',
  OTHER: 'Service',
};

interface Props {
  bill: PatientBill | null;
  onClose: () => void;
  /** Receives the refreshed bill after the payment status is saved. */
  onChange: (bill: PatientBill) => void;
}

/**
 * The bill the patient takes away for one encounter, on one sheet. Reception's
 * PATIENT bill carries the consultation, treatment and services (plus medicines for
 * inpatients); the pharmacy counter's PHARMACY bill carries an OPD patient's medicines.
 */
export const PrintablePatientBill: React.FC<Props> = ({ bill, onClose, onChange }) => {
  const clinic = useClinicProfile();
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<BillPaymentStatus>('UNPAID');
  const [mode, setMode] = useState<PaymentMode>('CASH');
  const [details, setDetails] = useState<PaymentDetailsDraft>({});

  // Start the form from what was last saved whenever a bill is opened or saved.
  useEffect(() => {
    if (!bill) return;
    setStatus(bill.paymentStatus);
    setMode(bill.paymentMode ?? 'CASH');
    setDetails(toPaymentDraft(bill.paymentDetails));
  }, [bill]);

  if (!bill) return null;

  const isPharmacy = bill.kind === 'PHARMACY';
  const title = isPharmacy ? 'Pharmacy Bill' : 'Patient Bill';

  const savePayment = async () => {
    if (status === 'PAID') {
      const missing = missingPaymentDetail(mode, details);
      if (missing) {
        addToast('error', missing);
        return;
      }
    }
    setSaving(true);
    try {
      const path = isPharmacy ? 'pharmacy-bill' : 'bill';
      const res = await apiFetch(`/api/queue/${bill.queueId}/${path}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          status === 'PAID' ? { status, mode, details: toPaymentDetails(mode, details) } : { status },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Could not update payment');
      addToast('success', status === 'PAID' ? `${title} marked paid (${PAYMENT_MODE_LABEL[mode]})` : `${title} marked unpaid`);
      onChange(data);
    } catch (err: any) {
      addToast('error', err.message || 'Could not update payment');
    } finally {
      setSaving(false);
    }
  };

  const isPaid = bill.paymentStatus === 'PAID';
  const toggleClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer disabled:opacity-50 ${
      active ? 'bg-brand text-white border-brand shadow-xs' : 'bg-surface-card text-ink-primary border-border hover:bg-surface-page'
    }`;

  return (
    <PrintPortal>
      <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto print:static print:bg-white print:p-0 print:block print:overflow-visible print:backdrop-blur-none">
      <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-2xl w-full my-8 print:my-0 print:shadow-none print:border-0 print:max-w-none print:rounded-none print:overflow-visible">
        {/* Screen-only toolbar */}
        <div className="flex items-center justify-between p-4 border-b border-border print:hidden">
          <span className="text-xs font-semibold text-ink-primary">
            {title} — Token #{bill.tokenNumber} ({bill.queueDate})
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button onClick={onClose} className="p-1.5 rounded text-ink-secondary hover:text-ink-primary cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Screen-only payment controls. Nothing changes on the bill until Save. */}
        <div className="px-4 py-3 border-b border-border bg-surface-page space-y-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-ink-secondary mr-1">Payment</span>
            <button type="button" disabled={saving} onClick={() => setStatus('UNPAID')} className={toggleClass(status === 'UNPAID')}>
              Unpaid
            </button>
            <button type="button" disabled={saving} onClick={() => setStatus('PAID')} className={toggleClass(status === 'PAID')}>
              Paid
            </button>
            <span className="text-xs text-ink-secondary ml-2">
              {isPaid && (bill.balanceDue ?? 0) > 0 ? (
                <>
                  Paid {money(bill.paidAmount)} · <span className="font-semibold text-status-danger">balance {money(bill.balanceDue)}</span> — Save again to collect
                </>
              ) : isPaid ? (
                <>Collected <span className="font-semibold text-status-success">{money(bill.paidAmount)}</span></>
              ) : (
                <>To collect <span className="font-semibold text-ink-primary">{money(bill.totalAmount)}</span></>
              )}
            </span>
            <button
              type="button"
              disabled={saving}
              onClick={savePayment}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save payment'}
            </button>
          </div>
          {status === 'PAID' && (
            <PaymentModeFields
              mode={mode}
              details={details}
              onModeChange={setMode}
              onDetailsChange={setDetails}
              disabled={saving}
            />
          )}
        </div>

        <div className="p-8 print:p-6 text-ink-primary">
          <div className="text-center border-b-2 border-ink-primary pb-4 mb-5">
            <h1 className="text-xl font-bold tracking-tight uppercase">{clinic?.name ?? ''}</h1>
            {clinic?.address && <p className="text-[11px] text-ink-secondary mt-0.5">{clinic.address}</p>}
            {(clinic?.phone || clinic?.email) && (
              <p className="text-[11px] text-ink-secondary">
                {[clinic?.phone, clinic?.email].filter(Boolean).join('  ·  ')}
              </p>
            )}
            <p className="text-xs font-semibold mt-2 tracking-wider uppercase">{title}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs mb-5">
            <div className="space-y-1">
              <div>
                <span className="text-ink-secondary">Patient: </span>
                <span className="font-semibold">{bill.patient.name}</span>
              </div>
              <div>
                <span className="text-ink-secondary">Mobile: </span>
                <span className="font-mono">{bill.patient.phone}</span>
              </div>
              <div>
                <span className="text-ink-secondary">UHID: </span>
                <span className="font-mono">{bill.patient.uhid}</span>
              </div>
              <div>
                <span className="text-ink-secondary">Token: </span>
                <span className="font-mono font-semibold">#{bill.tokenNumber}</span>
              </div>
            </div>
            <div className="space-y-1 sm:text-right">
              <div>
                <span className="text-ink-secondary">Date: </span>
                <span className="font-mono">{bill.queueDate}</span>
              </div>
              <div>
                <span className="text-ink-secondary">Invoice No: </span>
                <span className="font-mono font-semibold">{bill.billNumber}</span>
              </div>
              <div>
                <span className="text-ink-secondary">Payment: </span>
                <span className={`font-semibold ${isPaid ? 'text-status-success' : 'text-status-danger'}`}>
                  {isPaid ? 'PAID' : 'UNPAID'}
                </span>
                {isPaid && bill.paymentMode && <span> ({PAYMENT_MODE_LABEL[bill.paymentMode]})</span>}
              </div>
              {bill.careType && (
                <div>
                  <span className="text-ink-secondary">Type: </span>
                  <span className="font-semibold">{bill.careType}</span>
                </div>
              )}
              {bill.doctor && (
                <div>
                  <span className="text-ink-secondary">Doctor: </span>
                  <span>{bill.doctor.name}</span>
                </div>
              )}
            </div>
          </div>

          <table className="w-full text-xs border-collapse mb-4">
            <thead>
              <tr className="border-y border-ink-primary/30">
                <th className="text-left py-2">Item</th>
                <th className="text-left py-2">HSN/SAC</th>
                <th className="text-right py-2">Qty</th>
                <th className="text-right py-2">Rate</th>
                <th className="text-right py-2">GST %</th>
                <th className="text-right py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bill.lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-ink-secondary">
                    {isPharmacy ? 'No medicines ordered for this encounter.' : 'Nothing billed for this encounter yet.'}
                  </td>
                </tr>
              ) : (
                bill.lines.map((l, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td className="py-2 font-medium">
                      {l.description}
                      <div className="text-[10px] text-ink-secondary font-normal mt-0.5">{KIND_LABEL[l.kind] || l.kind}</div>
                    </td>
                    <td className="py-2 text-ink-secondary font-mono text-[11px]">{l.hsnCode || '-'}</td>
                    <td className="py-2 text-right font-mono">{l.quantity}</td>
                    <td className="py-2 text-right font-mono">{money(l.unitPrice)}</td>
                    <td className="py-2 text-right font-mono">{l.taxable ? `${l.taxRate ?? 18}%` : 'Exempt'}</td>
                    <td className="py-2 text-right font-mono">{money(l.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-full sm:w-64 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-ink-secondary">Sub Total</span>
                <span className="font-mono">{money(bill.subTotal)}</span>
              </div>
              {bill.exemptValue > 0 && (
                <div className="flex justify-between text-ink-secondary">
                  <span>GST Exempt</span>
                  <span className="font-mono">{money(bill.exemptValue)}</span>
                </div>
              )}
              {bill.taxableValue > 0 && (
                <>
                  <div className="flex justify-between text-ink-secondary">
                    <span>Taxable Value</span>
                    <span className="font-mono">{money(bill.taxableValue)}</span>
                  </div>
                  <div className="flex justify-between text-ink-secondary">
                    <span>Total CGST</span>
                    <span className="font-mono">{money(bill.cgst)}</span>
                  </div>
                  <div className="flex justify-between text-ink-secondary">
                    <span>Total SGST</span>
                    <span className="font-mono">{money(bill.sgst)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t-2 border-ink-primary pt-2 mt-2 text-sm font-bold">
                <span>TOTAL</span>
                <span className="font-mono text-brand-deep">{money(bill.totalAmount)}</span>
              </div>
              {isPaid && (bill.balanceDue ?? 0) > 0 && (
                <>
                  <div className="flex justify-between text-ink-secondary">
                    <span>Paid</span>
                    <span className="font-mono">{money(bill.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-status-danger">
                    <span>Balance due</span>
                    <span className="font-mono">{money(bill.balanceDue)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {(bill.pendingLines?.length ?? 0) > 0 && (
            <div className="mt-4 p-3 rounded-md border border-dashed border-ink-primary/30 text-xs">
              <p className="font-semibold mb-1.5">Prescribed but not yet dispensed — not charged</p>
              {bill.pendingLines!.map((l, i) => (
                <div key={i} className="flex justify-between text-ink-secondary">
                  <span>
                    {l.description} × {l.quantity}
                  </span>
                  <span className="font-mono">{money(l.amount)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5">
            <PaymentDetailsBlock
              status={bill.paymentStatus}
              mode={bill.paymentMode}
              details={bill.paymentDetails}
              total={bill.totalAmount}
              paidAt={bill.paidAt}
              receivedBy={bill.receivedBy}
            />
          </div>

          <div className="mt-8 pt-4 border-t border-border text-[10px] text-ink-secondary flex flex-col items-center gap-1.5">
            <p>This is a computer-generated bill. Please retain it for your records.</p>
            <p className="flex items-center gap-1.5">
              Powered by <BrandLogo className="h-3" />
            </p>
          </div>
        </div>
      </div>
      </div>
    </PrintPortal>
  );
};
