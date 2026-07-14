export interface CreateInvoiceInput {
  topupId: string;
  amount: number; // integer IDR
  organizationName: string;
  payerEmail: string;
  description: string;
}

export interface CreateInvoiceResult {
  providerRef: string;
  paymentUrl: string;
  expiresAt: Date | null;
}

export interface WebhookVerification {
  valid: boolean;
  /** Provider's invoice reference to look the topup up by. */
  providerRef?: string;
  /** External id we set at creation (= topup id). */
  externalId?: string;
  status?: "PAID" | "EXPIRED" | "FAILED";
}

/**
 * Payment gateway abstraction. One driver per gateway; the billing
 * service never talks to a gateway API directly.
 */
export interface PaymentProvider {
  readonly name: string;
  createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult>;
  verifyWebhook(headers: Record<string, string | undefined>, body: unknown): WebhookVerification;
}
