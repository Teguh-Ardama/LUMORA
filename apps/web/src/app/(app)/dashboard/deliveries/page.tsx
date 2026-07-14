"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { format } from "date-fns";
import {
  Badge,
  EmptyState,
  ErrorState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
  TableSkeleton,
  Toolbar,
} from "@lumora/ui";
import { useDeliveries } from "@/lib/hooks/use-admin";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  SENT: "success",
  PENDING: "warning",
  FAILED: "destructive",
  REVOKED: "muted",
};

export default function DeliveriesPage() {
  const [page, setPage] = React.useState(1);
  const { data, isLoading, isError, refetch } = useDeliveries({ page });

  return (
    <div>
      <Toolbar title="Deliveries" description="QR, email, and WhatsApp deliveries across all sessions." />
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            {isLoading ? (
              <TableSkeleton rows={8} cols={5} />
            ) : (
              <TableBody>
                {(data?.items ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.eventName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{d.channel}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{d.channel === "QR" ? "—" : d.recipient}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[d.status] ?? "muted"}>{d.status}</Badge>
                      {d.error ? <p className="mt-0.5 max-w-xs truncate text-xs text-destructive">{d.error}</p> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {format(new Date(d.sentAt ?? d.createdAt), "d MMM, HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
                {data && data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <EmptyState icon={Send} title="No deliveries yet" description="Deliveries appear when guests receive their photos." className="border-0" />
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            )}
          </Table>
          {data && data.totalPages > 1 ? (
            <TablePagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
          ) : null}
        </>
      )}
    </div>
  );
}
