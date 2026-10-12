import React from 'react';
import { X, Printer, Stethoscope, CheckCircle2, ShieldCheck, FileText } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { useClinicProfile } from '../../hooks/useClinicProfile';
import { PrintPortal } from '../common/PrintPortal';
import { money } from '../../utils/money';
import { PaymentDetailsBlock } from '../common/payment/PaymentDetailsBlock';
import { PAYMENT_MODE_LABEL, PaymentDetails, PaymentMode, parsePaymentDetails } from '../common/payment/paymentModes';

export interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  patientName: string;
  patientUhid: string;
  itemTitle: string;
  isGstTaxable: boolean;
  /** Set when sold below list price (package sales). */
  listPrice?: number | null;
  discountAmount?: number;
  discountReason?: string | null;
  taxableValue: number;
  cgstRate: number;
  sgstRate: number;
  cgst: number;
  sgst: number;
  totalAmount: number;
  paymentMethod: string;
  paymentRef?: string;
  paymentMode?: PaymentMode | null;
  /** JSON text from the server (or already parsed) — see parsePaymentDetails. */
  paymentDetails?: string | PaymentDetails | null;
  issuedAt: string;
  reconciled?: boolean;
}

interface Props {
  invoice: InvoiceItem | null;
  onClose: () => void;
}

