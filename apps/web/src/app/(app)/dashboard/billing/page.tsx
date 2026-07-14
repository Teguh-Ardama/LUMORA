"use client";

import * as React from "react";
import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, CreditCard, ExternalLink, Wallet, Zap } from "lucide-react";
import { TOPUP_PRESETS_IDR, formatIdr } from "@lumora/contracts";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  Label,
  LoadingState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
  Toolbar,
  cn,
  toast,
} from "@lumora/ui";
import {
  useBillingSummary,
  useCreateTopup,
  useCreditTransactions,
  useSimulateTopupPaid,
  useTopups,
} from "@/lib/hooks/use-billing";
import { ApiClientError } from "@/lib/api";

const TX_LABEL: Record<string, string> = {
  TOPUP: "Top-up",
  SESSION_CHARGE: "Session",
  REFUND: "Refund",
  ADJUSTMENT: "Adjustment",
};

function TopupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useCreateTopup();
  const [amount, setAmount] = React.useState<number>(TOPUP_PRESETS_IDR[1]);
  const [custom, setCustom] = React.useState("");

  const effective = custom ? Number(custom.replace(/\D/g, "")) : amount;

  const submit = async () => {
    try {
      const { topup } = await create.mutateAsync(effective);
      onOpenChange(false);
      setCustom("");
      if (topup.paymentUrl) {
        window.open(topup.paymentUrl, "_blank", "noopener,noreferrer");
      }
      toast.success("Invoice created — complete the payment to receive credit");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not create the top-up");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Top up credit</DialogTitle>
          <DialogDescription>Credit is deducted per composed session and never expires.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {TOPUP_PRESETS_IDR.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setAmount(p);
                  setCustom("");
                }}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                  !custom && amount === p ? "border-primary bg-accent" : "hover:bg-accent/50",
                )}
              >
                {formatIdr(p)}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-amount">Custom amount (min Rp10.000)</Label>
            <Input
              id="custom-amount"
              inputMode="numeric"
              placeholder="e.g. 750000"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending} disabled={!effective || effective < 10_000}>
            <CreditCard /> Create invoice · {formatIdr(effective || 0)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BillingPage() {
  const [txPage, setTxPage] = React.useState(1);
  const summary = useBillingSummary();
  const transactions = useCreditTransactions(txPage);
  const topups = useTopups(1);
  const simulate = useSimulateTopupPaid();
  const [topupOpen, setTopupOpen] = React.useState(false);

  if (summary.isLoading) return <LoadingState label="Loading billing…" />;
  if (summary.isError || !summary.data) return <ErrorState onRetry={() => summary.refetch()} />;

  const s = summary.data.summary;
  const low = s.balance < s.lowBalanceThreshold;

  return (
    <div>
      <Toolbar
        title="Billing"
        description="Prepaid credit — one charge per composed session."
        actions={
          <Button onClick={() => setTopupOpen(true)}>
            <Wallet /> Top up
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className={cn(low && "border-warning/60")}>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Balance</p>
            <p className={cn("mt-1.5 text-2xl font-semibold tabular-nums tracking-tight", low && "text-warning")}>
              {formatIdr(s.balance)}
            </p>
            {low ? <p className="mt-0.5 text-xs text-warning">Low balance — top up before your next event</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Price per session</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{formatIdr(s.pricePerSession)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">charged when a session composes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sessions remaining</p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">
              {Number.isFinite(s.sessionsRemaining) ? `≈ ${s.sessionsRemaining}` : "∞"}
            </p>
          </CardContent>
        </Card>
      </div>

      {s.pendingTopup ? (
        <Card className="mt-4 border-primary/30">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-medium">
                Pending invoice — {formatIdr(s.pendingTopup.amount)}
              </p>
              <p className="text-sm text-muted-foreground">
                Complete the payment to receive your credit.
                {s.pendingTopup.expiresAt
                  ? ` Expires ${format(new Date(s.pendingTopup.expiresAt), "d MMM, HH:mm")}.`
                  : ""}
              </p>
            </div>
            <div className="flex gap-2">
              {s.pendingTopup.paymentUrl ? (
                <Button variant="outline" asChild>
                  <a href={s.pendingTopup.paymentUrl} target="_blank" rel="noopener noreferrer">
                    Open payment page <ExternalLink />
                  </a>
                </Button>
              ) : null}
              <Button
                variant="secondary"
                loading={simulate.isPending}
                onClick={() =>
                  simulate.mutate(s.pendingTopup!.id, {
                    onSuccess: () => toast.success("Payment simulated — credit added"),
                    onError: (err) =>
                      toast.error(err instanceof ApiClientError ? err.message : "Simulation unavailable"),
                  })
                }
              >
                <Zap /> Simulate paid (dev)
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Ledger</h2>
          {transactions.isError ? (
            <ErrorState onRetry={() => transactions.refetch()} />
          ) : (transactions.data?.items.length ?? 0) === 0 ? (
            <EmptyState icon={Wallet} title="No transactions yet" description="Top up to start running paid sessions." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(transactions.data?.items ?? []).map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-sm font-medium">
                          {t.amount >= 0 ? (
                            <ArrowDownLeft className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          {TX_LABEL[t.type] ?? t.type}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                        {t.note ?? "—"}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          t.amount >= 0 ? "text-success" : "text-foreground",
                        )}
                      >
                        {t.amount >= 0 ? "+" : ""}
                        {formatIdr(t.amount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {format(new Date(t.createdAt), "d MMM, HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {transactions.data && transactions.data.totalPages > 1 ? (
                <TablePagination
                  page={transactions.data.page}
                  totalPages={transactions.data.totalPages}
                  total={transactions.data.total}
                  onPageChange={setTxPage}
                />
              ) : null}
            </>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Top-up history</h2>
          <Card>
            <CardContent className="divide-y p-0">
              {(topups.data?.items ?? []).length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No top-ups yet.</p>
              ) : (
                topups.data!.items.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 p-4">
                    <div>
                      <p className="text-sm font-medium tabular-nums">{formatIdr(t.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(t.createdAt), "d MMM yyyy, HH:mm")} · {t.provider}
                      </p>
                    </div>
                    <Badge
                      variant={
                        t.status === "PAID"
                          ? "success"
                          : t.status === "PENDING"
                            ? "warning"
                            : "muted"
                      }
                    >
                      {t.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <TopupDialog open={topupOpen} onOpenChange={setTopupOpen} />
    </div>
  );
}
