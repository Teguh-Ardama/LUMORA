import { createLogger, getEnv } from "@lumora/core";

const log = createLogger("whatsapp");

export interface WhatsAppProvider {
  /** Returns true when the provider actually pushed the message. */
  send(toNumber: string, message: string): Promise<boolean>;
}

/**
 * Zero-config driver: no API push — the operator screen opens a wa.me
 * click-to-chat link instead. The worker just records the delivery.
 */
class LinkWhatsAppProvider implements WhatsAppProvider {
  async send(toNumber: string, message: string): Promise<boolean> {
    log.info("WHATSAPP (link driver) — operator-assisted send", { to: toNumber, message });
    return true;
  }
}

/** Twilio WhatsApp Business API driver. */
class TwilioWhatsAppProvider implements WhatsAppProvider {
  async send(toNumber: string, message: string): Promise<boolean> {
    const env = getEnv();
    const sid = env.TWILIO_ACCOUNT_SID!;
    const auth = Buffer.from(`${sid}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
    const normalized = toNumber.startsWith("+") ? toNumber : `+${toNumber}`;

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
        To: `whatsapp:${normalized}`,
        Body: message,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Twilio ${res.status}: ${body.slice(0, 300)}`);
    }
    return true;
  }
}

let provider: WhatsAppProvider | null = null;

export function getWhatsAppProvider(): WhatsAppProvider {
  provider ??= getEnv().WHATSAPP_DRIVER === "twilio" ? new TwilioWhatsAppProvider() : new LinkWhatsAppProvider();
  return provider;
}
