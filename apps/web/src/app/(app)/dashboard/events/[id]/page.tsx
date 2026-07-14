"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { Camera, Copy, MonitorSmartphone, Plug, Trash2, Users } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
  ErrorState,
  LoadingState,
  Separator,
  Switch,
  Toolbar,
  toast,
} from "@lumora/ui";
import {
  useAssignOperators,
  useCreatePairingCode,
  useEvent,
  useRevokeBridgeDevice,
  useUpdateEvent,
} from "@/lib/hooks/use-events";
import { useMembers } from "@/lib/hooks/use-admin";
import { StatTile } from "@/components/analytics/charts";

function PairingDialog({ eventId, open, onOpenChange }: { eventId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const mint = useCreatePairingCode(eventId);
  const [code, setCode] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setCode(null);
      mint.mutate(undefined, {
        onSuccess: (data) => setCode(data.code),
        onError: () => toast.error("Could not create a pairing code"),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Pair Desktop Bridge</DialogTitle>
          <DialogDescription>
            Enter this code in the LUMORA Bridge app on the camera laptop. The code expires in 10 minutes.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center py-4">
          {code ? (
            <button
              type="button"
              className="rounded-lg border bg-muted px-6 py-4 font-mono text-3xl font-semibold tracking-[0.3em] hover:bg-accent"
              onClick={() => {
                void navigator.clipboard.writeText(code);
                toast.success("Code copied");
              }}
            >
              {code}
            </button>
          ) : (
            <LoadingState label="Generating code…" className="py-4" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, refetch } = useEvent(id);
  const update = useUpdateEvent(id);
  const assign = useAssignOperators(id);
  const revokeDevice = useRevokeBridgeDevice(id);
  const { data: membersData } = useMembers();
  const [pairingOpen, setPairingOpen] = React.useState(false);

  if (isLoading) return <LoadingState label="Loading event…" />;
  if (isError || !data) return <ErrorState message="Could not load this event." onRetry={() => refetch()} />;

  const event = data.event;
  const assignedIds = new Set(event.operators.map((o) => o.id));
  const members = membersData?.members ?? [];

  const toggleOperator = (userId: string, next: boolean) => {
    const ids = next ? [...assignedIds, userId] : [...assignedIds].filter((x) => x !== userId);
    assign.mutate([...new Set(ids)], {
      onError: () => toast.error("Could not update operators"),
    });
  };

  const operatorUrl = typeof window !== "undefined" ? `${window.location.origin}/operator/${event.id}` : "";

  return (
    <div>
      <Toolbar
        title={event.name}
        description={`${event.clientName ?? "—"}${event.venue ? ` · ${event.venue}` : ""} · ${format(new Date(event.startsAt), "d MMM yyyy")} – ${format(new Date(event.endsAt), "d MMM yyyy")}`}
        actions={
          <>
            <Badge variant={event.status === "ACTIVE" ? "success" : "secondary"}>{event.status}</Badge>
            <Button variant="outline" onClick={() => setPairingOpen(true)}>
              <Plug /> Pair Bridge
            </Button>
            <Button asChild>
              <Link href={`/operator/${event.id}`}>
                <Camera /> Operator Console
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Sessions" value={String(event._count.sessions)} />
        <StatTile label="Photos" value={String(event._count.photos)} />
        <StatTile label="Print jobs" value={String(event._count.printJobs)} />
        <StatTile label="Frames / session" value={String(event.framesPerSession)} hint={`${event.countdownSeconds}s countdown`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MonitorSmartphone className="h-4 w-4" /> Operator URL
            </CardTitle>
            <CardDescription>
              Share this with your operators. They must sign in and be assigned below before the console opens.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border bg-muted px-3 py-2 text-xs">{operatorUrl}</code>
            <Button
              variant="outline"
              size="icon"
              aria-label="Copy operator URL"
              onClick={() => {
                void navigator.clipboard.writeText(operatorUrl);
                toast.success("Operator URL copied");
              }}
            >
              <Copy />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" /> Assigned operators
            </CardTitle>
            <CardDescription>OPERATOR-role members can only open events they are assigned to.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">Invite members from the Members page first.</p>
            ) : (
              members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.email} · {m.role}
                    </p>
                  </div>
                  <Switch
                    checked={assignedIds.has(m.userId)}
                    onCheckedChange={(v) => toggleOperator(m.userId, v)}
                    disabled={assign.isPending}
                    aria-label={`Assign ${m.name}`}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Bridge devices</CardTitle>
          <CardDescription>DSLR laptops paired to this event via the Desktop Bridge.</CardDescription>
        </CardHeader>
        <CardContent>
          {event.bridgeDevices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No devices paired yet. Click <span className="font-medium">Pair Bridge</span> and enter the code in the desktop app.
            </p>
          ) : (
            <div className="space-y-3">
              {event.bridgeDevices.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {d.name}
                      <Badge variant={d.status === "ONLINE" ? "success" : "muted"}>{d.status}</Badge>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Queue: {d.queueDepth} · {d.watchedFolder ?? "no folder"} ·{" "}
                      {d.lastSeenAt ? `seen ${formatDistanceToNow(new Date(d.lastSeenAt), { addSuffix: true })}` : "never seen"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Revoke ${d.name}`}
                    onClick={() =>
                      revokeDevice.mutate(d.id, {
                        onSuccess: () => toast.success("Device revoked"),
                        onError: () => toast.error("Could not revoke device"),
                      })
                    }
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator className="my-6" />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Event status</p>
          <p className="text-sm text-muted-foreground">Completed events disappear from the operator console.</p>
        </div>
        <div className="flex gap-2">
          {event.status !== "ACTIVE" ? (
            <Button variant="outline" onClick={() => update.mutate({ status: "ACTIVE" }, { onSuccess: () => refetch() })}>
              Reactivate
            </Button>
          ) : (
            <Button variant="outline" onClick={() => update.mutate({ status: "COMPLETED" }, { onSuccess: () => refetch() })}>
              Mark completed
            </Button>
          )}
        </div>
      </div>

      <PairingDialog eventId={event.id} open={pairingOpen} onOpenChange={setPairingOpen} />
    </div>
  );
}
