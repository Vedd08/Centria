import { money } from '../../../utils/money';

export type PaymentMode = 'CASH' | 'ONLINE' | 'CARD' | 'UPI';

export type PaymentField =
  | 'amountReceived'
  | 'transactionId'
  | 'transferType'
  | 'accountHolder'
  | 'accountNumber'
  | 'bankName'
  | 'ifsc'
  | 'upiId'
  | 'upiApp'
  | 'cardType'
  | 'cardNetwork'
  | 'cardLast4'
  | 'approvalCode';

/** What the form holds — everything as typed text until it is sent. */
export type PaymentDetailsDraft = Partial<Record<PaymentField, string>>;
/** What the server stores and returns. */
export type PaymentDetails = Partial<Record<PaymentField, string | number>>;

export interface PaymentFieldDef {
  key: PaymentField;
  label: string;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  numeric?: boolean;
  maxLength?: number;
}

export const PAYMENT_MODES: PaymentMode[] = ['CASH', 'ONLINE', 'CARD', 'UPI'];

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  CASH: 'Cash',
  ONLINE: 'Online',
  CARD: 'Card',
  UPI: 'UPI',
};

/**
 * The details asked for (and printed) per mode. Mirrors FIELDS_BY_MODE in the
 * backend's common/payment-details.ts. Only the card's last four digits are ever
 * asked for — never the full number.
 */
export const PAYMENT_FIELDS: Record<PaymentMode, PaymentFieldDef[]> = {
  CASH: [{ key: 'amountReceived', label: 'Amount received (₹)', placeholder: 'e.g. 2000', numeric: true }],
  ONLINE: [
    { key: 'transferType', label: 'Transfer type', options: ['NEFT', 'IMPS', 'RTGS', 'Net Banking'] },
    { key: 'transactionId', label: 'Transaction ID / UTR', placeholder: 'e.g. 412345678901', required: true },
    { key: 'accountHolder', label: 'Account holder name' },
    { key: 'accountNumber', label: 'Account number', maxLength: 34 },
    { key: 'bankName', label: 'Bank name', placeholder: 'e.g. HDFC Bank' },
    { key: 'ifsc', label: 'IFSC', placeholder: 'e.g. HDFC0001234', maxLength: 11 },
  ],
  CARD: [
    { key: 'cardType', label: 'Card type', options: ['Debit', 'Credit'] },
    { key: 'cardNetwork', label: 'Card network', options: ['Visa', 'Mastercard', 'RuPay', 'Amex', 'Other'] },
    { key: 'cardLast4', label: 'Card last 4 digits', placeholder: '1234', required: true, maxLength: 4 },
    { key: 'bankName', label: 'Issuing bank', placeholder: 'e.g. SBI' },
    { key: 'transactionId', label: 'Transaction ID / RRN' },
    { key: 'approvalCode', label: 'Approval code' },
  ],
  UPI: [
    { key: 'transactionId', label: 'UPI transaction ID / UTR', placeholder: 'e.g. 412345678901', required: true },
    { key: 'upiId', label: 'Payer UPI ID', placeholder: 'e.g. name@okicici' },
    { key: 'upiApp', label: 'UPI app', options: ['Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'Other'] },
    { key: 'accountHolder', label: 'Payer name' },
  ],
};

/** The first required field left blank, as a message — or null when the form is complete. */
export function missingPaymentDetail(mode: PaymentMode, draft: PaymentDetailsDraft): string | null {
  for (const f of PAYMENT_FIELDS[mode]) {
    if (f.required && !draft[f.key]?.trim()) return `${f.label} is required for ${PAYMENT_MODE_LABEL[mode]} payments`;
  }
  if (mode === 'CARD' && draft.cardLast4 && !/^\d{4}$/.test(draft.cardLast4.trim())) {
    return 'Card last 4 digits must be exactly 4 numbers';
  }
  return null;
}

/** Only the chosen mode's fields, blanks dropped, numbers as numbers — ready to send. */
export function toPaymentDetails(mode: PaymentMode, draft: PaymentDetailsDraft): PaymentDetails {
  const out: PaymentDetails = {};
  for (const f of PAYMENT_FIELDS[mode]) {
    const v = draft[f.key]?.trim();
    if (!v) continue;
    out[f.key] = f.numeric ? Number(v) : v;
  }
  return out;
}

export function toPaymentDraft(details?: PaymentDetails | null): PaymentDetailsDraft {
  const out: PaymentDetailsDraft = {};
  for (const [k, v] of Object.entries(details ?? {})) {
    if (v !== undefined && v !== null) out[k as PaymentField] = String(v);
  }
  return out;
}

/** Invoices store the details as JSON text; encounter bills send them parsed. */
export function parsePaymentDetails(raw: unknown): PaymentDetails | null {
  if (!raw) return null;
  if (typeof raw === 'object') return raw as PaymentDetails;
  try {
    return JSON.parse(String(raw));
  } catch {
    return null;
  }
}

/** Label/value rows for the printed bill, in the order the form asks for them. */
export function paymentDetailRows(
  mode: PaymentMode,
  details: PaymentDetails | null | undefined,
  total?: number,
): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  for (const f of PAYMENT_FIELDS[mode]) {
    const v = details?.[f.key];
    if (v === undefined || v === null || v === '') continue;
    if (f.key === 'amountReceived') rows.push({ label: 'Amount received', value: money(Number(v)) });
    else if (f.key === 'cardLast4') rows.push({ label: 'Card number', value: `XXXX XXXX XXXX ${v}` });
    else rows.push({ label: f.label, value: String(v) });
  }
  if (mode === 'CASH' && details?.amountReceived !== undefined && total !== undefined) {
    const change = Number(details.amountReceived) - total;
    if (change >= 0) rows.push({ label: 'Change returned', value: money(change) });
  }
  return rows;
}
