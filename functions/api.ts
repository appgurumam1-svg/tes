import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Pool } from 'pg';
import { attachDatabasePool } from '@neon/functions';

/**
 * Neon Function: REST API untuk jadwal Tenggat.
 * DATABASE_URL di-inject otomatis oleh Neon (pooled connection).
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL tidak tersedia. Deploy lewat `neon deploy`.');
}

const pool = new Pool({
  connectionString,
  max: 5,
  ssl: { rejectUnauthorized: false },
});
attachDatabasePool(pool);

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool
      .query(
        `
        create table if not exists schedules (
          id text primary key default gen_random_uuid()::text,
          title text not null,
          category text not null default 'lainnya',
          kind text not null check (kind in ('interval', 'fixed')),
          note text,
          last_done_date date,
          interval_value integer,
          interval_unit text,
          due_date date,
          remind_before_days integer not null default 30,
          cost numeric(12, 2),
          history jsonb not null default '[]'::jsonb,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
        create index if not exists schedules_due_date_idx on schedules (due_date);
        create index if not exists schedules_updated_at_idx on schedules (updated_at desc);
        `,
      )
      .then(() => undefined)
      .catch((error: unknown) => {
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

const SCHEDULE_COLUMNS = `
  id, title, category, kind, note,
  to_char(last_done_date, 'YYYY-MM-DD') as last_done_date,
  interval_value, interval_unit,
  to_char(due_date, 'YYYY-MM-DD') as due_date,
  remind_before_days, cost, history, created_at, updated_at
`;

interface ScheduleRow {
  id: string;
  title: string;
  category: string;
  kind: string;
  note: string | null;
  last_done_date: string | null;
  interval_value: number | null;
  interval_unit: string | null;
  due_date: string | null;
  remind_before_days: number;
  cost: string | number | null;
  history: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}

const CATEGORIES = new Set(['kendaraan', 'dokumen', 'kesehatan', 'langganan', 'rumah', 'lainnya']);
const UNITS = new Set(['day', 'week', 'month', 'year']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(value: unknown): string | null {
  return typeof value === 'string' && ISO_DATE.test(value) ? value : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRow(row: ScheduleRow) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    kind: row.kind,
    note: row.note ?? undefined,
    lastDoneDate: row.last_done_date ?? undefined,
    intervalValue: row.interval_value ?? undefined,
    intervalUnit: row.interval_unit ?? undefined,
    dueDate: row.due_date ?? undefined,
    remindBeforeDays: row.remind_before_days,
    cost: row.cost === null ? undefined : Number(row.cost),
    history: Array.isArray(row.history) ? row.history : [],
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

interface SchedulePayload {
  id?: string;
  title?: unknown;
  category?: unknown;
  kind?: unknown;
  note?: unknown;
  lastDoneDate?: unknown;
  intervalValue?: unknown;
  intervalUnit?: unknown;
  dueDate?: unknown;
  remindBeforeDays?: unknown;
  cost?: unknown;
  history?: unknown;
  createdAt?: unknown;
}

interface NormalizedSchedule {
  id: string | null;
  title: string;
  category: string;
  kind: 'interval' | 'fixed';
  note: string | null;
  lastDoneDate: string | null;
  intervalValue: number | null;
  intervalUnit: string | null;
  dueDate: string | null;
  remindBeforeDays: number;
  cost: number | null;
  history: unknown[];
  createdAt: string | null;
}

function normalize(input: SchedulePayload): { data: NormalizedSchedule } | { error: string } {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) return { error: 'Judul wajib diisi.' };
  if (title.length > 120) return { error: 'Judul maksimal 120 karakter.' };

  const kind = input.kind === 'fixed' ? 'fixed' : input.kind === 'interval' ? 'interval' : null;
  if (!kind) return { error: 'Jenis jadwal tidak valid.' };

  const category =
    typeof input.category === 'string' && CATEGORIES.has(input.category)
      ? input.category
      : 'lainnya';
  const intervalUnit =
    typeof input.intervalUnit === 'string' && UNITS.has(input.intervalUnit)
      ? input.intervalUnit
      : null;
  const intervalValue = toNumber(input.intervalValue);
  const dueDate = isoDate(input.dueDate);
  const lastDoneDate = isoDate(input.lastDoneDate);

  if (kind === 'interval' && (!lastDoneDate || !intervalValue || intervalValue <= 0)) {
    return { error: 'Jadwal berkala butuh tanggal terakhir dan interval > 0.' };
  }
  if (kind === 'fixed' && !dueDate) {
    return { error: 'Jadwal tanggal tetap butuh tanggal kedaluwarsa.' };
  }

  const remind = toNumber(input.remindBeforeDays);
  const createdAt =
    typeof input.createdAt === 'string' && !Number.isNaN(Date.parse(input.createdAt))
      ? new Date(input.createdAt).toISOString()
      : null;

  return {
    data: {
      id: typeof input.id === 'string' && input.id.length > 0 ? input.id.slice(0, 64) : null,
      title,
      category,
      kind,
      note:
        typeof input.note === 'string' && input.note.trim()
          ? input.note.trim().slice(0, 500)
          : null,
      lastDoneDate: kind === 'interval' ? lastDoneDate : null,
      intervalValue: kind === 'interval' ? Math.round(intervalValue as number) : null,
      intervalUnit: kind === 'interval' ? intervalUnit ?? 'month' : null,
      dueDate: kind === 'fixed' ? dueDate : null,
      remindBeforeDays: remind === null ? 30 : Math.min(Math.max(Math.round(remind), 0), 365),
      cost: toNumber(input.cost),
      history: Array.isArray(input.history) ? (input.history as unknown[]).slice(0, 200) : [],
      createdAt,
    },
  };
}

const app = new Hono();

const allowedOrigin = process.env.APP_ORIGIN?.trim();
app.use(
  '*',
  cors({
    origin: allowedOrigin && allowedOrigin.length > 0 ? allowedOrigin.split(',') : '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    maxAge: 86400,
  }),
);

app.get('/health', async (c) => {
  try {
    await ensureSchema();
    const result = await pool.query<{ now: Date }>('select now() as now');
    return c.json({ ok: true, database: 'up', time: result.rows[0]?.now ?? null });
  } catch (error) {
    return c.json({ ok: false, database: 'down', error: (error as Error).message }, 503);
  }
});

app.get('/schedules', async (c) => {
  try {
    await ensureSchema();
    const result = await pool.query<ScheduleRow>(
      `select ${SCHEDULE_COLUMNS} from schedules order by created_at desc`,
    );
    return c.json({ schedules: result.rows.map(mapRow) });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

app.post('/schedules', async (c) => {
  const body = await c.req.json<SchedulePayload>().catch(() => null);
  if (!body) return c.json({ error: 'Body JSON tidak valid.' }, 400);

  const parsed = normalize(body);
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);
  const data = parsed.data;

  try {
    await ensureSchema();
    const result = await pool.query<ScheduleRow>(
      `insert into schedules
         (id, title, category, kind, note, last_done_date, interval_value, interval_unit,
          due_date, remind_before_days, cost, history, created_at, updated_at)
       values
         (coalesce($1, gen_random_uuid()::text), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          $12::jsonb, coalesce($13::timestamptz, now()), now())
       returning ${SCHEDULE_COLUMNS}`,
      [
        data.id,
        data.title,
        data.category,
        data.kind,
        data.note,
        data.lastDoneDate,
        data.intervalValue,
        data.intervalUnit,
        data.dueDate,
        data.remindBeforeDays,
        data.cost,
        JSON.stringify(data.history),
        data.createdAt,
      ],
    );
    return c.json({ schedule: mapRow(result.rows[0]) }, 201);
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

app.put('/schedules/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<SchedulePayload>().catch(() => null);
  if (!body) return c.json({ error: 'Body JSON tidak valid.' }, 400);

  const parsed = normalize({ ...body, id });
  if ('error' in parsed) return c.json({ error: parsed.error }, 400);
  const data = parsed.data;

  try {
    await ensureSchema();
    const result = await pool.query<ScheduleRow>(
      `update schedules set
         title = $2, category = $3, kind = $4, note = $5,
         last_done_date = $6, interval_value = $7, interval_unit = $8,
         due_date = $9, remind_before_days = $10, cost = $11,
         history = $12::jsonb, updated_at = now()
       where id = $1
       returning ${SCHEDULE_COLUMNS}`,
      [
        id,
        data.title,
        data.category,
        data.kind,
        data.note,
        data.lastDoneDate,
        data.intervalValue,
        data.intervalUnit,
        data.dueDate,
        data.remindBeforeDays,
        data.cost,
        JSON.stringify(data.history),
      ],
    );
    if (result.rowCount === 0) return c.json({ error: 'Jadwal tidak ditemukan.' }, 404);
    return c.json({ schedule: mapRow(result.rows[0]) });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

app.delete('/schedules/:id', async (c) => {
  const id = c.req.param('id');
  try {
    await ensureSchema();
    const result = await pool.query('delete from schedules where id = $1', [id]);
    if (result.rowCount === 0) return c.json({ error: 'Jadwal tidak ditemukan.' }, 404);
    return c.json({ ok: true });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

app.post('/schedules/:id/logs', async (c) => {
  const id = c.req.param('id');
  const body = await c.req
    .json<{ date?: unknown; cost?: unknown; note?: unknown; nextDueDate?: unknown }>()
    .catch(() => null);
  if (!body) return c.json({ error: 'Body JSON tidak valid.' }, 400);

  const date = isoDate(body.date);
  const nextDueDate = isoDate(body.nextDueDate);
  if (!date) return c.json({ error: 'Tanggal aksi tidak valid.' }, 400);

  try {
    await ensureSchema();
    const current = await pool.query<ScheduleRow>(
      `select ${SCHEDULE_COLUMNS} from schedules where id = $1`,
      [id],
    );
    if (current.rowCount === 0) return c.json({ error: 'Jadwal tidak ditemukan.' }, 404);

    const row = current.rows[0];
    if (row.kind === 'fixed' && !nextDueDate) {
      return c.json({ error: 'Perpanjangan butuh tanggal berlaku baru.' }, 400);
    }

    const entry = {
      id: crypto.randomUUID(),
      date,
      cost: toNumber(body.cost) ?? undefined,
      note:
        typeof body.note === 'string' && body.note.trim() ? body.note.trim() : undefined,
      nextDueDate: row.kind === 'fixed' ? nextDueDate ?? undefined : undefined,
    };
    const existing = Array.isArray(row.history) ? row.history : [];
    const history = [entry, ...existing].slice(0, 200);

    const result = await pool.query<ScheduleRow>(
      `update schedules set
         history = $2::jsonb,
         last_done_date = case when kind = 'interval' then $3::date else last_done_date end,
         due_date = case when kind = 'fixed' then $4::date else due_date end,
         updated_at = now()
       where id = $1
       returning ${SCHEDULE_COLUMNS}`,
      [id, JSON.stringify(history), date, nextDueDate],
    );

    return c.json({ schedule: mapRow(result.rows[0]), entry });
  } catch (error) {
    return c.json({ error: (error as Error).message }, 500);
  }
});

/** Ganti seluruh isi database (impor JSON / sinkronisasi awal). */
app.put('/schedules', async (c) => {
  const body = await c.req.json<{ schedules?: unknown }>().catch(() => null);
  if (!body || !Array.isArray(body.schedules)) {
    return c.json({ error: 'Format harus { schedules: [...] }.' }, 400);
  }

  const normalized: NormalizedSchedule[] = [];
  for (const item of body.schedules) {
    const parsed = normalize((item ?? {}) as SchedulePayload);
    if ('error' in parsed) return c.json({ error: parsed.error }, 400);
    normalized.push(parsed.data);
  }

  const client = await pool.connect();
  try {
    await ensureSchema();
    await client.query('begin');
    await client.query('delete from schedules');
    for (const data of normalized) {
      await client.query(
        `insert into schedules
           (id, title, category, kind, note, last_done_date, interval_value, interval_unit,
            due_date, remind_before_days, cost, history, created_at, updated_at)
         values
           (coalesce($1, gen_random_uuid()::text), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
            $12::jsonb, coalesce($13::timestamptz, now()), now())`,
        [
          data.id,
          data.title,
          data.category,
          data.kind,
          data.note,
          data.lastDoneDate,
          data.intervalValue,
          data.intervalUnit,
          data.dueDate,
          data.remindBeforeDays,
          data.cost,
          JSON.stringify(data.history),
          data.createdAt,
        ],
      );
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    return c.json({ error: (error as Error).message }, 500);
  } finally {
    client.release();
  }

  const result = await pool.query<ScheduleRow>(
    `select ${SCHEDULE_COLUMNS} from schedules order by created_at desc`,
  );
  return c.json({ schedules: result.rows.map(mapRow) });
});

export default app;
