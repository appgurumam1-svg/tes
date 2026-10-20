import { addIntervalISO, daysBetweenISO, diffParts, todayISO } from './date';
import type { DurationParts } from './date';
import type {
  Category,
  ComputedSchedule,
  IntervalUnit,
  Schedule,
  ScheduleStatus,
} from '../types';

export const DEFAULT_REMIND_DAYS = 30;

export const CATEGORY_META: Record<Category, { label: string; emoji: string }> = {
  kendaraan: { label: 'Kendaraan', emoji: '🛵' },
  dokumen: { label: 'Dokumen', emoji: '🪪' },
  kesehatan: { label: 'Kesehatan', emoji: '🩺' },
  langganan: { label: 'Langganan', emoji: '📱' },
  rumah: { label: 'Rumah', emoji: '🏠' },
  lainnya: { label: 'Lainnya', emoji: '📌' },
};

export const UNIT_LABEL: Record<IntervalUnit, string> = {
  day: 'hari',
  week: 'minggu',
  month: 'bulan',
  year: 'tahun',
};

export const STATUS_LABEL: Record<ScheduleStatus, string> = {
  overdue: 'Terlambat',
  soon: 'Segera',
  safe: 'Aman',
  unknown: 'Belum diatur',
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function statusFromDays(daysLeft: number, remindBeforeDays: number): ScheduleStatus {
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= remindBeforeDays) return 'soon';
  return 'safe';
}

/** Tanggal acuan: kapan aktivitas terakhir dilakukan / dokumen mulai berlaku. */
export function referenceDate(schedule: Schedule): string | undefined {
  if (schedule.kind === 'interval') {
    return schedule.lastDoneDate ?? schedule.history[0]?.date ?? schedule.createdAt.slice(0, 10);
  }
  const lastRenewal = schedule.history.find((entry) => entry.nextDueDate === schedule.dueDate);
  return lastRenewal?.date ?? schedule.createdAt.slice(0, 10);
}

export function computeSchedule(
  schedule: Schedule,
  today: string = todayISO(),
): ComputedSchedule {
  const remind = schedule.remindBeforeDays ?? DEFAULT_REMIND_DAYS;

  if (schedule.kind === 'fixed') {
    if (!schedule.dueDate) return { status: 'unknown', progress: 0 };

    const daysLeft = daysBetweenISO(today, schedule.dueDate);
    const start = referenceDate(schedule) ?? today;
    const spanDays = Math.max(daysBetweenISO(start, schedule.dueDate), 1);
    const usedDays = daysBetweenISO(start, today);
    const elapsedDate = daysLeft < 0 ? schedule.dueDate : today;

    return {
      dueDate: schedule.dueDate,
      daysLeft,
      status: statusFromDays(daysLeft, remind),
      progress: clamp(usedDays / spanDays, 0, 1),
      elapsed: diffParts(start, elapsedDate) as DurationParts,
      spanDays,
    };
  }

  const value = schedule.intervalValue ?? 0;
  const unit = schedule.intervalUnit ?? 'month';
  const last = referenceDate(schedule);

  if (!last || value <= 0) return { status: 'unknown', progress: 0 };

  const dueDate = addIntervalISO(last, value, unit);
  const daysLeft = daysBetweenISO(today, dueDate);
  const spanDays = Math.max(daysBetweenISO(last, dueDate), 1);
  const usedDays = daysBetweenISO(last, today);

  return {
    dueDate,
    daysLeft,
    status: statusFromDays(daysLeft, remind),
    progress: clamp(usedDays / spanDays, 0, 1),
    elapsed: diffParts(last, today) as DurationParts,
    spanDays,
  };
}

/** "tiap 3 bulan" / "tiap 1 tahun" */
export function describeInterval(schedule: Schedule): string {
  if (schedule.kind === 'fixed') return 'tanggal tetap';
  const value = schedule.intervalValue ?? 1;
  const unit = schedule.intervalUnit ?? 'month';
  return `tiap ${value} ${UNIT_LABEL[unit]}`;
}

export function countdown(
  computed: ComputedSchedule,
): { value: string; caption: string } {
  if (computed.status === 'unknown' || computed.daysLeft === undefined) {
    return { value: '—', caption: 'lengkapi data' };
  }
  const days = computed.daysLeft;
  if (days < 0) {
    const abs = Math.abs(days);
    return {
      value: `${abs} hari`,
      caption: 'terlambat',
    };
  }
  if (days === 0) return { value: 'Hari ini', caption: 'jatuh tempo' };
  if (days < 31) return { value: `${days} hari`, caption: 'lagi' };
  if (days < 365) return { value: `${Math.round(days / 30)} bulan`, caption: 'lagi' };
  return { value: `${(days / 365).toFixed(1).replace('.', ',')} tahun`, caption: 'lagi' };
}

export function sortByUrgency(schedules: Schedule[], today: string): Schedule[] {
  const rank: Record<ScheduleStatus, number> = { overdue: 0, soon: 1, safe: 2, unknown: 3 };
  return [...schedules].sort((a, b) => {
    const ca = computeSchedule(a, today);
    const cb = computeSchedule(b, today);
    if (rank[ca.status] !== rank[cb.status]) return rank[ca.status] - rank[cb.status];
    const da = ca.daysLeft ?? Number.MAX_SAFE_INTEGER;
    const db = cb.daysLeft ?? Number.MAX_SAFE_INTEGER;
    return da - db;
  });
}

export function summarize(schedules: Schedule[], today: string) {
  const result = { total: schedules.length, overdue: 0, soon: 0, safe: 0, unknown: 0 };
  for (const schedule of schedules) {
    const { status } = computeSchedule(schedule, today);
    result[status] += 1;
  }
  return result;
}

