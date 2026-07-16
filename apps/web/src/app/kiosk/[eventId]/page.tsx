import { Metadata } from "next";
import { KioskStateMachine } from "@/components/kiosk/kiosk-state-machine";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "LUMORA Photobooth",
  description: "Automated Kiosk Mode",
};

export default async function KioskPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  if (!eventId) notFound();

  return <KioskStateMachine eventId={eventId} />;
}
