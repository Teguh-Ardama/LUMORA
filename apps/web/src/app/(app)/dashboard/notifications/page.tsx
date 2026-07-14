"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { BellOff, CheckCheck } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  LoadingState,
  TablePagination,
  Toolbar,
  cn,
} from "@lumora/ui";
import { useMarkAllNotificationsRead, useNotifications } from "@/lib/hooks/use-admin";

export default function NotificationsPage() {
  const [page, setPage] = React.useState(1);
  const { data, isLoading, isError, refetch } = useNotifications(page);
  const markAll = useMarkAllNotificationsRead();

  return (
    <div>
      <Toolbar
        title="Notifications"
        description="Session, delivery, and team activity."
        actions={
          <Button
            variant="outline"
            onClick={() => markAll.mutate()}
            disabled={(data?.unreadCount ?? 0) === 0}
            loading={markAll.isPending}
          >
            <CheckCheck /> Mark all read
          </Button>
        }
      />

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <LoadingState />
      ) : (data?.items.length ?? 0) === 0 ? (
        <EmptyState icon={BellOff} title="All caught up" description="New activity will show up here." />
      ) : (
        <>
          <div className="space-y-2">
            {data!.items.map((n) => (
              <Card key={n.id} className={cn(!n.readAt && "border-l-2 border-l-primary")}>
                <CardContent className="flex items-start justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-sm text-muted-foreground">{n.body}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
          {data && data.totalPages > 1 ? (
            <TablePagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
          ) : null}
        </>
      )}
    </div>
  );
}
