import { createTransport } from 'nodemailer';

/**
 * Pengirim email untuk Function `remind`.
 *
 * Provider dipilih dari env (prioritas):
 *   1. `BREVO_API_KEY`  — API Brevo (tidak terkena blokir IP SMTP).
 *   2. `RESEND_API_KEY` — kirim lewat API Resend.
 *   3. `SMTP_URL`       — kirim lewat SMTP apa pun (mis. Gmail app password).
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
  const hasProvider = Boolean(
    env.BREVO_API_KEY?.trim() || env.RESEND_API_KEY?.trim() || env.SMTP_URL?.trim(),
  );
  return hasProvider && Boolean(env.REMINDER_EMAIL_FROM?.trim());
}

/** `Tenggat <a@b.c>` → `{ name: 'Tenggat', email: 'a@b.c' }` */
export function parseSender(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  if (match) {
    return { name: match[1] || undefined, email: match[2].trim() };
  }
  return { email: from.trim() };
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

  const brevoKey = env.BREVO_API_KEY?.trim();
  if (brevoKey) {
    return sendWithBrevo(message, from, brevoKey, fetchImpl);
  }

  const resendKey = env.RESEND_API_KEY?.trim();
  if (resendKey) {
    return sendWithResend(message, from, resendKey, fetchImpl);
  }

  const smtpUrl = env.SMTP_URL?.trim();
  if (smtpUrl) {
    return sendWithSmtp(message, from, smtpUrl);
  }

  return { sent: false, skipped: true, error: 'BREVO_API_KEY, RESEND_API_KEY, atau SMTP_URL belum diset.' };
}

export async function sendWithBrevo(
  message: MailMessage,
  from: string,
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<MailResult> {
  const sender = parseSender(from);
  let response: Response;
  try {
    response = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: sender.name ? { name: sender.name, email: sender.email } : { email: sender.email },
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
        htmlContent: message.html,
      }),
    });
  } catch (error) {
    return { sent: false, error: `Brevo tidak bisa dihubungi: ${(error as Error).message}` };
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    return { sent: false, error: `Brevo HTTP ${response.status}${detail ? `: ${detail}` : ''}` };
  }

  const payload = (await response.json().catch(() => null)) as { messageId?: string } | null;
  return { sent: true, id: payload?.messageId };
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
