import nodemailer, { type Transporter } from "nodemailer";
import { createLogger, getEnv } from "@lumora/core";

const log = createLogger("email");

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  send(input: SendEmailInput): Promise<void>;
}

/** Dev driver: logs instead of sending, so the flow works with zero config. */
class ConsoleEmailProvider implements EmailProvider {
  async send(input: SendEmailInput): Promise<void> {
    log.info("EMAIL (console driver)", { to: input.to, subject: input.subject, text: input.text });
  }
}

class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter;

  constructor() {
    const env = getEnv();
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }

  async send(input: SendEmailInput): Promise<void> {
    await this.transporter.sendMail({
      from: getEnv().SMTP_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
  }
}

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  provider ??= getEnv().EMAIL_DRIVER === "smtp" ? new SmtpEmailProvider() : new ConsoleEmailProvider();
  return provider;
}
