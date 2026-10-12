import React from 'react';
import { PAYMENT_MODE_LABEL, PaymentDetails, PaymentMode, paymentDetailRows } from './paymentModes';

interface Props {
  status: 'PAID' | 'UNPAID';
  mode?: PaymentMode | null;
  details?: PaymentDetails | null;
  /** Bill total — lets a cash payment print the change returned. */
  total?: number;
  paidAt?: string | null;
  receivedBy?: string | null;
}

/** The printed "Payment Details" box: status, mode and every detail recorded for it. */
export const PaymentDetailsBlock: React.FC<Props> = ({ status, mode, details, total, paidAt, receivedBy }) => {
  const paid = status === 'PAID';
  const rows = paid && mode ? paymentDetailRows(mode, details, total) : [];

  return (
    <div className="border border-ink-primary/20 rounded-md p-3 text-xs">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-secondary mb-2">Payment Details</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-x-6 gap-y-1">
        <div className="flex justify-between gap-3">
          <span className="text-ink-secondary">Status</span>
          <span className={`font-bold ${paid ? 'text-status-success' : 'text-status-danger'}`}>{paid ? 'PAID' : 'UNPAID'}</span>
        </div>
        {paid && mode && (
          <div className="flex justify-between gap-3">
            <span className="text-ink-secondary">Mode</span>
            <span className="font-semibold">{PAYMENT_MODE_LABEL[mode]}</span>
          </div>
        )}
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-3">
            <span className="text-ink-secondary">{r.label}</span>
            <span className="font-mono text-right break-all">{r.value}</span>
          </div>
        ))}
        {paid && paidAt && (
          <div className="flex justify-between gap-3">
            <span className="text-ink-secondary">Paid on</span>
            <span className="font-mono">{new Date(paidAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>
        )}
        {paid && receivedBy && (
          <div className="flex justify-between gap-3">
            <span className="text-ink-secondary">Received by</span>
            <span>{receivedBy}</span>
          </div>
        )}
      </div>
    </div>
  );
};
