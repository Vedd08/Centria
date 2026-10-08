import React from 'react';
import { X, Printer } from 'lucide-react';
import { money } from '../../utils/money';
import { BrandLogo } from '../common/BrandLogo';
import { useClinicProfile } from '../../hooks/useClinicProfile';
import { PrintPortal } from '../common/PrintPortal';

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

export interface PatientBill {
  queueId: string;
  tokenNumber: number;
  queueDate: string;
  careType?: string;
  diagnosis?: string;
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
}


const KIND_LABEL: Record<string, string> = {
  TREATMENT: 'Treatment',
  MEDICINE: 'Medicine',
  INJECTION: 'Injection',
  OTHER: 'Service',
};

interface Props {
  bill: PatientBill | null;
  onClose: () => void;
}

/**
 * The consolidated bill the patient takes away: the doctor's treatment plus every
 * medicine, injection and service ordered during this encounter, on one sheet.
 */
export const PrintablePatientBill: React.FC<Props> = ({ bill, onClose }) => {
  const clinic = useClinicProfile();
  if (!bill) return null;

  return (
    <PrintPortal>
      <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto print:static print:bg-white print:p-0 print:block print:overflow-visible print:backdrop-blur-none">
      <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-2xl w-full my-8 print:my-0 print:shadow-none print:border-0 print:max-w-none print:rounded-none print:overflow-visible">
        {/* Screen-only toolbar */}
        <div className="flex items-center justify-between p-4 border-b border-border print:hidden">
          <span className="text-xs font-semibold text-ink-primary">
            Patient Bill — Token #{bill.tokenNumber} ({bill.queueDate})
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

        <div className="p-8 print:p-6 text-ink-primary">
          <div className="text-center border-b-2 border-ink-primary pb-4 mb-5">
            <h1 className="text-xl font-bold tracking-tight uppercase">{clinic?.name ?? ''}</h1>
            {clinic?.address && <p className="text-[11px] text-ink-secondary mt-0.5">{clinic.address}</p>}
            {(clinic?.phone || clinic?.email) && (
              <p className="text-[11px] text-ink-secondary">
                {[clinic?.phone, clinic?.email].filter(Boolean).join('  ·  ')}
              </p>
            )}
            <p className="text-xs font-semibold mt-2 tracking-wider">PATIENT BILL</p>
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
            </div>
            <div className="space-y-1 sm:text-right">
              <div>
                <span className="text-ink-secondary">Date: </span>
                <span className="font-mono">{bill.queueDate}</span>
              </div>
              <div>
                <span className="text-ink-secondary">Token: </span>
                <span className="font-mono font-semibold">#{bill.tokenNumber}</span>
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

          {bill.diagnosis && (
            <p className="text-xs mb-4">
              <span className="text-ink-secondary">Diagnosis: </span>
              {bill.diagnosis}
            </p>
          )}

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
                  <td colSpan={5} className="py-6 text-center text-ink-secondary">
                    Nothing billed for this encounter yet.
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
            </div>
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
