/**
 * Utilitas tanggal.
 *
 * Semua tanggal jadwal disimpan sebagai string `yyyy-mm-dd` dan dihitung memakai
 * komponen kalender (bukan milidetik) supaya tidak terpengaruh timezone/DST dan
 * supaya "1 bulan" tetap berarti 1 bulan kalender, bukan 30 hari.
 */

export const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export const MONTHS_ID_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

export const WEEKDAYS_ID = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
] as const;

export interface YMD {
  y: number;
  m: number; // 1-12
  d: number; // 1-31
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_RE.exec(value);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function parseISO(iso: string): YMD {
  const match = ISO_RE.exec(iso);
  if (!match) throw new Error(`Tanggal tidak valid: ${iso}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

export function toISO(date: YMD): string {
  return `${String(date.y).padStart(4, '0')}-${String(date.m).padStart(2, '0')}-${String(
    date.d,
  ).padStart(2, '0')}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function todayISO(now: Date = new Date()): string {
  return toISO({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });
}

function utcMillis(date: YMD): number {
  return Date.UTC(date.y, date.m - 1, date.d);
}

/** Selisih hari kalender: positif bila `to` setelah `from`. */
export function daysBetweenISO(fromISO: string, toISO_: string): number {
  return Math.round((utcMillis(parseISO(toISO_)) - utcMillis(parseISO(fromISO))) / 86_400_000);
}

export function addDaysISO(iso: string, amount: number): string {
  const result = new Date(utcMillis(parseISO(iso)) + amount * 86_400_000);
  return toISO({
    y: result.getUTCFullYear(),
    m: result.getUTCMonth() + 1,
    d: result.getUTCDate(),
  });
}

/**
 * Menambah bulan kalender dengan pengamanan akhir bulan:
 * 31 Januari + 1 bulan = 28/29 Februari, bukan 3 Maret.
 */
export function addMonthsISO(iso: string, amount: number): string {
  const src = parseISO(iso);
  const index = src.y * 12 + (src.m - 1) + amount;
  const year = Math.floor(index / 12);
  const month = (((index % 12) + 12) % 12) + 1;
  return toISO({ y: year, m: month, d: Math.min(src.d, daysInMonth(year, month)) });
}

export type IntervalUnitLike = 'day' | 'week' | 'month' | 'year';

export function addIntervalISO(
  iso: string,
  amount: number,
  unit: IntervalUnitLike,
): string {
  switch (unit) {
    case 'day':
      return addDaysISO(iso, amount);
    case 'week':
      return addDaysISO(iso, amount * 7);
    case 'month':
      return addMonthsISO(iso, amount);
    case 'year':
      return addMonthsISO(iso, amount * 12);
    default: {
      const exhaustive: never = unit;
      return exhaustive;
    }
  }
}

export interface DurationParts {
  years: number;
  months: number;
  days: number;
  totalDays: number;
}

/**
 * Memecah jarak dua tanggal menjadi tahun + bulan + hari kalender.
 * Contoh: 2026-01-31 -> 2026-05-10 = 3 bulan 10 hari.
 */
export function diffParts(fromISO: string, toISO_: string): DurationParts {
  const totalDays = daysBetweenISO(fromISO, toISO_);
  if (totalDays <= 0) {
    return { years: 0, months: 0, days: 0, totalDays: Math.max(totalDays, 0) };
  }

  const from = parseISO(fromISO);
  const to = parseISO(toISO_);

  let months = (to.y - from.y) * 12 + (to.m - from.m);
  if (months < 0) months = 0;

  let anchor = addMonthsISO(fromISO, months);
  if (daysBetweenISO(anchor, toISO_) < 0) {
    months -= 1;
    anchor = addMonthsISO(fromISO, months);
  }

  return {
    years: Math.floor(months / 12),
    months: months % 12,
    days: daysBetweenISO(anchor, toISO_),
    totalDays,
  };
}

/** "2026-05-12" -> "12 Mei 2026" */
export function formatDateID(
  iso: string,
  options?: { short?: boolean; weekday?: boolean },
): string {
  const { y, m, d } = parseISO(iso);
  const month = options?.short ? MONTHS_ID_SHORT[m - 1] : MONTHS_ID[m - 1];
  const base = `${d} ${month} ${y}`;
  if (!options?.weekday) return base;
  return `${weekdayID(iso)}, ${base}`;
}

export function weekdayID(iso: string): string {
  const { y, m, d } = parseISO(iso);
  return WEEKDAYS_ID[new Date(utcMillis({ y, m, d })).getUTCDay()];
}

/** Bagian durasi tanpa angka nol: 1 tahun 2 bulan 0 hari -> "1 tahun 2 bulan". */
export function formatDuration(parts: DurationParts): string {
  const chunks: string[] = [];
  if (parts.years > 0) chunks.push(`${parts.years} tahun`);
  if (parts.months > 0) chunks.push(`${parts.months} bulan`);
  if (parts.days > 0) chunks.push(`${parts.days} hari`);
  return chunks.length > 0 ? chunks.join(' ') : '0 hari';
}

/** Jarak hari yang enak dibaca: "hari ini", "5 hari", "3 bulan", "1,5 tahun". */
export function formatSpanDays(days: number): string {
  const abs = Math.abs(days);
  if (abs === 0) return 'hari ini';
  if (abs < 31) return `${abs} hari`;
  if (abs < 365) return `${Math.round(abs / 30)} bulan`;
  const rounded = Math.round((abs / 365) * 10) / 10;
  return `${String(rounded).replace('.', ',')} tahun`;
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function parseNumber(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}
