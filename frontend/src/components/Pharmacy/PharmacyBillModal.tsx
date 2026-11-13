import React, { useState } from 'react';
import { X, Printer, Banknote, CreditCard, CheckCircle2 } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { PrintPortal } from '../common/PrintPortal';
import { useClinicProfile } from '../../hooks/useClinicProfile';
import { money } from '../../utils/money';
import { fmtDate, fmtDateTime } from '../../utils/date';

export interface PharmacyBillLine {
  description: string;
  unit?: string;
  hsnCode?: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  gstRate: number;
  gstAmount: number;
}

export interface PharmacyBillData {
  /** "Pharmacy Bill" for a patient visit, "Retail Sale" for walk-ins. */
  title: string;
  billNo?: string;
  issuedAt?: string;
  date?: string;
  patient: { name: string; phone?: string | null; uhid?: string | null };
  doctor?: string | null;
  token?: number;
  lines: PharmacyBillLine[];
  subTotal: number;
  cgst: number;
  sgst: number;
  totalAmount: number;
  paymentMethod?: string;
  paymentRef?: string | null;
}

interface Props {
  bill: PharmacyBillData | null;
  onClose: () => void;
  /**
   * Preview mode: when given, the bill isn't paid yet and the footer asks how the
   * patient is paying. Resolves once the receipt is issued (the parent then swaps
   * in the issued bill, with its receipt number).
   */
  onCollect?: (paymentMethod: 'cash' | 'bank', paymentRef: string) => Promise<void>;
}

