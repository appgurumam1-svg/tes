import { isISODate, todayISO } from './date';
import { CATEGORY_META, DEFAULT_REMIND_DAYS } from './schedule';
import type {
  Category,
  HistoryEntry,
  IntervalUnit,
  Schedule,
  ScheduleKind,
} from '../types';

export const STORAGE_KEY = 'tenggat.schedules.v1';

const CATEGORIES = Object.keys(CATEGORY_META) as Category[];
const UNITS: IntervalUnit[] = ['day', 'week', 'month', 'year'];
const KINDS: ScheduleKind[] = ['interval', 'fixed'];

export function uid(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function sanitizeHistory(value: unknown): HistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const entry = raw as Record<string, unknown>;
    if (!isISODate(entry.date)) return [];
    return [
      {
        id: typeof entry.id === 'string' ? entry.id : uid('hist'),
        date: entry.date,
        cost: asNumber(entry.cost),
        note: typeof entry.note === 'string' && entry.note.trim() ? entry.note.trim() : undefined,
        nextDueDate: isISODate(entry.nextDueDate) ? entry.nextDueDate : undefined,
      },
    ];
  });
}

/** Membersihkan data dari localStorage / file import agar tidak membuat app crash. */
export function normalizeSchedule(raw: unknown): Schedule | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;

  const title = typeof item.title === 'string' ? item.title.trim() : '';
  if (!title) return null;

  const kind: ScheduleKind = KINDS.includes(item.kind as ScheduleKind)
    ? (item.kind as ScheduleKind)
    : 'interval';

  const category: Category = CATEGORIES.includes(item.category as Category)
    ? (item.category as Category)
    : 'lainnya';

  const intervalUnit: IntervalUnit = UNITS.includes(item.intervalUnit as IntervalUnit)
    ? (item.intervalUnit as IntervalUnit)
    : 'month';

  const remind = asNumber(item.remindBeforeDays);
  const history = sanitizeHistory(item.history);
  const now = new Date().toISOString();

  const schedule: Schedule = {
    id: typeof item.id === 'string' && item.id ? item.id : uid('sched'),
    title: title.slice(0, 120),
    category,
    kind,
    note: typeof item.note === 'string' && item.note.trim() ? item.note.trim() : undefined,
    remindBeforeDays:
      remind !== undefined ? Math.min(Math.max(Math.round(remind), 0), 365) : DEFAULT_REMIND_DAYS,
    history,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : now,
  };

  const cost = asNumber(item.cost);
  if (cost !== undefined) schedule.cost = cost;

  if (kind === 'interval') {
    let lastDone: string;
    if (isISODate(item.lastDoneDate)) {
      lastDone = item.lastDoneDate;
    } else if (history[0]?.date) {
      lastDone = history[0].date;
    } else if (isISODate(item.createdAt)) {
      lastDone = item.createdAt;
    } else {
      lastDone = todayISO();
    }

    const value = asNumber(item.intervalValue);
    schedule.lastDoneDate = lastDone;
    schedule.intervalValue = value !== undefined && value > 0 ? Math.round(value) : 3;
    schedule.intervalUnit = intervalUnit;
  } else {
    if (!isISODate(item.dueDate)) return null;
    schedule.dueDate = item.dueDate;
  }

  return schedule;
}

export function loadSchedules(): Schedule[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : (parsed as { schedules?: unknown })?.schedules;
    if (!Array.isArray(list)) return null;
    return list
      .map(normalizeSchedule)
      .filter((item): item is Schedule => item !== null);
  } catch {
    return null;
  }
}

export function saveSchedules(schedules: Schedule[]): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ app: 'tenggat', version: 1, schedules }),
    );
  } catch {
    // localStorage penuh / diblokir: data tetap hidup di state selama sesi berjalan.
  }
}

export function exportSchedules(schedules: Schedule[]): string {
  return JSON.stringify(
    { app: 'tenggat', version: 1, exportedAt: new Date().toISOString(), schedules },
    null,
    2,
  );
}

export function importSchedules(text: string): Schedule[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File bukan JSON yang valid.');
  }
  const list = Array.isArray(parsed)
    ? parsed
    : (parsed as { schedules?: unknown })?.schedules;
  if (!Array.isArray(list)) {
    throw new Error('Format tidak dikenali. Pastikan file berisi daftar "schedules".');
  }
  const schedules = list
    .map(normalizeSchedule)
    .filter((item): item is Schedule => item !== null);
  if (schedules.length === 0) {
    throw new Error('Tidak ada jadwal valid di dalam file.');
  }
  return schedules;
}

export function downloadFile(filename: string, content: string, type = 'application/json'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
