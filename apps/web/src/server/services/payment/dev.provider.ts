import { randomUUID } from "node:crypto";
import { getEnv } from "@lumora/core";
import type {
  CreateInvoiceInput,
  CreateInvoiceResult,
  PaymentProvider,
  WebhookVerification,
} from "./provider";

/**
 * Development driver — no gateway. The "payment page" is the billing page
 * itself; the invoice is settled via the simulate endpoint
 * (POST /api/billing/topups/:id/simulate-paid), which the env schema
 * guarantees can never run in production (PAYMENT_DRIVER=dev is rejected).
 */
export class DevPaymentProvider implements PaymentProvider {
  readonly name = "dev";

  async createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
    return {
      providerRef: `dev-${randomUUID()}`,
      paymentUrl: `${getEnv().APP_URL}/dashboard/billing?devpay=${input.topupId}`,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    };
  }

  verifyWebhook(): WebhookVerification {
    // The dev driver has no webhook; settlement goes through simulate-paid.
    return { valid: false };
  }
}