/** Itemised pharmacy bill / receipt, laid out for A4 or a half-page printout. */
export const PharmacyBillModal: React.FC<Props> = ({ bill, onClose, onCollect }) => {
  const clinic = useClinicProfile();
  const [method, setMethod] = useState<'cash' | 'bank'>('cash');
  const [ref, setRef] = useState('');
  const [collecting, setCollecting] = useState(false);
  if (!bill) return null;

  const isPreview = !!onCollect;
  const hasGst = bill.cgst + bill.sgst > 0;

  const collect = async () => {
    if (!onCollect) return;
    setCollecting(true);
    try {
      await onCollect(method, ref.trim());
    } finally {
      setCollecting(false);
    }
  };

  return (
    <PrintPortal>
      <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto print:static print:bg-white print:p-0 print:block print:overflow-visible print:backdrop-blur-none">
        <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-2xl w-full my-8 print:my-0 print:shadow-none print:border-0 print:max-w-none print:rounded-none">
          <div className="flex items-center justify-between p-4 border-b border-border print:hidden">
            <span className="text-xs font-semibold text-ink-primary">
              {isPreview ? 'Review bill before collecting' : `${bill.title}${bill.billNo ? ` — ${bill.billNo}` : ''}`}
            </span>
            <div className="flex items-center gap-2">
              {!isPreview && (
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded text-ink-secondary hover:text-ink-primary cursor-pointer" title="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-8 print:p-4 text-ink-primary">
            {/* Clinic header */}
            <div className="flex items-start justify-between border-b-2 border-ink-primary pb-4 mb-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight uppercase">{clinic?.name ?? ''}</h1>
                {clinic?.address && <p className="text-[11px] text-ink-secondary mt-0.5">{clinic.address}</p>}
                {(clinic?.phone || clinic?.email) && (
                  <p className="text-[11px] text-ink-secondary">{[clinic?.phone, clinic?.email].filter(Boolean).join('  ·  ')}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold tracking-wider uppercase">{bill.title}</p>
                {bill.billNo ? (
                  <p className="text-xs font-mono mt-1">{bill.billNo}</p>
                ) : (
                  <p className="text-[11px] text-status-warning mt-1 font-semibold print:hidden">Not paid yet</p>
                )}
              </div>
            </div>

            {/* Patient / bill details */}
            <div className="grid grid-cols-2 gap-4 text-xs mb-4">
              <div className="space-y-1">
                <div>
                  <span className="text-ink-secondary">{bill.patient.uhid === 'RETAIL' || !bill.patient.uhid ? 'Customer' : 'Patient'}: </span>
                  <span className="font-semibold">{bill.patient.name}</span>
                </div>
                {bill.patient.phone && (
                  <div>
                    <span className="text-ink-secondary">Mobile: </span>
                    <span className="font-mono">{bill.patient.phone}</span>
                  </div>
                )}
                {bill.patient.uhid && bill.patient.uhid !== 'RETAIL' && (
                  <div>
                    <span className="text-ink-secondary">UHID: </span>
                    <span className="font-mono">{bill.patient.uhid}</span>
                  </div>
                )}
              </div>
              <div className="space-y-1 text-right">
                <div>
                  <span className="text-ink-secondary">Date: </span>
                  <span className="font-mono">{bill.issuedAt ? fmtDateTime(bill.issuedAt) : fmtDate(bill.date || new Date())}</span>
                </div>
                {bill.doctor && (
                  <div>
                    <span className="text-ink-secondary">Prescribed by: </span>
                    <span>{bill.doctor}</span>
                  </div>
                )}
                {bill.token != null && (
                  <div>
                    <span className="text-ink-secondary">Token: </span>
                    <span className="font-mono">{bill.token}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            <table className="w-full text-xs border-collapse mb-3">
              <thead>
                <tr className="border-y border-ink-primary/60 text-left">
                  <th className="py-1.5 pr-2 w-6">#</th>
                  <th className="py-1.5 pr-2">Medicine</th>
                  <th className="py-1.5 px-2 text-right">Qty</th>
                  <th className="py-1.5 px-2 text-right">Rate</th>
                  {hasGst && <th className="py-1.5 px-2 text-right">GST</th>}
                  <th className="py-1.5 pl-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {bill.lines.map((l, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="py-1.5 pr-2 text-ink-secondary font-mono">{i + 1}</td>
                    <td className="py-1.5 pr-2">
                      {l.description}
                      {l.hsnCode && <span className="block text-[10px] text-ink-secondary">HSN {l.hsnCode}</span>}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono whitespace-nowrap">
                      {l.quantity} {l.unit}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono">{money(l.unitPrice)}</td>
                    {hasGst && <td className="py-1.5 px-2 text-right font-mono text-ink-secondary">{l.gstRate ? `${l.gstRate}%` : '—'}</td>}
                    <td className="py-1.5 pl-2 text-right font-mono">{money(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-ink-secondary">Subtotal</span>
                  <span className="font-mono">{money(bill.subTotal)}</span>
                </div>
                {hasGst && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-ink-secondary">CGST</span>
                      <span className="font-mono">{money(bill.cgst)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-secondary">SGST</span>
                      <span className="font-mono">{money(bill.sgst)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between border-t border-ink-primary pt-1.5 text-sm font-bold">
                  <span>Total</span>
                  <span className="font-mono">{money(bill.totalAmount)}</span>
                </div>
                {bill.paymentMethod && (
                  <div className="flex justify-between text-ink-secondary pt-1">
                    <span>Paid by</span>
                    <span className="capitalize">
                      {bill.paymentMethod}
                      {bill.paymentRef ? ` · ${bill.paymentRef}` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 pt-3 border-t border-border flex items-center justify-between text-[10px] text-ink-secondary">
              <span>Thank you. Please check your medicines before leaving the counter.</span>
              <span className="flex items-center gap-1.5">
                Powered by <BrandLogo className="h-3" />
              </span>
            </div>
          </div>

          {/* Preview: collect payment */}
          {isPreview && (
            <div className="p-4 border-t border-border bg-surface-page rounded-b-[10px] space-y-3 print:hidden">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-ink-secondary mr-1">Payment</span>
                {(['cash', 'bank'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border cursor-pointer ${
                      method === m ? 'bg-brand text-white border-brand' : 'bg-surface-card text-ink-primary border-border hover:bg-surface-page'
                    }`}
                  >
                    {m === 'cash' ? <Banknote className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
                    {m === 'cash' ? 'Cash' : 'UPI / Card / Bank'}
                  </button>
                ))}
                {method === 'bank' && (
                  <input
                    type="text"
                    value={ref}
                    onChange={(e) => setRef(e.target.value)}
                    placeholder="Transaction ID (optional)"
                    className="flex-1 min-w-[160px] px-3 py-1.5 rounded-md border border-border text-xs bg-surface-card"
                  />
                )}
              </div>
              <button
                onClick={collect}
                disabled={collecting || bill.lines.length === 0}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                {collecting ? 'Issuing receipt...' : `Collect ${money(bill.totalAmount)} & Issue Receipt`}
              </button>
            </div>
          )}
        </div>
      </div>
    </PrintPortal>
  );
};
