import { describe, expect, it, vi } from 'vitest';
import { isEmailConfigured, parseSender, sendMail, type MailMessage } from './mailer';

const message: MailMessage = {
  to: 'pemilik@example.com',
  subject: 'Tenggat: 1 jadwal perlu dicek',
  text: 'Halo',
  html: '<p>Halo</p>',
};

function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

describe('isEmailConfigured', () => {
  it('butuh provider dan alamat pengirim', () => {
    expect(isEmailConfigured(env({ RESEND_API_KEY: 're_x' }))).toBe(false);
    expect(isEmailConfigured(env({ REMINDER_EMAIL_FROM: 'Tenggat <a@b.c>' }))).toBe(false);
    expect(
      isEmailConfigured(env({ RESEND_API_KEY: 're_x', REMINDER_EMAIL_FROM: 'Tenggat <a@b.c>' })),
    ).toBe(true);
    expect(
      isEmailConfigured(env({ BREVO_API_KEY: 'xkeysib-x', REMINDER_EMAIL_FROM: 'Tenggat <a@b.c>' })),
    ).toBe(true);
    expect(
      isEmailConfigured(env({ SMTP_URL: 'smtps://u:p@smtp.example.com:465', REMINDER_EMAIL_FROM: 'a@b.c' })),
    ).toBe(true);
  });
});

describe('parseSender', () => {
  it('memisahkan nama dan email', () => {
    expect(parseSender('Tenggat <appgurumam1@gmail.com>')).toEqual({
      name: 'Tenggat',
      email: 'appgurumam1@gmail.com',
    });
    expect(parseSender('appgurumam1@gmail.com')).toEqual({ email: 'appgurumam1@gmail.com' });
  });
});

describe('sendMail', () => {
  it('melewati pengiriman bila belum dikonfigurasi', async () => {
    const result = await sendMail(message, env({}));
    expect(result.sent).toBe(false);
    expect(result.skipped).toBe(true);
  });

  it('mengirim lewat Resend dan mengembalikan id', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'email_123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await sendMail(
      message,
      env({ RESEND_API_KEY: 're_test', REMINDER_EMAIL_FROM: 'Tenggat <a@b.c>' }),
      fetchImpl as unknown as typeof fetch,
    );

    expect(result).toEqual({ sent: true, id: 'email_123' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer re_test');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      from: 'Tenggat <a@b.c>',
      to: ['pemilik@example.com'],
      subject: message.subject,
    });
  });

  it('melaporkan error HTTP dari Resend', async () => {
    const fetchImpl = vi.fn(async () => new Response('domain belum diverifikasi', { status: 403 }));

    const result = await sendMail(
      message,
      env({ RESEND_API_KEY: 're_test', REMINDER_EMAIL_FROM: 'a@b.c' }),
      fetchImpl as unknown as typeof fetch,
    );

    expect(result.sent).toBe(false);
    expect(result.error).toContain('403');
    expect(result.error).toContain('domain belum diverifikasi');
  });

  it('melaporkan kegagalan jaringan', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('offline');
    });

    const result = await sendMail(
      message,
      env({ RESEND_API_KEY: 're_test', REMINDER_EMAIL_FROM: 'a@b.c' }),
      fetchImpl as unknown as typeof fetch,
    );

    expect(result.sent).toBe(false);
    expect(result.error).toContain('offline');
  });

  it('mengirim lewat API Brevo dan mengembalikan messageId', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ messageId: '<brevo-123@example.com>' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const result = await sendMail(
      message,
      env({ BREVO_API_KEY: 'xkeysib-test', REMINDER_EMAIL_FROM: 'Tenggat <a@b.c>' }),
      fetchImpl as unknown as typeof fetch,
    );

    expect(result).toEqual({ sent: true, id: '<brevo-123@example.com>' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init.headers as Record<string, string>)['api-key']).toBe('xkeysib-test');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      sender: { name: 'Tenggat', email: 'a@b.c' },
      to: [{ email: 'pemilik@example.com' }],
      subject: message.subject,
      textContent: message.text,
      htmlContent: message.html,
    });
  });

  it('memprioritaskan Brevo bila beberapa provider diset', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{}', { status: 201 }));
    await sendMail(
      message,
      env({
        BREVO_API_KEY: 'xkeysib-test',
        RESEND_API_KEY: 're_test',
        REMINDER_EMAIL_FROM: 'a@b.c',
      }),
      fetchImpl as unknown as typeof fetch,
    );
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.brevo.com/v3/smtp/email');
  });

  it('melaporkan error HTTP dari Brevo', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response('{"message":"Sender not verified"}', { status: 400 }),
    );

    const result = await sendMail(
      message,
      env({ BREVO_API_KEY: 'xkeysib-test', REMINDER_EMAIL_FROM: 'a@b.c' }),
      fetchImpl as unknown as typeof fetch,
    );

    expect(result.sent).toBe(false);
    expect(result.error).toContain('400');
    expect(result.error).toContain('Sender not verified');
  });

  it('melaporkan kegagalan SMTP tanpa melempar error', async () => {
    const result = await sendMail(
      message,
      env({ SMTP_URL: 'smtp://127.0.0.1:1', REMINDER_EMAIL_FROM: 'a@b.c' }),
    );

    expect(result.sent).toBe(false);
    expect(result.skipped).toBeUndefined();
    expect(result.error).toContain('SMTP gagal');
  });
});
