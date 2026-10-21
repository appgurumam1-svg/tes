import { attachDatabasePool } from '@neon/functions';
import { parseTriggerDelivery } from '@neon/functions/triggers';
import { Pool } from 'pg';
import webpush from 'web-push';

/**
 * Function terjadwal: setiap pagi memeriksa jadwal yang mendekati/melewati tenggat
 * lalu mengirim Web Push ke subscription milik user.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL tidak tersedia.');
}

const pool = new Pool({ connectionString, max: 3, ssl: { rejectUnauthorized: false } });
attachDatabasePool(pool);

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com';

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

interface Row {
  user_id: string;
  title: string;
  kind: string;
  last_done_date: string | null;
  interval_value: number | null;
  interval_unit: string | null;
  due_date: string | null;
  remind_before_days: number;
}

function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

function toISO(date: { y: number; m: number; d: number }): string {
  return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonthsISO(iso: string, amount: number): string {
  const src = parseISO(iso);
  const index = src.y * 12 + (src.m - 1) + amount;
  const year = Math.floor(index / 12);
  const month = (((index % 12) + 12) % 12) + 1;
  return toISO({ y: year, m: month, d: Math.min(src.d, daysInMonth(year, month)) });
}

function addDaysISO(iso: string, amount: number): string {
  const src = parseISO(iso);
  const result = new Date(Date.UTC(src.y, src.m - 1, src.d) + amount * 86_400_000);
  return toISO({
    y: result.getUTCFullYear(),
    m: result.getUTCMonth() + 1,
    d: result.getUTCDate(),
  });
}

function daysBetweenISO(fromISO: string, toISO_: string): number {
  const a = parseISO(fromISO);
  const b = parseISO(toISO_);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

function todayISO(): string {
  const now = new Date();
  return toISO({ y: now.getUTCFullYear(), m: now.getUTCMonth() + 1, d: now.getUTCDate() });
}

function dueDateOf(row: Row): string | null {
  if (row.kind === 'fixed') return row.due_date;
  if (!row.last_done_date || !row.interval_value || row.interval_value <= 0) return null;
  switch (row.interval_unit ?? 'month') {
    case 'day':
      return addDaysISO(row.last_done_date, row.interval_value);
    case 'week':
      return addDaysISO(row.last_done_date, row.interval_value * 7);
    case 'year':
      return addMonthsISO(row.last_done_date, row.interval_value * 12);
    default:
      return addMonthsISO(row.last_done_date, row.interval_value);
  }
}

function describe(title: string, daysLeft: number): string {
  if (daysLeft < 0) return `${title} telat ${Math.abs(daysLeft)} hari`;
  if (daysLeft === 0) return `${title} jatuh tempo hari ini`;
  return `${title} ${daysLeft} hari lagi`;
}

interface SubscriptionRow {
  endpoint: string;
  user_id: string;
  subscription: webpush.PushSubscription;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const parsed = await parseTriggerDelivery(request);
    if (!parsed.ok) {
      return Response.json(
        { error: parsed.error },
        { status: parsed.error === 'invalid_body' ? 400 : 401 },
      );
    }

    if (!publicKey || !privateKey) {
      return Response.json({ error: 'VAPID belum diset pada function.' }, { status: 500 });
    }

    const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';
    const today = todayISO();

    try {
      const schedules = await pool.query<Row>(
        `select user_id, title, kind,
                to_char(last_done_date, 'YYYY-MM-DD') as last_done_date,
                interval_value, interval_unit,
                to_char(due_date, 'YYYY-MM-DD') as due_date,
                remind_before_days
         from schedules`,
      );

      const byUser = new Map<string, { daysLeft: number; text: string }[]>();
      for (const row of schedules.rows) {
        const due = dueDateOf(row);
        if (!due) continue;
        const daysLeft = daysBetweenISO(today, due);
        if (daysLeft > row.remind_before_days) continue;
        const list = byUser.get(row.user_id) ?? [];
        list.push({ daysLeft, text: describe(row.title, daysLeft) });
        byUser.set(row.user_id, list);
      }

      const subscriptions = await pool.query<SubscriptionRow>(
        'select endpoint, user_id, subscription from push_subscriptions',
      );

      let sent = 0;
      let failed = 0;
      let removed = 0;
      const details: { userId: string; title: string; body: string }[] = [];

      for (const row of subscriptions.rows) {
        const items = byUser.get(row.user_id);
        if (!items || items.length === 0) continue;

        items.sort((a, b) => a.daysLeft - b.daysLeft);
        const title =
          items.length === 1
            ? 'Tenggat: 1 jadwal perlu dicek'
            : `Tenggat: ${items.length} jadwal perlu dicek`;
        const body = items
          .slice(0, 3)
          .map((item) => item.text)
          .join(' • ');

        if (dryRun) {
          details.push({ userId: row.user_id, title, body });
          continue;
        }

        try {
          await webpush.sendNotification(
            row.subscription,
            JSON.stringify({ title, body, url: '/', tag: `tenggat-${today}` }),
          );
          sent += 1;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await pool.query('delete from push_subscriptions where endpoint = $1', [row.endpoint]);
            removed += 1;
          } else {
            failed += 1;
          }
        }
      }

      return Response.json({
        ok: true,
        dryRun,
        today,
        usersWithDueItems: byUser.size,
        subscriptions: subscriptions.rowCount ?? 0,
        sent,
        failed,
        removed,
        details,
      });
    } catch (error) {
      return Response.json({ error: (error as Error).message }, { status: 500 });
    }
  },
};
