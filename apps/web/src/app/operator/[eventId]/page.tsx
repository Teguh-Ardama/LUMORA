"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  Cable,
  ImagePlus,
  Inbox,
  MonitorPlay,
  RotateCcw,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  ErrorState,
  Label,
  LoadingState,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  Spinner,
  cn,
  toast,
} from "@lumora/ui";
import {
  useAttachPhoto,
  useCompose,
  useEventStream,
  useOperatorContext,
  useQuarantine,
  useStartSession,
  useUpdateSession,
  useUploadPhoto,
  type SessionPayload,
} from "@/lib/hooks/use-operator";
import { WebcamPanel } from "@/components/operator/webcam-panel";
import { DeliveryPanel } from "@/components/operator/delivery-panel";
import { ApiClientError } from "@/lib/api";

export default function OperatorWorkspacePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data: ctx, isLoading, isError, refetch } = useOperatorContext(eventId);

  const startSession = useStartSession(eventId);
  const updateSession = useUpdateSession(eventId);
  const uploadPhoto = useUploadPhoto();
  const compose = useCompose(eventId);
  const attachPhoto = useAttachPhoto(eventId);
  const { data: quarantine } = useQuarantine(eventId);

  const [captureSource, setCaptureSource] = React.useState<"WEBCAM" | "BRIDGE">("WEBCAM");
  const [layoutId, setLayoutId] = React.useState<string>("");
  const [borderId, setBorderId] = React.useState<string>("");
  const [filterId, setFilterId] = React.useState<string>("");

  // Seed selections from event defaults once the context arrives.
  React.useEffect(() => {
    if (!ctx) return;
    setLayoutId((prev) => prev || ctx.event.defaultLayoutId || ctx.layouts[0]?.id || "");
    setBorderId((prev) => prev || ctx.event.defaultBorderId || "");
    setFilterId((prev) => prev || ctx.filters[0]?.id || "");
  }, [ctx]);

  useEventStream(eventId, (event) => {
    if (event.type === "photo.quarantined") {
      toast.info("A DSLR photo arrived outside a session — check the inbox");
    }
    if (event.type === "session.status" && event.status === "FAILED") {
      toast.error("Compose failed — you can retry from the session panel");
    }
  });

  if (isLoading) return <LoadingState label="Preparing workspace…" className="min-h-screen" />;
  if (isError || !ctx) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <ErrorState message="Could not open this event. You may not be assigned to it." onRetry={() => refetch()} />
      </div>
    );
  }

  const session = ctx.activeSession;
  const selectedLayout = ctx.layouts.find((l) => l.id === (session?.layout.id ?? layoutId));
  const framesTotal = session
    ? Math.max(...session.layout.config.slots.map((s) => s.photoIndex)) + 1
    : selectedLayout
      ? selectedLayout.photoCount
      : ctx.event.framesPerSession;
  const framesCaptured = session?.photos.length ?? 0;
  const canCompose = session?.status === "CAPTURING" && framesCaptured >= framesTotal;
  const bridgeOnline = ctx.bridgeDevices.some((d) => d.status === "ONLINE");

  const handleStart = async () => {
    if (!layoutId || !filterId) {
      toast.error("Pick a layout and a filter first");
      return;
    }
    try {
      await startSession.mutateAsync({
        captureSource,
        layoutId,
        borderId: borderId || null,
        filterId,
      });
      toast.success("New session started — previous QR is now invalid");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not start the session");
    }
  };

  const handleFrame = async (blob: Blob) => {
    if (!session) return;
    await uploadPhoto.mutateAsync({ sessionId: session.id, blob, sequence: session.photos.length });
  };

  const changeSetting = (patch: Record<string, unknown>) => {
    if (!session) return;
    updateSession.mutate(
      { sessionId: session.id, ...patch },
      { onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Update failed") },
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Workspace header */}
      <header className="glass sticky top-0 z-40 flex h-14 items-center gap-3 border-b px-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to event picker">
          <Link href="/operator">
            <ArrowLeft />
          </Link>
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{ctx.event.name}</p>
          <p className="truncate text-xs text-muted-foreground">{ctx.event.venue ?? "Operator Workspace"}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={`/operator/${eventId}/display`} target="_blank" rel="noopener noreferrer">
              <MonitorPlay /> Display
            </a>
          </Button>
          <Badge variant={bridgeOnline ? "success" : "muted"}>
            <Cable className="h-3 w-3" /> Bridge {bridgeOnline ? "online" : "offline"}
          </Badge>
          {session ? (
            <Badge
              variant={
                session.status === "READY" ? "success" : session.status === "FAILED" ? "destructive" : "secondary"
              }
            >
              {session.status}
            </Badge>
          ) : null}
          <QuarantineSheet
            photos={quarantine?.photos ?? []}
            session={session}
            onAttach={(photoId) => {
              if (!session) return;
              attachPhoto.mutate(
                { sessionId: session.id, photoId, sequence: session.photos.length },
                {
                  onSuccess: () => toast.success("Photo attached to the session"),
                  onError: () => toast.error("Could not attach the photo"),
                },
              );
            }}
          />
        </div>
      </header>

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[1fr_360px]">
        {/* ── Capture area ─────────────────────────────────────────────── */}
        <div className="min-h-[420px]">
          {!session || session.status === "CLOSED" ? (
            <StartPanel
              captureSource={captureSource}
              setCaptureSource={setCaptureSource}
              bridgeOnline={bridgeOnline}
              onStart={handleStart}
              starting={startSession.isPending}
            />
          ) : session.status === "CAPTURING" && session.captureSource === "WEBCAM" ? (
            <WebcamPanel
              countdownSeconds={ctx.event.countdownSeconds}
              framesCaptured={framesCaptured}
              framesTotal={framesTotal}
              disabled={uploadPhoto.isPending}
              onFrame={handleFrame}
            />
          ) : session.status === "CAPTURING" ? (
            <BridgeWaitPanel framesCaptured={framesCaptured} framesTotal={framesTotal} bridgeOnline={bridgeOnline} />
          ) : (
            <ComposedPreview session={session} />
          )}
        </div>

        {/* ── Session panel ────────────────────────────────────────────── */}
        <div className="space-y-4">
          {session && session.status !== "CLOSED" ? (
            <>
              {/* Frames strip */}
              <Card>
                <CardContent className="p-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Frames ({framesCaptured}/{framesTotal})
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: framesTotal }).map((_, i) => {
                      const photo = session.photos.find((p) => p.sequence === i) ?? session.photos[i];
                      return photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={photo.id}
                          src={photo.url}
                          alt={`Frame ${i + 1}`}
                          className="aspect-[3/2] rounded-md border object-cover"
                        />
                      ) : (
                        <div
                          key={`empty-${i}`}
                          className="flex aspect-[3/2] items-center justify-center rounded-md border border-dashed bg-muted/40"
                        >
                          <ImagePlus className="h-4 w-4 text-muted-foreground/60" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Per-session settings (FR-05 filter selection) */}
              {session.status === "CAPTURING" ? (
                <Card>
                  <CardContent className="space-y-3 p-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                        <Wand2 className="mr-1 inline h-3 w-3" /> Filter (guest request)
                      </Label>
                      <Select value={session.filter.id} onValueChange={(v) => changeSetting({ filterId: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ctx.filters.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Layout</Label>
                      <Select value={session.layout.id} onValueChange={(v) => changeSetting({ layoutId: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ctx.layouts.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.name} ({l.photoCount})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Border</Label>
                      <Select
                        value={session.border?.id ?? "none"}
                        onValueChange={(v) => changeSetting({ borderId: v === "none" ? null : v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No border</SelectItem>
                          {ctx.borders.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {/* Actions */}
              {session.status === "CAPTURING" || session.status === "FAILED" ? (
                <Button
                  className="w-full"
                  size="lg"
                  disabled={!canCompose && session.status !== "FAILED"}
                  loading={compose.isPending}
                  onClick={() =>
                    compose.mutate(session.id, {
                      onError: (err) =>
                        toast.error(err instanceof ApiClientError ? err.message : "Compose failed"),
                    })
                  }
                >
                  <Sparkles /> {session.status === "FAILED" ? "Retry compose" : "Compose photo"}
                </Button>
              ) : null}

              {session.status === "COMPOSING" ? (
                <Card>
                  <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
                    <Spinner /> Composing photo + border + filter…
                  </CardContent>
                </Card>
              ) : null}

              {session.status === "FAILED" && session.composeError ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                  {session.composeError}
                </p>
              ) : null}

              {session.status === "READY" && session.composedUrl ? (
                <DeliveryPanel sessionId={session.id} composedUrl={session.composedUrl} />
              ) : null}

              {/* FR-06: New Session resets the QR server-side */}
              <Button variant="outline" className="w-full" onClick={handleStart} loading={startSession.isPending}>
                <RotateCcw /> New session
              </Button>
            </>
          ) : (
            <Card>
              <CardContent className="p-4 text-sm text-muted-foreground">
                Configure the session on the left and press <span className="font-medium text-foreground">Start session</span>{" "}
                when the guest is ready.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );

  // ── Start panel (no active session) ────────────────────────────────────
  function StartPanel({
    captureSource,
    setCaptureSource,
    bridgeOnline,
    onStart,
    starting,
  }: {
    captureSource: "WEBCAM" | "BRIDGE";
    setCaptureSource: (v: "WEBCAM" | "BRIDGE") => void;
    bridgeOnline: boolean;
    onStart: () => void;
    starting: boolean;
  }) {
    return (
      <Card className="flex h-full flex-col justify-center">
        <CardContent className="mx-auto w-full max-w-md space-y-5 p-8">
          <div className="text-center">
            <h2 className="text-lg font-semibold">Start a guest session</h2>
            <p className="text-sm text-muted-foreground">Pick the camera source and booth settings.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCaptureSource("WEBCAM")}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors",
                captureSource === "WEBCAM" ? "border-primary bg-accent" : "hover:bg-accent/50",
              )}
            >
              <Camera className="h-5 w-5" /> Webcam
            </button>
            <button
              type="button"
              onClick={() => setCaptureSource("BRIDGE")}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors",
                captureSource === "BRIDGE" ? "border-primary bg-accent" : "hover:bg-accent/50",
              )}
            >
              <Cable className="h-5 w-5" />
              DSLR Bridge
              <span className={cn("text-xs", bridgeOnline ? "text-success" : "text-muted-foreground")}>
                {bridgeOnline ? "online" : "offline"}
              </span>
            </button>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Layout</Label>
              <Select value={layoutId} onValueChange={setLayoutId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a layout" />
                </SelectTrigger>
                <SelectContent>
                  {ctx!.layouts.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} · {l.mode} · {l.photoCount} photos
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Border</Label>
              <Select value={borderId || "none"} onValueChange={(v) => setBorderId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="No border" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No border</SelectItem>
                  {ctx!.borders.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Filter</Label>
              <Select value={filterId} onValueChange={setFilterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a filter" />
                </SelectTrigger>
                <SelectContent>
                  {ctx!.filters.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button className="w-full" size="lg" onClick={onStart} loading={starting}>
            Start session
          </Button>
        </CardContent>
      </Card>
    );
  }
}

// ── Bridge waiting panel ───────────────────────────────────────────────────
function BridgeWaitPanel({
  framesCaptured,
  framesTotal,
  bridgeOnline,
}: {
  framesCaptured: number;
  framesTotal: number;
  bridgeOnline: boolean;
}) {
  return (
    <Card className="flex h-full flex-col items-center justify-center">
      <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Cable className={cn("h-7 w-7", bridgeOnline ? "text-success" : "text-muted-foreground")} />
          {bridgeOnline ? (
            <span className="absolute inset-0 animate-ping rounded-full bg-success/10" />
          ) : null}
        </span>
        <div>
          <p className="font-medium">
            {bridgeOnline ? "Waiting for DSLR shots…" : "Bridge is offline"}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {bridgeOnline
              ? `Shoot with the tethered camera — frames land here automatically (${framesCaptured}/${framesTotal}).`
              : "Open the LUMORA Bridge app on the camera laptop and check its connection."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Composed preview ───────────────────────────────────────────────────────
function ComposedPreview({ session }: { session: SessionPayload }) {
  return (
    <Card className="flex h-full items-center justify-center overflow-hidden">
      <CardContent className="flex h-full w-full items-center justify-center p-4">
        <AnimatePresence mode="wait">
          {session.composedUrl ? (
            <motion.img
              key={session.composedUrl}
              src={session.composedUrl}
              alt="Composed result"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="max-h-full max-w-full rounded-lg border shadow-card"
            />
          ) : (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-lg">
              <Skeleton className="aspect-[3/2] w-full" />
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

// ── Quarantine inbox (unmatched DSLR uploads) ──────────────────────────────
function QuarantineSheet({
  photos,
  session,
  onAttach,
}: {
  photos: Array<{ id: string; originalFilename: string | null; url: string; createdAt: string }>;
  session: SessionPayload | null;
  onAttach: (photoId: string) => void;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Inbox /> Inbox
          {photos.length > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {photos.length}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Unmatched DSLR photos</SheetTitle>
          <SheetDescription>
            Shots that arrived while no bridge session was capturing. Attach them to the active session or leave them here.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="mt-4 h-[calc(100vh-160px)] pr-3">
          {photos.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Inbox is empty.</p>
          ) : (
            <div className="space-y-3">
              {photos.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.originalFilename ?? "Quarantined photo"} className="h-14 w-20 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{p.originalFilename ?? "untitled"}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!session || session.status !== "CAPTURING"}
                    onClick={() => onAttach(p.id)}
                  >
                    Attach
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
