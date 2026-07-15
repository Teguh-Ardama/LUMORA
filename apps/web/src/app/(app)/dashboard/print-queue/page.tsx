"use client";

import * as React from "react";
import { CheckCircle2, MoreHorizontal, Printer, RotateCcw, XCircle } from "lucide-react";
import { format } from "date-fns";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
  toast,
} from "@lumora/ui";
import { usePrintJobs, useUpdatePrintJob, type PrintJobItem } from "@/lib/hooks/use-admin";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted" | "secondary"> = {
  PRINTED: "success",
  PRINTING: "warning",
  QUEUED: "secondary",
  FAILED: "destructive",
  CANCELLED: "muted",
};

/**
 * Print Queue Manager: when the printer jams or runs out of paper, jobs
 * stay QUEUED/FAILED here and can be reprinted at any time — the composed
 * asset is fetched fresh via a signed URL, so no photo is ever lost.
 */
export default function PrintQueuePage() {
  const [page, setPage] = React.useState(1);
  const { data, isLoading, isError, refetch } = usePrintJobs({ page });
  const update = useUpdatePrintJob();
  const printImgRef = React.useRef<HTMLImageElement>(null);
  const [printingId, setPrintingId] = React.useState<string | null>(null);

  const reprint = async (job: PrintJobItem) => {
    if (!job.composedUrl) {
      toast.error("Print asset is unavailable for this job");
      return;
    }
    setPrintingId(job.id);
    try {
      await update.mutateAsync({ id: job.id, status: "PRINTING" });
      const img = printImgRef.current;
      if (!img) throw new Error("Print frame unavailable");
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Could not load the print image"));
        img.src = job.composedUrl!;
      });
      window.print();
      await update.mutateAsync({ id: job.id, status: "PRINTED" });
      toast.success("Job sent to the printer");
    } catch (err) {
      await update
        .mutateAsync({
          id: job.id,
          status: "FAILED",
          failureReason: err instanceof Error ? err.message : "Reprint failed",
        })
        .catch(() => undefined);
      toast.error(err instanceof Error ? err.message : "Reprint failed");
    } finally {
      setPrintingId(null);
    }
  };

  const setStatus = (job: PrintJobItem, status: "PRINTED" | "FAILED" | "CANCELLED", reason?: string) => {
    update.mutate(
      { id: job.id, status, failureReason: reason },
      {
        onSuccess: () => toast.success(`Job marked ${status.toLowerCase()}`),
        onError: () => toast.error("Could not update the job"),
      },
    );
  };

  return (
    <div>
      <Toolbar
        title="Print Queue"
        description="Every 4R print job — reprint after paper jams without losing a single photo."
      />
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            {isLoading ? (
              <TableSkeleton rows={8} cols={6} />
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
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {j.status !== "CANCELLED" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void reprint(j)}
                            loading={printingId === j.id}
                            disabled={!j.composedUrl || printingId !== null}
                          >
                            <RotateCcw /> Reprint
                          </Button>
                        ) : null}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="More actions">
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setStatus(j, "PRINTED")}>
                              <CheckCircle2 /> Mark printed
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setStatus(j, "FAILED", "Printer issue — marked by operator")}
                            >
                              <Printer /> Mark failed
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setStatus(j, "CANCELLED")}>
                              <XCircle /> Cancel job
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {data && data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState
                        icon={Printer}
                        title="No print jobs"
                        description="Print jobs appear when operators print sessions."
                        className="border-0"
                      />
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

      {/* Hidden 4R print frame (globals.css .print-area rules) */}
      <div className="print-area hidden print:block">
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img ref={printImgRef} alt="Print output" />
      </div>
    </div>
  );
}
