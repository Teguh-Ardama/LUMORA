"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";
import { format } from "date-fns";
import { Aperture, Camera, Mail, MessageCircle, Printer, Send } from "lucide-react";
import {
  Badge,
  Button,
  ErrorState,
  Input,
  LoadingState,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
  toast,
} from "@lumora/ui";
import {
  useEventStream,
  useMintQr,
  useOperatorContext,
  usePrint,
  useRequestDelivery,
  type SessionPayload,
} from "@/lib/hooks/use-operator";
import { apiClient, ApiClientError } from "@/lib/api";

/**
 * Dual-device Display Mode — the laptop screen facing the guest.
 * Listens to the event SSE stream; when the phone-operated session hits
 * READY the big QR + delivery form appears automatically. A new session
 * clears the QR instantly (FR-06) — no refresh, ever.
 */
export default function DisplayModePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data: ctx, isLoading, isError, refetch } = useOperatorContext(eventId);
  useEventStream(eventId);

  const session = ctx?.activeSession ?? null;
  const phase: "IDLE" | "CAPTURING" | "COMPOSING" | "READY" | "FAILED" =
    !session || session.status === "CLOSED"
      ? "IDLE"
      : (session.status as "CAPTURING" | "COMPOSING" | "READY" | "FAILED");

  if (isLoading) return <LoadingState label="Connecting display…" className="min-h-screen" />;
  if (isError || !ctx) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <ErrorState message="Could not open this event display." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Status pill */}
      <div className="flex justify-center pt-5">
        <span className="glass flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium shadow-card">
          <span className={cn("h-2 w-2 rounded-full", phase === "IDLE" ? "bg-muted-foreground/50" : "bg-success")} />
          Device Synced ·{" "}
          {phase === "IDLE"
            ? "Waiting"
            : phase === "CAPTURING"
              ? "Capturing"
              : phase === "COMPOSING"
                ? "Processing"
                : phase === "READY"
                  ? "Ready"
                  : "Attention"}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <AnimatePresence mode="wait">
          {phase === "READY" && session?.composedUrl ? (
            <ReadyView key={`ready-${session.id}`} eventName={ctx.event.name} session={session} />
          ) : (
            <motion.div
              key={`ambient-${phase}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-6 text-center"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-card">
                <Aperture className="h-8 w-8" />
              </span>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">{ctx.event.name}</h1>
                <p className="mt-1 text-muted-foreground">{format(new Date(), "d MMMM yyyy")}</p>
              </div>
              {phase === "IDLE" ? (
                <p className="max-w-sm text-muted-foreground">
                  Selamat datang! Silakan menuju booth — operator kami siap memotret kamu. 📸
                </p>
              ) : phase === "CAPTURING" ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2 text-lg font-medium">
                    <Camera className="h-5 w-5" /> Sesi berlangsung…
                  </div>
                  <div className="flex gap-2">
                    {Array.from({
                      length: Math.max(...(session?.layout.config.slots.map((s) => s.photoIndex) ?? [0])) + 1,
                    }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-2.5 w-8 rounded-full transition-colors",
                          i < (session?.photos.length ?? 0) ? "bg-success" : "bg-muted",
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {session?.photos.length ?? 0} foto diambil — senyum terus! ✨
                  </p>
                </div>
              ) : phase === "COMPOSING" ? (
                <div className="flex items-center gap-3 text-lg text-muted-foreground">
                  <Spinner className="h-5 w-5" /> Meracik foto kamu…
                </div>
              ) : (
                <Badge variant="warning">Operator sedang menangani sesi ini</Badge>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ReadyView({ eventName, session }: { eventName: string; session: SessionPayload }) {
  const mintQr = useMintQr();
  const requestDelivery = useRequestDelivery();
  const print = usePrint();

  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const [waNumber, setWaNumber] = React.useState("");
  const [email, setEmail] = React.useState("");
  const printImgRef = React.useRef<HTMLImageElement>(null);
  const mintedFor = React.useRef<string | null>(null);

  // Auto-mint the QR exactly once per session; unmount (new session) kills it.
  React.useEffect(() => {
    if (mintedFor.current === session.id) return;
    mintedFor.current = session.id;
    void mintQr
      .mutateAsync(session.id)
      .then(async ({ url }) => setQrDataUrl(await QRCode.toDataURL(url, { width: 560, margin: 1 })))
      .catch(() => toast.error("Gagal membuat QR — operator dapat mencoba dari console"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id]);

  const sendWhatsApp = async () => {
    try {
      const result = await requestDelivery.mutateAsync({
        sessionId: session.id,
        channel: "WHATSAPP",
        waNumber: waNumber.trim(),
      });
      if (result.waLink) window.open(result.waLink, "_blank", "noopener,noreferrer");
      toast.success("Link foto dikirim via WhatsApp");
      setWaNumber("");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Pengiriman gagal");
    }
  };

  const sendEmail = async () => {
    try {
      await requestDelivery.mutateAsync({ sessionId: session.id, channel: "EMAIL", email: email.trim() });
      toast.success("Link foto dikirim ke email");
      setEmail("");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Pengiriman gagal");
    }
  };

  const doPrint = async () => {
    try {
      const { job } = await print.mutateAsync({ sessionId: session.id, copies: 1 });
      const img = printImgRef.current;
      if (!img || !job.composedUrl) throw new Error("Print asset unavailable");
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Could not load the print image"));
        img.src = job.composedUrl!;
      });
      window.print();
      await apiClient.patch(`/api/print-jobs/${job.id}`, { status: "PRINTED" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Print gagal");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="grid w-full max-w-5xl gap-8 rounded-2xl border bg-card p-8 shadow-overlay lg:grid-cols-[minmax(0,380px)_1fr]"
    >
      {/* Composed preview */}
      <div className="flex items-center justify-center rounded-xl bg-muted/40 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={session.composedUrl!}
          alt={`Hasil foto — ${eventName}`}
          className="max-h-[62vh] w-auto max-w-full rounded-lg border shadow-card"
        />
      </div>

      {/* Delivery */}
      <div className="flex flex-col justify-center gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Foto Kamu Siap! ✨</h1>
          <p className="mt-1.5 text-muted-foreground">
            Scan QR code atau kirim ke HP kamu untuk download foto resolusi tinggi.
          </p>
        </div>

        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="flex shrink-0 flex-col items-center gap-2 rounded-xl border p-4">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="QR download foto" className="h-48 w-48" />
            ) : (
              <div className="flex h-48 w-48 items-center justify-center">
                <Spinner className="h-6 w-6" />
              </div>
            )}
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scan via kamera</p>
          </div>

          <div className="min-w-0 flex-1">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Atau kirim digital
            </p>
            <Tabs defaultValue="whatsapp">
              <TabsList className="w-full">
                <TabsTrigger value="whatsapp" className="flex-1">
                  <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                </TabsTrigger>
                <TabsTrigger value="email" className="flex-1">
                  <Mail className="mr-1.5 h-4 w-4" /> Email
                </TabsTrigger>
              </TabsList>
              <TabsContent value="whatsapp" className="space-y-2">
                <Input
                  placeholder="+62 812 3456 7890"
                  inputMode="tel"
                  value={waNumber}
                  onChange={(e) => setWaNumber(e.target.value)}
                  className="h-11"
                />
                <Button
                  className="h-11 w-full"
                  onClick={sendWhatsApp}
                  loading={requestDelivery.isPending}
                  disabled={waNumber.replace(/\D/g, "").length < 8}
                >
                  Kirim Link Foto <Send />
                </Button>
              </TabsContent>
              <TabsContent value="email" className="space-y-2">
                <Input
                  placeholder="kamu@mail.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                />
                <Button
                  className="h-11 w-full"
                  onClick={sendEmail}
                  loading={requestDelivery.isPending}
                  disabled={!email.includes("@")}
                >
                  Kirim Link Foto <Send />
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <Button variant="ghost" onClick={doPrint} loading={print.isPending}>
            <Printer /> Print Fisik
          </Button>
          <span className="text-xs text-muted-foreground">Menunggu operator untuk sesi baru…</span>
        </div>
      </div>

      {/* Hidden print frame */}
      <div className="print-area hidden print:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={printImgRef} alt="Print output" src={session.composedUrl!} />
      </div>
    </motion.div>
  );
}
