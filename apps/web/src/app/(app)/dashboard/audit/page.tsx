"use client";

import * as React from "react";
import { format } from "date-fns";
import { ScrollText } from "lucide-react";
import { AuditAction } from "@lumora/contracts";
import {
  Badge,
  EmptyState,
  ErrorState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { useAuditLogs } from "@/lib/hooks/use-admin";

export default function AuditPage() {
  const [page, setPage] = React.useState(1);
  const [action, setAction] = React.useState<string | undefined>(undefined);
  const { data, isLoading, isError, refetch } = useAuditLogs({ page, action });

  return (
    <div>
      <Toolbar
        title="Audit Log"
        description="An immutable trail of every consequential action in your organization."
        actions={
          <Select
            value={action ?? "all"}
            onValueChange={(v) => {
              setAction(v === "all" ? undefined : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {Object.values(AuditAction).map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            {isLoading ? (
              <TableSkeleton rows={10} cols={5} />
            ) : (
              <TableBody>
                {(data?.items ?? []).map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {format(new Date(log.createdAt), "d MMM yyyy, HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{log.actorName ?? "System"}</p>
                      <p className="text-xs text-muted-foreground">{log.actorType}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.action}</Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{log.entityType}</p>
                      {log.entityId ? (
                        <p className="font-mono text-[11px] text-muted-foreground">{log.entityId.slice(0, 8)}…</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.ip ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {data && data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <EmptyState icon={ScrollText} title="No audit entries" className="border-0" />
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
