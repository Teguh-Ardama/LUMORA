"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  Cable,
  CloudUpload,
  ImagePlus,
  Inbox,
  MonitorPlay,
  RotateCcw,
  Sparkles,
  Wand2,
} from "lucide-react";
import { filterParamsSchema } from "@lumora/contracts";
import { cssFilterFromParams } from "@/lib/preview/css-filter";
import { useOfflineUploads } from "@/lib/hooks/use-offline-uploads";
import {
  Badge,
  Button,
  Card,
  CardContent,
  ErrorState,
  Label,
  LoadingState,
  ScrollArea,
  Switch,
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
  useStickers,
  type SessionPayload,
} from "@/lib/hooks/use-operator";
import { WebcamPanel } from "@/components/operator/webcam-panel";
import { DeliveryPanel } from "@/components/operator/delivery-panel";
import { StickerPad } from "@/components/operator/sticker-pad";
import { ApiClientError } from "@/lib/api";

/** The composer stretches borders to fill the layout canvas exactly — a
 * portrait border on a landscape layout (or vice versa) ships a warped
 * frame in the final photo, so only orientation-matching borders are
 * offered per layout. */
function isLandscape(dims: { width: number; height: number }): boolean {
  return dims.width >= dims.height;
}

export default function OperatorWorkspacePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data: ctx, isLoading, isError, refetch } = useOperatorContext(eventId);

  const startSession = useStartSession(eventId);
  const updateSession = useUpdateSession(eventId);
  const offline = useOfflineUploads(eventId);
  const [frameBusy, setFrameBusy] = React.useState(false);
  const compose = useCompose(eventId);
  const attachPhoto = useAttachPhoto(eventId);
  const { data: quarantine } = useQuarantine(eventId);
  const { data: stickersData } = useStickers();

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

  // Keep the pre-session border pick orientation-matched to the layout —
  // catches both a manual layout switch and mismatched event defaults.
  React.useEffect(() => {
    if (!ctx || !layoutId) return;
    const layout = ctx.layouts.find((l) => l.id === layoutId);
    if (!layout) return;
    const current = ctx.borders.find((b) => b.id === borderId);
    if (current && isLandscape(current) !== isLandscape(layout.config.canvas)) {
      const fallback = ctx.borders.find((b) => isLandscape(b) === isLandscape(layout.config.canvas));
      setBorderId(fallback?.id ?? "");
    }
  }, [ctx, layoutId, borderId]);

  useEventStream(eventId, (event) => {
    if (event.type === "photo.quarantined") {
      toast.info("A DSLR photo arrived outside a session — check the inbox");
    }
    if (event.type === "session.status" && event.status === "FAILED") {
      toast.error("Compose failed — you can retry from the session panel");
    }
  });

  // All hooks live above the loading/error guards (rules of hooks).
  const session = ctx?.activeSession ?? null;
  const lastLutFilterId = React.useRef<string | null>(null);
  const lastBorderId = React.useRef<string | null>(null);
  if (session && session.filter.kind !== "NORMAL") lastLutFilterId.current = session.filter.id;
  if (session?.border) lastBorderId.current = session.border.id;

  const activeFilterParams = React.useMemo(() => {
    const raw = ctx?.filters.find((f) => f.id === session?.filter.id)?.params;
    const parsed = filterParamsSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }, [ctx?.filters, session?.filter.id]);

  if (isLoading) return <LoadingState label="Preparing workspace…" className="min-h-screen" />;
  if (isError || !ctx) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <ErrorState message="Could not open this event. You may not be assigned to it." onRetry={() => refetch()} />
      </div>
    );
  }

  const selectedLayout = ctx.layouts.find((l) => l.id === (session?.layout.id ?? layoutId));
  const compatibleBorders = selectedLayout
    ? ctx.borders.filter((b) => isLandscape(b) === isLandscape(selectedLayout.config.canvas))
    : ctx.borders;
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
    setFrameBusy(true);
    try {
      const result = await offline.uploadOrQueue({
        sessionId: session.id,
        blob,
        sequence: session.photos.length,
      });
      if (result === "queued") {
        toast.warning("Koneksi bermasalah — foto disimpan offline dan akan di-upload otomatis");
      }
    } finally {
      setFrameBusy(false);
    }
  };

  const changeSetting = (patch: Record<string, unknown>) => {
    if (!session) return;
    updateSession.mutate(
      { sessionId: session.id, ...patch },
      { onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Update failed") },
    );
  };

  // ── LUT / border quick-toggles (FR-05 UX) ───────────────────────────────
  const normalFilter = ctx.filters.find((f) => f.kind === "NORMAL");
  const lutEnabled = Boolean(session && session.filter.kind !== "NORMAL");
  const borderEnabled = Boolean(session?.border);

  const toggleLut = (on: boolean) => {
    if (!session || !normalFilter) return;
    const fallback = ctx.filters.find((f) => f.kind !== "NORMAL");
    const target = on ? (lastLutFilterId.current ?? fallback?.id) : normalFilter.id;
    if (target) changeSetting({ filterId: target });
  };

  const toggleBorder = (on: boolean) => {
    if (!session) return;
    const target = on
      ? (lastBorderId.current ?? ctx.event.defaultBorderId ?? ctx.borders[0]?.id ?? null)
      : null;
    changeSetting({ borderId: target });
  };

  // Live preview inputs for the capture feed.
  const previewCssFilter = cssFilterFromParams(activeFilterParams, lutEnabled);
  const borderOverlayUrl = session?.border && framesCaptured >= framesTotal
    ? (ctx.borders.find((b) => b.id === session.border!.id)?.imageUrl ?? null)
    : null;

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
          {offline.pendingCount > 0 ? (
            <Badge variant="warning">
              <CloudUpload className="h-3 w-3" /> {offline.pendingCount} pending upload
            </Badge>
          ) : null}
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
                        {ctx.layouts.map((l) => (
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
                        {compatibleBorders.map((b) => (
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
                        {ctx.filters.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button className="w-full" size="lg" onClick={handleStart} loading={startSession.isPending}>
                  Start session
                </Button>
              </CardContent>
            </Card>
          ) : session.status === "CAPTURING" && framesCaptured >= framesTotal ? (
            <div className="h-full bg-card rounded-lg border p-4">
              <StickerPad
                session={session}
                stickers={stickersData?.stickers ?? []}
                isComposing={compose.isPending}
                onCompose={(appliedStickers) =>
                  compose.mutate(
                    { sessionId: session.id, appliedStickers },
                    { onError: (err) => toast.error(err instanceof ApiClientError ? err.message : "Compose failed") },
                  )
                }
              />
            </div>
          ) : session.status === "CAPTURING" && session.captureSource === "WEBCAM" ? (
            <WebcamPanel
              countdownSeconds={ctx.event.countdownSeconds}
              framesCaptured={framesCaptured}
              framesTotal={framesTotal}
              disabled={frameBusy}
              previewCssFilter={previewCssFilter}
              borderOverlayUrl={borderOverlayUrl}
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
                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">Color grade (LUT)</p>
                        <p className="text-xs text-muted-foreground">Live preview on the camera feed</p>
                      </div>
                      <Switch checked={lutEnabled} onCheckedChange={toggleLut} aria-label="Toggle color grade" />
                    </div>
                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">Border / frame</p>
                        <p className="text-xs text-muted-foreground">Applied on the final 4R composition</p>
                      </div>
                      <Switch checked={borderEnabled} onCheckedChange={toggleBorder} aria-label="Toggle border" />
                    </div>
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
                      <Select
                        value={session.layout.id}
                        onValueChange={(v) => {
                          const newLayout = ctx.layouts.find((l) => l.id === v);
                          const currentBorder = ctx.borders.find((b) => b.id === session.border?.id);
                          const mismatched =
                            newLayout && currentBorder && isLandscape(currentBorder) !== isLandscape(newLayout.config.canvas);
                          changeSetting(mismatched ? { layoutId: v, borderId: null } : { layoutId: v });
                        }}
                      >
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
                          {compatibleBorders.map((b) => (
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
              {session.status === "FAILED" ? (
                <Button
                  className="w-full"
                  size="lg"
                  loading={compose.isPending}
                  onClick={() =>
                    compose.mutate(
                      { sessionId: session.id },
                      {
                        onError: (err) =>
                          toast.error(err instanceof ApiClientError ? err.message : "Compose failed"),
                      },
                    )
                  }
                >
                  <Sparkles /> Retry compose
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
