"use client";

import * as React from "react";
import { Printer } from "lucide-react";
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
import { usePrintJobs } from "@/lib/hooks/use-admin";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted" | "secondary"> = {
  PRINTED: "success",
  PRINTING: "warning",
  QUEUED: "secondary",
  FAILED: "destructive",
  CANCELLED: "muted",
};

export default function PrintQueuePage() {
  const [page, setPage] = React.useState(1);
  const { data, isLoading, isError, refetch } = usePrintJobs({ page });

  return (
    <div>
      <Toolbar title="Print Queue" description="Every 4R print job across your events." />
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Copies</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Requested</TableHead>
              </TableRow>
            </TableHeader>
            {isLoading ? (
              <TableSkeleton rows={8} cols={5} />
            ) : (
              <TableBody>
                {(data?.items ?? []).map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-medium">{j.eventName}</TableCell>
                    <TableCell className="text-sm">{j.guestName ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{j.copies}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[j.status] ?? "muted"}>{j.status}</Badge>
                      {j.failureReason ? (
                        <p className="mt-0.5 max-w-xs truncate text-xs text-destructive">{j.failureReason}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {format(new Date(j.createdAt), "d MMM, HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
                {data && data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <EmptyState icon={Printer} title="No print jobs" description="Print jobs appear when operators print sessions." className="border-0" />
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
