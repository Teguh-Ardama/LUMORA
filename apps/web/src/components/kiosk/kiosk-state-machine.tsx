"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@lumora/ui";
import { useKioskTimer } from "./use-kiosk-timer";
import { useOperatorContext, useStartSession, useCompose } from "@/lib/hooks/use-operator";
import { Loader2 } from "lucide-react";

export type KioskState = "PAYMENT" | "FRAME_SELECT" | "CAPTURE" | "FILTER" | "SHARE";

export function KioskStateMachine({ eventId }: { eventId: string }) {
  const { data: ctx, isLoading, isError, refetch } = useOperatorContext(eventId);
  const startSession = useStartSession(eventId);
  const compose = useCompose(eventId);

  const [state, setState] = useState<KioskState>("PAYMENT");
  const [layoutId, setLayoutId] = useState<string>("");
  const [borderId, setBorderId] = useState<string>("");

  // Seed defaults once ctx is ready
  useEffect(() => {
    if (!ctx) return;
    setLayoutId(prev => prev || ctx.event.defaultLayoutId || ctx.layouts[0]?.id || "");
    setBorderId(prev => prev || ctx.event.defaultBorderId || "");
  }, [ctx]);

  const advance = (next: KioskState) => {
    setState(next);
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-black text-white"><Loader2 className="animate-spin w-8 h-8" /></div>;
  if (isError || !ctx) return <div className="flex h-screen items-center justify-center bg-black text-white">Error loading event. <Button onClick={() => refetch()}>Retry</Button></div>;

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-white overflow-hidden select-none relative">
      <div className="absolute top-4 left-4 z-50">
        <h1 className="text-xl font-bold tracking-wider text-pink-500">LUMORA<span className="text-white">KIOSK</span></h1>
      </div>
      {state === "PAYMENT" && (
        <PaymentScreen onNext={() => advance("FRAME_SELECT")} />
      )}
      {state === "FRAME_SELECT" && (
        <FrameSelectScreen 
          ctx={ctx} 
          layoutId={layoutId} 
          setLayoutId={setLayoutId} 
          borderId={borderId} 
          setBorderId={setBorderId}
          onNext={() => {
            startSession.mutate(
              { layoutId, borderId: borderId || null, captureSource: "WEBCAM", filterId: ctx?.filters?.[0]?.id ?? "" },
              { onSuccess: () => advance("CAPTURE") }
            );
          }} 
        />
      )}
      {state === "CAPTURE" && ctx.activeSession && (
        <CaptureScreen 
          ctx={ctx} 
          session={ctx.activeSession}
          onComplete={() => advance("FILTER")} 
        />
      )}
      {state === "FILTER" && ctx.activeSession && (
        <FilterScreen 
          ctx={ctx} 
          session={ctx.activeSession}
          onComplete={() => advance("SHARE")} 
        />
      )}
      {state === "SHARE" && ctx.activeSession && (
        <ShareScreen 
          ctx={ctx} 
          session={ctx.activeSession}
          onComplete={() => advance("PAYMENT")} 
        />
      )}
    </div>
  );
}

function PaymentScreen({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center p-8 space-y-8" onClick={onNext}>
      <h1 className="text-4xl font-bold tracking-tight text-white">Welcome to the Photobooth</h1>
      <div className="w-64 h-64 bg-white rounded-lg flex items-center justify-center border-4 border-primary">
        <span className="text-black font-semibold text-lg">QRIS Placeholder</span>
      </div>
      <p className="text-xl text-gray-300">Tap anywhere to start</p>
    </div>
  );
}