export const PrintableInvoiceModal: React.FC<Props> = ({ invoice, onClose }) => {
  const clinic = useClinicProfile();
  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <PrintPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto print:static print:bg-white print:p-0 print:block print:overflow-visible print:backdrop-blur-none">
      <div className="bg-surface-card rounded-[10px] border border-border shadow-2xl max-w-2xl w-full mx-2 sm:mx-0 my-4 sm:my-8 overflow-hidden print:rounded-none print:shadow-none print:border-0 print:max-w-none print:m-0 print:overflow-visible">
        
        {/* Modal Action Top Bar */}
        <div className="bg-brand-deep px-6 py-4 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <FileText className="w-4 h-4 text-brand-soft" />
            <span>Tax Invoice Document Preview ({invoice.invoiceNumber})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-brand hover:bg-brand-deep rounded-md transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Tax Invoice</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Tax Invoice Content */}
        <div className="p-8 space-y-6 text-ink-primary bg-surface-card" id="printable-area">
          
          {/* Header & Clinic Details */}
          <div className="flex items-start justify-between border-b border-border pb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand text-white flex items-center justify-center font-bold">
                <Stethoscope className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-ink-primary">{clinic?.name ?? ''}</h1>
                {clinic?.address && <p className="text-xs text-ink-secondary">{clinic.address}</p>}
                {clinic?.gstin && (
                  <p className="text-[11px] text-ink-secondary">
                    GSTIN: {clinic.gstin}
                    {clinic.stateCode ? ` • State Code: ${clinic.stateCode}` : ''}
                    {clinic.stateName ? ` (${clinic.stateName})` : ''}
                  </p>
                )}
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs uppercase font-extrabold tracking-widest text-brand-deep bg-brand/10 border border-brand/20 px-3 py-1 rounded-md inline-block">
                Tax Invoice
              </span>
              <div className="text-xs text-ink-secondary mt-2">
                Date: <span className="font-mono">{new Date(invoice.issuedAt).toLocaleDateString('en-IN')}</span>
              </div>
              <div className="text-xs text-ink-secondary">
                Invoice No: <span className="text-sm font-mono font-bold text-ink-primary">{invoice.invoiceNumber}</span>
              </div>
            </div>
          </div>

          {/* Billed To Patient Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface-page p-4 rounded-xl border border-border text-xs">
            <div>
              <span className="text-ink-secondary font-semibold uppercase tracking-wider text-[10px] block">Billed Patient</span>
              <div className="font-bold text-ink-primary text-sm mt-0.5">{invoice.patientName}</div>
              <div className="font-mono text-brand font-semibold">{invoice.patientUhid}</div>
            </div>
            <div>
              <span className="text-ink-secondary font-semibold uppercase tracking-wider text-[10px] block">Payment</span>
              <div className="font-bold text-ink-primary uppercase mt-0.5">
                {invoice.paymentMode ? `Paid — ${PAYMENT_MODE_LABEL[invoice.paymentMode]}` : `${invoice.paymentMethod} Mode`}
              </div>
              {invoice.paymentRef && <div className="text-ink-secondary font-mono">{invoice.paymentRef}</div>}
            </div>
          </div>

          {/* Line Item Table */}
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-page border-y border-border text-ink-secondary font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Item & Procedure Description</th>
                <th className="py-3 px-4 text-center">GST Taxability</th>
                <th className="py-3 px-4 text-right">Taxable Value (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <tr>
                <td className="py-4 px-4 font-bold text-ink-primary">{invoice.itemTitle}</td>
                <td className="py-4 px-4 text-center">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    invoice.isGstTaxable ? 'bg-status-warning/10 text-status-warning border border-status-warning/20' : 'bg-status-success/10 text-status-success border border-status-success/20'
                  }`}>
                    {invoice.isGstTaxable ? `Taxable (${invoice.cgstRate + invoice.sgstRate}%)` : 'Exempt (0%)'}
                  </span>
                </td>
                <td className="py-4 px-4 text-right font-bold text-ink-primary">
                  ₹{invoice.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Business Rule 4 GST Calculation Breakdown */}
          <div className="flex justify-end pt-2">
            <div className="w-72 space-y-2 text-xs bg-surface-page p-4 rounded-xl border border-border">
              {Number(invoice.discountAmount ?? 0) > 0 && (
                <>
                  {invoice.listPrice ? (
                    <div className="flex justify-between text-ink-secondary">
                      <span>Package Price:</span>
                      <span className="font-semibold text-ink-primary">{money(invoice.listPrice)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-status-success">
                    <span>Discount:</span>
                    <span className="font-semibold">− {money(invoice.discountAmount)}</span>
                  </div>
                  {invoice.discountReason && (
                    <div className="text-[10px] text-ink-secondary -mt-1">({invoice.discountReason})</div>
                  )}
                </>
              )}
              <div className="flex justify-between text-ink-secondary">
                <span>Subtotal (Taxable Value):</span>
                <span className="font-semibold text-ink-primary">₹{invoice.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="flex justify-between text-ink-secondary">
                <span>CGST ({invoice.cgstRate}%):</span>
                <span className="font-semibold text-ink-primary">₹{invoice.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="flex justify-between text-ink-secondary">
                <span>SGST ({invoice.sgstRate}%):</span>
                <span className="font-semibold text-ink-primary">₹{invoice.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="flex justify-between text-sm font-extrabold text-ink-primary pt-2 border-t border-border">
                <span>Total Amount Paid:</span>
                <span className="text-brand">₹{invoice.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          {/* Invoices from before payment modes existed only know cash/bank. */}
          {invoice.paymentMode && (
            <PaymentDetailsBlock
              status="PAID"
              mode={invoice.paymentMode}
              details={parsePaymentDetails(invoice.paymentDetails)}
              total={invoice.totalAmount}
              paidAt={invoice.issuedAt}
            />
          )}

          {/* Footer Note */}
          <div className="pt-6 border-t border-border text-[11px] text-ink-secondary text-center space-y-1">
            <p>This is a computer-generated GST tax invoice issued by {clinic?.name ?? 'this clinic'}.</p>
            <p>Business Rule 4 Intra-State CGST + SGST split applied based on item tax rate.</p>
            <p className="flex items-center justify-center gap-1.5 pt-1 text-[10px]">
              Powered by <BrandLogo className="h-3" />
            </p>
          </div>

        </div>

      </div>
      </div>
    </PrintPortal>
  );
};
