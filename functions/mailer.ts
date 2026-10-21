import { createTransport } from 'nodemailer';

/**
 * Pengirim email untuk Function `remind`.
 *
 * Provider dipilih dari env (prioritas):
 *   1. `RESEND_API_KEY` — kirim lewat API Resend (tanpa dependency tambahan).
 *   2. `SMTP_URL`       — kirim lewat SMTP apa pun (mis. Gmail app password).
 *
 * `REMINDER_EMAIL_FROM` wajib diisi, contoh:
 *   `Tenggat <appgurumam1@gmail.com>`
 *
 * Tanpa konfigurasi di atas, pengiriman email dilewati dan pengingat push
 * tetap berjalan seperti biasa.
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailResult {
  sent: boolean;
  skipped?: boolean;
  error?: string;
  id?: string;
}

type FetchLike = typeof fetch;

export function isEmailConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const hasProvider = Boolean(env.RESEND_API_KEY?.trim() || env.SMTP_URL?.trim());
  return hasProvider && Boolean(env.REMINDER_EMAIL_FROM?.trim());
}

export async function sendMail(
  message: MailMessage,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: FetchLike = fetch,
): Promise<MailResult> {
  const from = env.REMINDER_EMAIL_FROM?.trim();
  if (!from) {
    return { sent: false, skipped: true, error: 'REMINDER_EMAIL_FROM belum diset.' };
  }

  const resendKey = env.RESEND_API_KEY?.trim();
  if (resendKey) {
    return sendWithResend(message, from, resendKey, fetchImpl);
  }

  const smtpUrl = env.SMTP_URL?.trim();
  if (smtpUrl) {
    return sendWithSmtp(message, from, smtpUrl);
  }

  return { sent: false, skipped: true, error: 'RESEND_API_KEY atau SMTP_URL belum diset.' };
}

export async function sendWithResend(
  message: MailMessage,
  from: string,
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<MailResult> {
  let response: Response;
  try {
    response = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
  } catch (error) {
    return { sent: false, error: `Resend tidak bisa dihubungi: ${(error as Error).message}` };
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    return { sent: false, error: `Resend HTTP ${response.status}${detail ? `: ${detail}` : ''}` };
  }

  const payload = (await response.json().catch(() => null)) as { id?: string } | null;
  return { sent: true, id: payload?.id };
}

export async function sendWithSmtp(
  message: MailMessage,
  from: string,
  smtpUrl: string,
): Promise<MailResult> {
  try {
    const transport = createTransport(smtpUrl);
    const info = await transport.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { sent: true, id: info.messageId };
  } catch (error) {
    return { sent: false, error: `SMTP gagal: ${(error as Error).message}` };
  }
}
