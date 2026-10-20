import type { DurationParts } from './lib/date';

export type Category =
  | 'kendaraan'
  | 'dokumen'
  | 'kesehatan'
  | 'langganan'
  | 'rumah'
  | 'lainnya';

export type IntervalUnit = 'day' | 'week' | 'month' | 'year';

/**
 * interval = aktivitas berulang, jatuh tempo dihitung dari tanggal terakhir dikerjakan.
 * fixed    = tanggal kedaluwarsa tetap (SIM, plat nomor, STNK, kontrak, dsb).
 */
export type ScheduleKind = 'interval' | 'fixed';

export interface Attachment {
  key: string;
  name: string;
  size?: number;
  contentType?: string;
}

export interface HistoryEntry {
  id: string;
  /** Tanggal aksi dilakukan (ISO yyyy-mm-dd). */
  date: string;
  /** Biaya yang dikeluarkan saat aksi (opsional). */
  cost?: number;
  note?: string;
  /** Khusus jadwal fixed: tanggal kedaluwarsa baru setelah diperpanjang. */
  nextDueDate?: string;
  /** Lampiran di Neon Object Storage (struk/foto). */
  attachment?: Attachment;
}

export interface Schedule {
  id: string;
  title: string;
  category: Category;
  kind: ScheduleKind;
  note?: string;

  /** Khusus kind = interval. */
  lastDoneDate?: string;
  intervalValue?: number;
  intervalUnit?: IntervalUnit;

  /** Khusus kind = fixed. */
  dueDate?: string;

  /** Berapa hari sebelum jatuh tempo status berubah menjadi "segera". */
  remindBeforeDays: number;

  /** Perkiraan biaya (opsional, untuk estimasi pengeluaran). */
  cost?: number;

  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export type ScheduleStatus = 'overdue' | 'soon' | 'safe' | 'unknown';

export interface ComputedSchedule {
  dueDate?: string;
  /** Positif = masih tersisa, negatif = sudah lewat. */
  daysLeft?: number;
  status: ScheduleStatus;
  /** 0..1 seberapa jauh interval terpakai. */
  progress: number;
  /** Jarak dari tanggal acuan (terakhir dilakukan / dibuat) sampai hari ini. */
  elapsed?: DurationParts;
  /** Total panjang interval dalam hari (untuk progress). */
  spanDays?: number;
}

export interface Filters {
  search: string;
  status: 'all' | Exclude<ScheduleStatus, 'unknown'>;
  category: 'all' | Category;
}

/** Data yang dikirim form tambah/edit (tanpa id, history, timestamp). */
export interface ScheduleDraft {
  title: string;
  category: Category;
  kind: ScheduleKind;
  note?: string;
  lastDoneDate?: string;
  intervalValue?: number;
  intervalUnit?: IntervalUnit;
  dueDate?: string;
  remindBeforeDays: number;
  cost?: number;
}

export interface LogEntryDraft {
  date: string;
  cost?: number;
  note?: string;
  nextDueDate?: string;
  attachment?: Attachment;
}

