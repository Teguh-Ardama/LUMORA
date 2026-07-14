"use client";

import * as React from "react";
import QRCode from "qrcode";
import { ExternalLink, Mail, MessageCircle, Printer, QrCode } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
} from "@lumora/ui";
import { useMintQr, usePrint, useRequestDelivery } from "@/lib/hooks/use-operator";
import { apiClient, ApiClientError } from "@/lib/api";

/**
 * READY-state panel: dynamic QR (FR-06), WA/email delivery, and 4R print.
 * The QR lives only in component state — starting a new session unmounts
 * it and the server revokes the token, so the old code is truly dead.
 */
export function DeliveryPanel({ sessionId, composedUrl }: { sessionId: string; composedUrl: string }) {
  const mintQr = useMintQr();
  const requestDelivery = useRequestDelivery();
  const print = usePrint();

  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const [galleryUrl, setGalleryUrl] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [waNumber, setWaNumber] = React.useState("");
  const printImgRef = React.useRef<HTMLImageElement>(null);

  const showQr = async () => {
    try {
      const { url } = await mintQr.mutateAsync(sessionId);
      setGalleryUrl(url);
      setQrDataUrl(await QRCode.toDataURL(url, { width: 480, margin: 1 }));
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Could not create the QR code");
    }
  };

  const sendEmail = async () => {
    try {
      await requestDelivery.mutateAsync({ sessionId, channel: "EMAIL", email: email.trim() });
      toast.success(`Photos queued for ${email.trim()}`);
      setEmail("");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Email delivery failed");
    }
  };

  const sendWhatsApp = async () => {
    try {
      const result = await requestDelivery.mutateAsync({
        sessionId,
        channel: "WHATSAPP",
        waNumber: waNumber.trim(),
      });
      if (result.waLink) {
        window.open(result.waLink, "_blank", "noopener,noreferrer");
        toast.success("WhatsApp chat opened with the download link");
      } else {
        toast.success("WhatsApp delivery queued");
      }
      setWaNumber("");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "WhatsApp delivery failed");
    }
  };

  const doPrint = async () => {
    try {
      const { job } = await print.mutateAsync({ sessionId, copies: 1 });
      const img = printImgRef.current;
      if (!img || !job.composedUrl) throw new Error("Print asset unavailable");

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Could not load the print image"));
        img.src = job.composedUrl!;
      });
      window.print();
      await apiClient.patch(`/api/print-jobs/${job.id}`, { status: "PRINTED" });
      toast.success("Sent to printer");
    } catch (err) {
      toast.error(err instanceof ApiClientError || err instanceof Error ? err.message : "Print failed");
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="qr">
        <TabsList className="w-full">
          <TabsTrigger value="qr" className="flex-1">
            <QrCode className="mr-1.5 h-4 w-4" /> QR
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex-1">
            <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="email" className="flex-1">
            <Mail className="mr-1.5 h-4 w-4" /> Email
          </TabsTrigger>
        </TabsList>

        <TabsContent value="qr">
          {qrDataUrl ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Guest download QR code" className="h-52 w-52" />
              <p className="text-center text-xs text-muted-foreground">
                Guest scans to download. This code dies when you start a new session.
              </p>
              {galleryUrl ? (
                <Button variant="link" size="sm" asChild>
                  <a href={galleryUrl} target="_blank" rel="noopener noreferrer">
                    Open gallery page <ExternalLink />
                  </a>
                </Button>
              ) : null}
            </div>
          ) : (
            <Button className="w-full" onClick={showQr} loading={mintQr.isPending}>
              <QrCode /> Show QR for guest
            </Button>
          )}
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-2">
          <Label htmlFor="wa-number">WhatsApp number</Label>
          <div className="flex gap-2">
            <Input
              id="wa-number"
              placeholder="+62812345678"
              value={waNumber}
              onChange={(e) => setWaNumber(e.target.value)}
              inputMode="tel"
            />
            <Button onClick={sendWhatsApp} loading={requestDelivery.isPending} disabled={waNumber.trim().length < 8}>
              Send
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="email" className="space-y-2">
          <Label htmlFor="guest-email">Guest email</Label>
          <div className="flex gap-2">
            <Input
              id="guest-email"
              type="email"
              placeholder="guest@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button onClick={sendEmail} loading={requestDelivery.isPending} disabled={!email.includes("@")}>
              Send
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <Separator />

      <Button variant="outline" className="w-full" onClick={doPrint} loading={print.isPending}>
        <Printer /> Print 4R
      </Button>

      {/* Hidden print frame — the only visible element during window.print(). */}
      <div className="print-area hidden print:block">
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img ref={printImgRef} alt="Print output" src={composedUrl} />
      </div>
    </div>
  );
}
