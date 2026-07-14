"use client";

import { Download, FolderDown } from "lucide-react";
import {
  Button,
  EmptyState,
  ErrorState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
  Toolbar,
} from "@lumora/ui";
import { format } from "date-fns";
import { useEvents } from "@/lib/hooks/use-events";

export default function DownloadsPage() {
  const { data, isLoading, isError, refetch } = useEvents({ page: 1 });

  return (
    <div>
      <Toolbar
        title="Downloads"
        description="Export every composed photo of an event as a ZIP archive."
      />
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead className="text-right">Export</TableHead>
            </TableRow>
          </TableHeader>
          {isLoading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : (
            <TableBody>
              {(data?.items ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {format(new Date(e.startsAt), "d MMM yyyy")}
                  </TableCell>
                  <TableCell className="tabular-nums">{e.sessionCount}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/api/gallery/download/${e.id}`} download>
                        <Download /> ZIP
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {data && data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="p-0">
                    <EmptyState icon={FolderDown} title="Nothing to export" description="Create an event and run sessions first." className="border-0" />
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          )}
        </Table>
      )}
    </div>
  );
}
