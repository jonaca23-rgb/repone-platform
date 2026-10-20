import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outgoing email, over plain SMTP.
 *
 * SMTP keeps the app free of any provider's SDK: locally SMTP_URL points at the
 * Mailpit that `supabase start` already runs (inbox at http://127.0.0.1:54524),
 * and in production at the provider's SMTP relay. Only the environment changes.
 *
 * No server-only guard of its own: it is reached through lib/auth/auth.ts, whose
 * app entry is guarded, and nodemailer cannot run in a browser regardless.
 */
let transport: Transporter | undefined;
/** The SMTP_URL `transport` was built from; a change rebuilds it (db:invite-check points it at a closed port). */
let cachedUrl: string | undefined;

function getTransport(): Transporter {
  const url = process.env.SMTP_URL;
  if (!url) throw new Error("SMTP_URL is not set.");
  if (!transport || url !== cachedUrl) {
    transport = nodemailer.createTransport(url);
    cachedUrl = url;
  }
  return transport;
}

export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendEmail(email: Email): Promise<void> {
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is not set.");
  await getTransport().sendMail({ from, ...email });
}
