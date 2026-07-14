import { getEnv } from "@lumora/core";
import type {
  CreateInvoiceInput,
  CreateInvoiceResult,
  PaymentProvider,
  WebhookVerification,
} from "./provider";

interface XenditInvoiceResponse {
  id: string;
  invoice_url: string;
  expiry_date?: string;
}

interface XenditWebhookBody {
  id?: string;
  external_id?: string;
  status?: string;
}

/**
 * Xendit Invoice API driver (QRIS, VA, e-wallet, cards — Xendit hosts the
 * checkout page). Webhook authenticity = the x-callback-token header,
 * which must equal XENDIT_CALLBACK_TOKEN from the Xendit dashboard.
 */
export class XenditProvider implements PaymentProvider {
  readonly name = "xendit";

  async createInvoice(input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
    const env = getEnv();
    const auth = Buffer.from(`${env.XENDIT_SECRET_KEY}:`).toString("base64");
    const res = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_id: input.topupId,
        amount: input.amount,
        description: input.description,
        payer_email: input.payerEmail,
        currency: "IDR",
        invoice_duration: 24 * 3600,
        success_redirect_url: `${env.APP_URL}/dashboard/billing?paid=1`,
        failure_redirect_url: `${env.APP_URL}/dashboard/billing?failed=1`,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Xendit invoice failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as XenditInvoiceResponse;
    return {
      providerRef: json.id,
      paymentUrl: json.invoice_url,
      expiresAt: json.expiry_date ? new Date(json.expiry_date) : null,
    };
  }

  verifyWebhook(headers: Record<string, string | undefined>, body: unknown): WebhookVerification {
    const token = headers["x-callback-token"];
    if (!token || token !== getEnv().XENDIT_CALLBACK_TOKEN) return { valid: false };
    const payload = body as XenditWebhookBody;
    const status =
      payload.status === "PAID" || payload.status === "SETTLED"
        ? ("PAID" as const)
        : payload.status === "EXPIRED"
          ? ("EXPIRED" as const)
          : ("FAILED" as const);
    return {
      valid: true,
      providerRef: payload.id,
      externalId: payload.external_id,
      status,
    };
  }
}
