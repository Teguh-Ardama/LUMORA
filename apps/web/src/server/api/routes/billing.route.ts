import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  ApiError,
  ApiErrorCode,
  Permission,
  createTopupSchema,
  paginationQuerySchema,
} from "@lumora/contracts";
import { getEnv } from "@lumora/core";
import { billingRepo, topupRepo } from "@lumora/db";
import { billingService } from "../../services/billing.service";
import { notFound, ok, rateLimitBy, requireAuth, requirePermission } from "../middleware";
import type { ApiEnv } from "../context";

export const billingRoute = new Hono<ApiEnv>()
  .use("*", requireAuth)

  .get("/summary", requirePermission(Permission.BILLING_READ), async (c) => {
    const user = c.get("user");
    return ok(c, { summary: await billingService.summary(user.organizationId) });
  })

  .get(
    "/transactions",
    requirePermission(Permission.BILLING_READ),
    zValidator("query", paginationQuerySchema),
    async (c) => {
      const user = c.get("user");
      const q = c.req.valid("query");
      const [items, total] = await billingRepo.listTransactions({
        organizationId: user.organizationId,
        page: q.page,
        pageSize: q.pageSize,
      });
      return ok(c, {
        items: items.map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          note: t.note,
          sessionId: t.sessionId,
          createdAt: t.createdAt,
        })),
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
      });
    },
  )

  .get(
    "/topups",
    requirePermission(Permission.BILLING_READ),
    zValidator("query", paginationQuerySchema),
    async (c) => {
      const user = c.get("user");
      const q = c.req.valid("query");
      const [items, total] = await topupRepo.list({
        organizationId: user.organizationId,
        page: q.page,
        pageSize: q.pageSize,
      });
      return ok(c, {
        items,
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
      });
    },
  )

  .post(
    "/topups",
    requirePermission(Permission.BILLING_MANAGE),
    rateLimitBy("topup-create", 10, 300),
    zValidator("json", createTopupSchema),
    async (c) => {
      const user = c.get("user");
      const { amount } = c.req.valid("json");
      const topup = await billingService.createTopup(user, amount);
      return ok(
        c,
        {
          topup: {
            id: topup.id,
            amount: topup.amount,
            status: topup.status,
            paymentUrl: topup.paymentUrl,
            expiresAt: topup.expiresAt,
          },
        },
        201,
      );
    },
  )

  /** DEV DRIVER ONLY: settle an invoice without a gateway. */
  .post("/topups/:id/simulate-paid", requirePermission(Permission.BILLING_MANAGE), async (c) => {
    if (getEnv().PAYMENT_DRIVER !== "dev") {
      throw new ApiError(ApiErrorCode.FORBIDDEN, "Simulation is only available with the dev payment driver", 403);
    }
    const user = c.get("user");
    const topup = await topupRepo.findById(c.req.param("id"));
    if (!topup || topup.organizationId !== user.organizationId) throw notFound();
    const settled = await billingService.settleTopupPaid(topup.id);
    return ok(c, { settled });
  });

/**
 * Gateway webhook — NO auth cookie, NO CSRF; authenticity comes from the
 * provider signature (verified inside the service). Mounted separately.
 */
export const billingWebhookRoute = new Hono().post(
  "/webhook",
  async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const headers: Record<string, string | undefined> = {
      "x-callback-token": c.req.header("x-callback-token"),
    };
    await billingService.handleWebhook(headers, body);
    return c.json({ ok: true, data: { received: true } });
  },
);
