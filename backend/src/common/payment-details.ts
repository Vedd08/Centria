import { BadRequestException } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export const PAYMENT_MODES = ['CASH', 'ONLINE', 'CARD', 'UPI'] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

/**
 * Everything reception or the pharmacist can note about how a bill was paid. Which
 * fields apply depends on the mode — see FIELDS_BY_MODE. The full card number is
 * deliberately not accepted: only the last four digits ever reach the database.
 */
export class PaymentDetailsDto {
  /** CASH — what the patient handed over, so the bill can show the change returned. */
  @IsOptional() @IsNumber() @Min(0)
  amountReceived?: number;

  /** ONLINE / UPI / CARD — UTR, UPI reference or card RRN. */
  @IsOptional() @IsString() @MaxLength(64)
  transactionId?: string;

  /** ONLINE — NEFT | IMPS | RTGS | Net Banking. */
  @IsOptional() @IsString() @MaxLength(32)
  transferType?: string;

  /** ONLINE / UPI — name on the payer's account. */
  @IsOptional() @IsString() @MaxLength(100)
  accountHolder?: string;

  /** ONLINE — payer's account number. */
  @IsOptional() @IsString() @MaxLength(34)
  accountNumber?: string;

  /** ONLINE / CARD — payer's (or the card issuer's) bank. */
  @IsOptional() @IsString() @MaxLength(100)
  bankName?: string;

  /** ONLINE — IFSC of the payer's branch. */
  @IsOptional() @IsString() @MaxLength(11)
  ifsc?: string;

  /** UPI — payer's VPA, e.g. name@okicici. */
  @IsOptional() @IsString() @MaxLength(100)
  upiId?: string;

  /** UPI — GPay | PhonePe | Paytm | BHIM | Other. */
  @IsOptional() @IsString() @MaxLength(32)
  upiApp?: string;

  /** CARD — Debit | Credit. */
  @IsOptional() @IsString() @MaxLength(16)
  cardType?: string;

  /** CARD — Visa | Mastercard | RuPay | Amex | Other. */
  @IsOptional() @IsString() @MaxLength(16)
  cardNetwork?: string;

  /** CARD — last four digits only. */
  @IsOptional() @Matches(/^\d{4}$/, { message: 'Card last 4 digits must be exactly 4 numbers' })
  cardLast4?: string;

  /** CARD — approval / auth code from the swipe machine slip. */
  @IsOptional() @IsString() @MaxLength(32)
  approvalCode?: string;
}

const FIELDS_BY_MODE: Record<PaymentMode, (keyof PaymentDetailsDto)[]> = {
  CASH: ['amountReceived'],
  ONLINE: ['transferType', 'transactionId', 'accountHolder', 'accountNumber', 'bankName', 'ifsc'],
  CARD: ['cardType', 'cardNetwork', 'cardLast4', 'bankName', 'transactionId', 'approvalCode'],
  UPI: ['transactionId', 'upiId', 'upiApp', 'accountHolder'],
};

const REQUIRED_BY_MODE: Record<PaymentMode, { field: keyof PaymentDetailsDto; label: string }[]> = {
  CASH: [],
  ONLINE: [{ field: 'transactionId', label: 'Transaction ID / UTR' }],
  CARD: [{ field: 'cardLast4', label: 'Card last 4 digits' }],
  UPI: [{ field: 'transactionId', label: 'UPI transaction ID' }],
};

/**
 * Keeps only the fields that belong to the chosen mode (trimmed, blanks dropped) and
 * checks the ones a bill can't go out without. Returns null when nothing is left.
 */
export function cleanPaymentDetails(mode: PaymentMode, details?: PaymentDetailsDto | null) {
  const out: Record<string, string | number> = {};
  for (const field of FIELDS_BY_MODE[mode]) {
    const value = details?.[field];
    if (typeof value === 'number') out[field] = value;
    else if (typeof value === 'string' && value.trim()) out[field] = field === 'ifsc' ? value.trim().toUpperCase() : value.trim();
  }
  for (const { field, label } of REQUIRED_BY_MODE[mode]) {
    if (out[field] === undefined) throw new BadRequestException(`${label} is required for ${mode} payments`);
  }
  return Object.keys(out).length ? out : null;
}

/** Stored as JSON text — SQLite (local dev) has no Json column type. */
export const serializePaymentDetails = (details: Record<string, string | number> | null) =>
  details ? JSON.stringify(details) : null;

export function parsePaymentDetails(raw: string | null | undefined): Record<string, string | number> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Accounts only splits takings into cash and bank; every non-cash mode lands in bank. */
export const toLedgerMethod = (mode: PaymentMode): 'cash' | 'bank' => (mode === 'CASH' ? 'cash' : 'bank');
