import { describe, expect, it } from 'vitest';
import {
  addDaysISO,
  addIntervalISO,
  addMonthsISO,
  daysBetweenISO,
  diffParts,
  formatDateID,
  formatDuration,
  formatSpanDays,
  isISODate,
  todayISO,
} from './date';

describe('daysBetweenISO', () => {
  it('menghitung selisih hari kalender', () => {
    expect(daysBetweenISO('2026-05-01', '2026-05-01')).toBe(0);
    expect(daysBetweenISO('2026-05-01', '2026-05-31')).toBe(30);
    expect(daysBetweenISO('2026-05-31', '2026-05-01')).toBe(-30);
  });

  it('melewati pergantian tahun', () => {
    expect(daysBetweenISO('2025-12-31', '2026-01-01')).toBe(1);
    expect(daysBetweenISO('2026-01-01', '2027-01-01')).toBe(365);
    expect(daysBetweenISO('2024-01-01', '2025-01-01')).toBe(366);
  });
});

describe('addDaysISO / addMonthsISO', () => {
  it('menambah hari', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('mengunci akhir bulan saat menambah bulan', () => {
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsISO('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonthsISO('2026-08-31', 1)).toBe('2026-09-30');
    expect(addMonthsISO('2026-01-15', 13)).toBe('2027-02-15');
    expect(addMonthsISO('2026-01-15', -2)).toBe('2025-11-15');
  });

  it('menambah interval dengan satuan berbeda', () => {
    expect(addIntervalISO('2026-05-01', 2, 'week')).toBe('2026-05-15');
    expect(addIntervalISO('2026-05-01', 6, 'month')).toBe('2026-11-01');
    expect(addIntervalISO('2026-05-01', 1, 'year')).toBe('2027-05-01');
  });
});

describe('diffParts', () => {
  it('memecah durasi menjadi tahun, bulan, hari', () => {
    expect(diffParts('2026-05-01', '2026-05-01')).toMatchObject({ years: 0, months: 0, days: 0 });
    expect(diffParts('2026-05-01', '2026-06-15')).toMatchObject({ months: 1, days: 14 });
    expect(diffParts('2026-01-31', '2026-05-10')).toMatchObject({ months: 3, days: 10 });
    expect(diffParts('2024-02-29', '2025-03-01')).toMatchObject({ years: 1, months: 0, days: 1 });
  });

  it('menghitung total hari dan format durasi', () => {
    const parts = diffParts('2026-05-01', '2026-06-15');
    expect(parts.totalDays).toBe(45);
    expect(formatDuration(parts)).toBe('1 bulan 14 hari');
    expect(formatDuration(diffParts('2026-05-01', '2026-05-01'))).toBe('0 hari');
  });

  it('menoleransi tanggal terbalik', () => {
    expect(diffParts('2026-06-15', '2026-05-01').totalDays).toBe(0);
  });
});

describe('format & validasi', () => {
  it('memformat tanggal Indonesia', () => {
    expect(formatDateID('2026-08-17')).toBe('17 Agustus 2026');
    expect(formatDateID('2026-08-17', { weekday: true })).toBe('Senin, 17 Agustus 2026');
  });

  it('memvalidasi string ISO', () => {
    expect(isISODate('2026-02-28')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('17-08-2026')).toBe(false);
    expect(isISODate(undefined)).toBe(false);
  });

  it('membuat label jarak hari yang ramah', () => {
    expect(formatSpanDays(0)).toBe('hari ini');
    expect(formatSpanDays(7)).toBe('7 hari');
    expect(formatSpanDays(60)).toBe('2 bulan');
    expect(formatSpanDays(-8)).toBe('8 hari');
    expect(formatSpanDays(365)).toBe('1 tahun');
    expect(formatSpanDays(548)).toBe('1,5 tahun');
  });

  it('todayISO memakai tanggal lokal', () => {
    const now = new Date(2026, 9, 20, 23, 30);
    expect(todayISO(now)).toBe('2026-10-20');
  });
});