function FrameSelectScreen({ ctx, layoutId, setLayoutId, borderId, setBorderId, onNext }: { ctx: any, layoutId: string, setLayoutId: (id: string) => void, borderId: string, setBorderId: (id: string) => void, onNext: () => void }) {
  const { timeLeft } = useKioskTimer(15, onNext);

  return (
    <div className="flex flex-1 flex-col p-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">Choose your Frame</h2>
        <div className="text-4xl font-mono text-primary animate-pulse">{timeLeft}s</div>
      </div>
      <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 overflow-y-auto">
        {ctx.layouts.map((l: any) => (
          <div 
            key={l.id} 
            onClick={() => { setLayoutId(l.id); onNext(); }}
            className={`border-4 rounded-xl cursor-pointer overflow-hidden transition-transform active:scale-95 ${l.id === layoutId ? 'border-primary' : 'border-transparent'}`}
          >
            {/* Minimal mockup for layout */}
            <div className="bg-zinc-800 aspect-[3/4] flex items-center justify-center text-center p-4">
              <span className="text-sm font-medium">{l.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { WebcamPanel } from "@/components/operator/webcam-panel";
import { useStickers } from "@/lib/hooks/use-operator";
import { useOfflineUploads } from "@/lib/hooks/use-offline-uploads";
import { StickerPad, type StickerPadRef } from "@/components/operator/sticker-pad";
import QRCode from "qrcode";

function CaptureScreen({ ctx, session, onComplete }: { ctx: any, session: any, onComplete: () => void }) {
  const offline = useOfflineUploads(ctx.event.id);
  const framesTotal = Math.max(...session.layout.config.slots.map((s: any) => s.photoIndex)) + 1;
  const framesCaptured = session.photos.length;

  useEffect(() => {
    if (framesCaptured >= framesTotal) {
      onComplete();
    }
  }, [framesCaptured, framesTotal, onComplete]);

  const { timeLeft } = useKioskTimer(120, onComplete, framesCaptured >= framesTotal);

  const handleFrame = async (blob: Blob) => {
    await offline.uploadOrQueue({ sessionId: session.id, blob, sequence: session.photos.length });
  };
  
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 bg-zinc-950">
      <div className="w-full max-w-4xl bg-zinc-900 rounded-2xl aspect-[4/3] flex items-center justify-center border border-zinc-800 overflow-hidden relative shadow-2xl">
        <WebcamPanel
          countdownSeconds={ctx.event.countdownSeconds}
          framesCaptured={framesCaptured}
          framesTotal={framesTotal}
          disabled={false}
          autoCapture={true}
          onFrame={handleFrame}
        />
      </div>
      <p className="text-zinc-500 mt-6 font-mono text-sm">Session terminates in {timeLeft}s</p>
    </div>
  );
}

function FilterScreen({ ctx, session, onComplete }: { ctx: any, session: any, onComplete: () => void }) {
  const compose = useCompose(ctx.event.id);
  const { data: stickersData } = useStickers();
  const padRef = useRef<StickerPadRef>(null);

  const handleFinish = () => {
    if (padRef.current) padRef.current.submit();
  };

  const { timeLeft } = useKioskTimer(20, handleFinish, compose.isPending || session.status !== "CAPTURING");

  useEffect(() => {
    if (session.status === "COMPOSING" || session.status === "READY") {
      onComplete();
    }
  }, [session.status, onComplete]);

  return (
    <div className="flex flex-1 flex-col p-8 bg-zinc-950">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-4xl font-bold text-white">Decorate</h2>
        <div className="text-5xl font-mono font-bold text-primary animate-pulse">{timeLeft}s</div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center relative min-h-0">
         <div className="w-full h-full max-w-4xl bg-card rounded-2xl overflow-hidden shadow-2xl border border-white/10 p-4">
            <StickerPad
              ref={padRef}
              session={session}
              stickers={stickersData?.stickers ?? []}
              filters={ctx.filters ?? []}
              isComposing={compose.isPending}
              onCompose={(appliedStickers, photoFilters) =>
                compose.mutate(
                  { sessionId: session.id, appliedStickers, photoFilters },
                  { onSuccess: onComplete }
                )
              }
            />
         </div>
      </div>
      <div className="mt-8 flex justify-center">
        <Button size="lg" className="px-16 text-xl h-16 rounded-full" onClick={handleFinish} loading={compose.isPending}>Finish Decoration</Button>
      </div>
    </div>
  );
}

function ShareScreen({ ctx, session, onComplete }: { ctx: any, session: any, onComplete: () => void }) {
  const { timeLeft } = useKioskTimer(45, onComplete);
  const [qrUrl, setQrUrl] = useState<string>("");

  useEffect(() => {
    const guestUrl = typeof window !== "undefined" ? `${window.location.origin}/g/${session.token}` : "";
    if (guestUrl) {
      QRCode.toDataURL(guestUrl, { width: 224, margin: 1 }).then(setQrUrl).catch(() => {});
    }
  }, [session.token]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 bg-zinc-950">
      {session.status === "COMPOSING" ? (
        <div className="flex flex-col items-center gap-6">
          <Loader2 className="w-16 h-16 text-primary animate-spin" />
          <h2 className="text-3xl font-bold text-white tracking-widest uppercase">Processing...</h2>
        </div>
      ) : (
        <>
          <h2 className="text-5xl font-bold mb-4 text-primary uppercase tracking-wider">All Done!</h2>
          <p className="text-xl text-zinc-400 mb-10">Scan the QR code to download your photos</p>
          <div className="flex gap-12 items-center">
            {session.composedUrl && (
               <img src={session.composedUrl} alt="Result" className="h-96 rounded-lg shadow-2xl border-4 border-white/10" />
            )}
            <div className="w-64 h-64 bg-white p-4 rounded-2xl shadow-xl flex items-center justify-center shrink-0">
              {qrUrl ? <img src={qrUrl} alt="QR Code" className="w-full h-full" /> : <div className="text-black">Loading...</div>}
            </div>
          </div>
          <div className="text-xl font-mono text-zinc-600 mt-12">Resetting in {timeLeft}s...</div>
          <Button variant="ghost" className="mt-4 text-zinc-400 hover:text-white" onClick={onComplete}>Tap to finish now</Button>
        </>
      )}
    </div>
  );
}
