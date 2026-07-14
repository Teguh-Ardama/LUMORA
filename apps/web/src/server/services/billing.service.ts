import {
  ApiError,
  ApiErrorCode,
  type BillingSummary,
  type SessionUser,
} from "@lumora/contracts";
import { enqueueNotification, getEnv } from "@lumora/core";
import { auditRepo, billingRepo, getSessionPrice, topupRepo } from "@lumora/db";
import { DevPaymentProvider } from "./payment/dev.provider";
import { XenditProvider } from "./payment/xendit.provider";
import type { PaymentProvider } from "./payment/provider";

let provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  provider ??= getEnv().PAYMENT_DRIVER === "xendit" ? new XenditProvider() : new DevPaymentProvider();
  return provider;
}

export const billingService = {
  async summary(organizationId: string): Promise<BillingSummary> {
    const env = getEnv();
    const [balance, price, pending] = await Promise.all([
      billingRepo.balance(organizationId),
      getSessionPrice(organizationId, env.PRICE_PER_SESSION_IDR),
      topupRepo.findPending(organizationId),
    ]);
    return {
      balance,
      pricePerSession: price,
      lowBalanceThreshold: env.LOW_BALANCE_THRESHOLD_IDR,
      sessionsRemaining: price > 0 ? Math.max(0, Math.floor(balance / price)) : Infinity,
      pendingTopup: pending
        ? {
            id: pending.id,
            amount: pending.amount,
            paymentUrl: pending.paymentUrl,
            expiresAt: pending.expiresAt?.toISOString() ?? null,
          }
        : null,
    };
  },

  /**
   * Gate for STARTING a new session (never for finishing one): the wallet
   * must cover at least one session. Price 0 = billing disabled.
   */
  async assertCanStartSession(organizationId: string): Promise<void> {
    const env = getEnv();
    const price = await getSessionPrice(organizationId, env.PRICE_PER_SESSION_IDR);
    if (price <= 0) return;
    const balance = await billingRepo.balance(organizationId);
    if (balance < price) {
      throw new ApiError(
        ApiErrorCode.PAYMENT_REQUIRED,
        `Insufficient credit (balance Rp${balance.toLocaleString("id-ID")}, needs Rp${price.toLocaleString("id-ID")}/session). Ask an admin to top up.`,
        402,
      );
    }
  },

  async createTopup(user: SessionUser, amount: number) {
    const topup = await topupRepo.create({
      organizationId: user.organizationId,
      amount,
      provider: getPaymentProvider().name,
      createdById: user.id,
    });

    try {
      const invoice = await getPaymentProvider().createInvoice({
        topupId: topup.id,
        amount,
        organizationName: user.organizationName,
        payerEmail: user.email,
        description: `LUMORA credit top-up — ${user.organizationName}`,
      });
      const updated = await topupRepo.update(topup.id, {
        providerRef: invoice.providerRef,
        paymentUrl: invoice.paymentUrl,
        expiresAt: invoice.expiresAt,
      });
      await auditRepo.write({
        organizationId: user.organizationId,
        actorType: "USER",
        actorId: user.id,
        actorName: user.name,
        action: "CREATE",
        entityType: "topup",
        entityId: topup.id,
        metadata: { amount, provider: getPaymentProvider().name },
      });
      return updated;
    } catch (err) {
      await topupRepo.markStatus(topup.id, "FAILED");
      throw new ApiError(
        ApiErrorCode.INTERNAL,
        `Could not create the payment invoice: ${err instanceof Error ? err.message : "unknown error"}`,
        502,
      );
    }
  },

  /** Settle a topup as paid — idempotent; used by webhook AND dev-simulate. */
  async settleTopupPaid(topupId: string): Promise<boolean> {
    const topup = await topupRepo.findById(topupId);
    if (!topup) return false;

    const transitioned = await topupRepo.markPaid(topupId);
    // Credit even on replay-after-crash: creditTopup is itself idempotent.
    const credited = await billingRepo.creditTopup({
      organizationId: topup.organizationId,
      topupId: topup.id,
      amount: topup.amount,
      note: `Top-up via ${topup.provider}`,
    });
    if (!transitioned && !credited) return false; // full duplicate

    await auditRepo.write({
      organizationId: topup.organizationId,
      actorType: "SYSTEM",
      action: "UPDATE",
      entityType: "topup",
      entityId: topup.id,
      metadata: { status: "PAID", amount: topup.amount },
    });
    await enqueueNotification({
      organizationId: topup.organizationId,
      kind: "TOPUP_PAID",
      title: "Top-up received",
      body: `Rp${topup.amount.toLocaleString("id-ID")} has been added to your credit balance.`,
    });
    return true;
  },

  async handleWebhook(headers: Record<string, string | undefined>, body: unknown): Promise<void> {
    const verification = getPaymentProvider().verifyWebhook(headers, body);
    if (!verification.valid) {
      throw new ApiError(ApiErrorCode.FORBIDDEN, "Webhook signature invalid", 403);
    }
    // Prefer external_id (our topup id), fall back to provider ref lookup.
    const topup = verification.externalId
      ? await topupRepo.findById(verification.externalId).catch(() => null)
      : verification.providerRef
        ? await topupRepo.findByProviderRef(verification.providerRef)
        : null;
    if (!topup) return; // unknown invoice — acknowledge, don't retry forever

    if (verification.status === "PAID") {
      await this.settleTopupPaid(topup.id);
    } else if (verification.status === "EXPIRED") {
      await topupRepo.markStatus(topup.id, "EXPIRED");
    } else if (verification.status === "FAILED") {
      await topupRepo.markStatus(topup.id, "FAILED");
    }
  },
};
