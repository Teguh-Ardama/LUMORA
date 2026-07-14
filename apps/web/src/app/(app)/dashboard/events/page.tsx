"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarDays, Plus, Search } from "lucide-react";
import {
  Badge,
  Button,
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
  toast,
} from "@lumora/ui";
import { useCreateEvent, useEvents } from "@/lib/hooks/use-events";
import { useBorders, useLayouts } from "@/lib/hooks/use-templates";
import { ApiClientError } from "@/lib/api";

const eventFormSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(160),
    clientName: z.string().trim().max(160).optional(),
    venue: z.string().trim().max(200).optional(),
    startsAt: z.string().min(1, "Start date is required"),
    endsAt: z.string().min(1, "End date is required"),
    defaultLayoutId: z.string().optional(),
    defaultBorderId: z.string().optional(),
    framesPerSession: z.coerce.number().int().min(1).max(6),
    countdownSeconds: z.coerce.number().int().min(0).max(10),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: "End must be after start",
    path: ["endsAt"],
  });
type EventFormValues = z.infer<typeof eventFormSchema>;

const STATUS_VARIANT: Record<string, "success" | "muted" | "secondary" | "warning"> = {
  ACTIVE: "success",
  DRAFT: "secondary",
  COMPLETED: "muted",
  ARCHIVED: "muted",
};

function CreateEventDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const create = useCreateEvent();
  const { data: layouts } = useLayouts();
  const { data: borders } = useBorders();

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: { name: "", clientName: "", venue: "", startsAt: "", endsAt: "", framesPerSession: 4, countdownSeconds: 3 },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        name: values.name,
        clientName: values.clientName || undefined,
        venue: values.venue || undefined,
        startsAt: new Date(values.startsAt).toISOString(),
        endsAt: new Date(values.endsAt).toISOString(),
        defaultLayoutId: values.defaultLayoutId || undefined,
        defaultBorderId: values.defaultBorderId || undefined,
        framesPerSession: values.framesPerSession,
        countdownSeconds: values.countdownSeconds,
      });
      toast.success("Event created");
      onOpenChange(false);
      form.reset();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not create the event");
    }
  });

  const err = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create event</DialogTitle>
          <DialogDescription>Configure the booth defaults; operators can adjust per session.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="ev-name">Event name</Label>
            <Input id="ev-name" placeholder="Nadia & Bima Wedding" {...form.register("name")} />
            {err.name ? <p className="text-xs text-destructive">{err.name.message}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ev-client">Client</Label>
              <Input id="ev-client" placeholder="Client name" {...form.register("clientName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-venue">Venue</Label>
              <Input id="ev-venue" placeholder="Grand Ballroom" {...form.register("venue")} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ev-start">Starts</Label>
              <Input id="ev-start" type="datetime-local" {...form.register("startsAt")} />
              {err.startsAt ? <p className="text-xs text-destructive">{err.startsAt.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-end">Ends</Label>
              <Input id="ev-end" type="datetime-local" {...form.register("endsAt")} />
              {err.endsAt ? <p className="text-xs text-destructive">{err.endsAt.message}</p> : null}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Default layout</Label>
              <Select onValueChange={(v) => form.setValue("defaultLayoutId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a layout" />
                </SelectTrigger>
                <SelectContent>
                  {(layouts?.layouts ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default border</Label>
              <Select onValueChange={(v) => form.setValue("defaultBorderId", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a border" />
                </SelectTrigger>
                <SelectContent>
                  {(borders?.borders ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ev-frames">Frames per session</Label>
              <Input id="ev-frames" type="number" min={1} max={6} {...form.register("framesPerSession")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-countdown">Countdown (seconds)</Label>
              <Input id="ev-countdown" type="number" min={0} max={10} {...form.register("countdownSeconds")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function EventsPage() {
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, refetch } = useEvents({ page, search: debounced || undefined });

  return (
    <div>
      <Toolbar
        title="Events"
        description="Every booth engagement your organization runs."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus /> New event
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search events…" className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {isError ? (
        <ErrorState message="Could not load events." onRetry={() => refetch()} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead>Operators</TableHead>
              </TableRow>
            </TableHeader>
            {isLoading ? (
              <TableSkeleton rows={6} cols={5} />
            ) : (
              <TableBody>
                {(data?.items ?? []).map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <Link href={`/dashboard/events/${event.id}`} className="font-medium hover:underline">
                        {event.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {event.clientName ?? "—"} {event.venue ? `· ${event.venue}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {format(new Date(event.startsAt), "d MMM yyyy")} – {format(new Date(event.endsAt), "d MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[event.status] ?? "secondary"}>{event.status}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">{event.sessionCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {event.operators.length > 0 ? event.operators.map((o) => o.name).join(", ") : "Unassigned"}
                    </TableCell>
                  </TableRow>
                ))}
                {data && data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <EmptyState
                        icon={CalendarDays}
                        title="No events yet"
                        description="Create your first event to generate an operator URL and start capturing."
                        action={
                          <Button size="sm" onClick={() => setCreateOpen(true)}>
                            <Plus /> New event
                          </Button>
                        }
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

      <CreateEventDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
