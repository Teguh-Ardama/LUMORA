import { z } from "zod";

/**
 * Billing model: prepaid credit wallet per organization.
 *
 * - The wallet is an APPEND-ONLY LEDGER (credit_transactions); the balance
 *   is always SUM(amount) — never a mutable column.
 * - Charging happens once per session at the COMPOSING -> READY transition
 *   (the moment value is delivered), enforced idempotent by a unique
 *   (session_id, type) constraint.
 * - Sessions in flight are never interrupted: starting a NEW session is
 *   gated on balance, finishing the current one is not (balance may dip
 *   negative and is settled by the next top-up).
 */

export const CreditTransactionType = {
  TOPUP: "TOPUP",
  SESSION_CHARGE: "SESSION_CHARGE",
  REFUND: "REFUND",
  ADJUSTMENT: "ADJUSTMENT",
} as const;
export type CreditTransactionType =
  (typeof CreditTransactionType)[keyof typeof CreditTransactionType];

export const TopupStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  EXPIRED: "EXPIRED",
  FAILED: "FAILED",
} as const;
export type TopupStatus = (typeof TopupStatus)[keyof typeof TopupStatus];

/** Amounts are integer IDR — no decimals, ever. */
export const TOPUP_MIN_IDR = 10_000;
export const TOPUP_MAX_IDR = 50_000_000;
export const TOPUP_PRESETS_IDR = [50_000, 100_000, 250_000, 500_000, 1_000_000] as const;

export const createTopupSchema = z.object({
  amount: z
    .number()
    .int()
    .min(TOPUP_MIN_IDR, `Minimum top-up is Rp${TOPUP_MIN_IDR.toLocaleString("id-ID")}`)
    .max(TOPUP_MAX_IDR),
});
export type CreateTopupInput = z.infer<typeof createTopupSchema>;

export interface BillingSummary {
  balance: number;
  pricePerSession: number;
  lowBalanceThreshold: number;
  /** How many sessions the current balance still covers. */
  sessionsRemaining: number;
  pendingTopup: {
    id: string;
    amount: number;
    paymentUrl: string | null;
    expiresAt: string | null;
  } | null;
}

export interface CreditTransactionItem {
  id: string;
  type: CreditTransactionType;
  amount: number;
  note: string | null;
  sessionId: string | null;
  createdAt: string;
}

export interface TopupItem {
  id: string;
  amount: number;
  status: TopupStatus;
  provider: string;
  paymentUrl: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function formatIdr(amount: number): string {
  return `Rp${amount.toLocaleString("id-ID")}`;
}
