import { describe, expect, it } from 'vitest';
import { computeSchedule, countdown, describeInterval, sortByUrgency, summarize } from './schedule';
import type { Schedule } from '../types';

function makeSchedule(partial: Partial<Schedule>): Schedule {
  return {
    id: partial.id ?? 'test-1',
    title: 'Ganti oli motor',
    category: 'kendaraan',
    kind: 'interval',
    lastDoneDate: '2026-05-01',
    intervalValue: 3,
    intervalUnit: 'month',
    remindBeforeDays: 30,
    history: [],
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    ...partial,
  };
}

describe('computeSchedule — jadwal berkala', () => {
  it('menghitung jatuh tempo dan sisa hari', () => {
    const computed = computeSchedule(makeSchedule({}), '2026-06-15');
    expect(computed.dueDate).toBe('2026-08-01');
    expect(computed.daysLeft).toBe(47);
    expect(computed.status).toBe('safe');
    expect(computed.elapsed).toMatchObject({ months: 1, days: 14, totalDays: 45 });
    expect(computed.progress).toBeCloseTo(45 / 92, 3);
  });

  it('berstatus segera ketika masuk masa pengingat', () => {
    const computed = computeSchedule(makeSchedule({ remindBeforeDays: 60 }), '2026-06-15');
    expect(computed.status).toBe('soon');
  });

  it('berstatus terlambat dan menghitung hari keterlambatan', () => {
    const computed = computeSchedule(makeSchedule({}), '2026-08-09');
    expect(computed.daysLeft).toBe(-8);
    expect(computed.status).toBe('overdue');
    expect(computed.progress).toBe(1);
    expect(countdown(computed)).toEqual({ value: '8 hari', caption: 'terlambat' });
  });

  it('mengunci akhir bulan pada interval 1 bulan', () => {
    const computed = computeSchedule(
      makeSchedule({ lastDoneDate: '2026-01-31', intervalValue: 1, intervalUnit: 'month' }),
      '2026-02-10',
    );
    expect(computed.dueDate).toBe('2026-02-28');
    expect(computed.daysLeft).toBe(18);
  });

  it('mendukung satuan hari dan tahun', () => {
    const harian = computeSchedule(
      makeSchedule({ lastDoneDate: '2026-05-01', intervalValue: 7, intervalUnit: 'day' }),
      '2026-05-05',
    );
    expect(harian.dueDate).toBe('2026-05-08');

    const tahunan = computeSchedule(
      makeSchedule({ lastDoneDate: '2024-02-29', intervalValue: 1, intervalUnit: 'year' }),
      '2025-03-01',
    );
    expect(tahunan.dueDate).toBe('2025-02-28');
    expect(tahunan.status).toBe('overdue');
  });

  it('jatuh tempo hari ini', () => {
    const computed = computeSchedule(makeSchedule({}), '2026-08-01');
    expect(computed.daysLeft).toBe(0);
    expect(computed.status).toBe('soon');
    expect(countdown(computed)).toEqual({ value: 'Hari ini', caption: 'jatuh tempo' });
  });
});

describe('computeSchedule — tanggal tetap', () => {
  it('memakai tanggal kedaluwarsa apa adanya', () => {
    const computed = computeSchedule(
      makeSchedule({ kind: 'fixed', lastDoneDate: undefined, dueDate: '2026-07-01' }),
      '2026-06-15',
    );
    expect(computed.dueDate).toBe('2026-07-01');
    expect(computed.daysLeft).toBe(16);
    expect(computed.status).toBe('soon');
  });

  it('menandai dokumen yang sudah kedaluwarsa', () => {
    const computed = computeSchedule(
      makeSchedule({ kind: 'fixed', lastDoneDate: undefined, dueDate: '2026-06-01' }),
      '2026-06-15',
    );
    expect(computed.daysLeft).toBe(-14);
    expect(computed.status).toBe('overdue');
  });

  it('unknown bila tanggal belum diisi', () => {
    const computed = computeSchedule(makeSchedule({ kind: 'fixed' }), '2026-06-15');
    expect(computed.status).toBe('unknown');
    expect(countdown(computed).value).toBe('—');
  });
});

describe('helper tampilan', () => {
  it('membuat deskripsi interval', () => {
    expect(describeInterval(makeSchedule({}))).toBe('tiap 3 bulan');
    expect(describeInterval(makeSchedule({ kind: 'fixed', dueDate: '2027-01-01' }))).toBe(
      'tanggal tetap',
    );
  });

  it('meringkas status dan mengurutkan berdasarkan urgensi', () => {
    const schedules = [
      makeSchedule({ id: 'aman', lastDoneDate: '2026-07-20' }),
      makeSchedule({ id: 'telat', lastDoneDate: '2026-01-01' }),
      makeSchedule({ id: 'segera', lastDoneDate: '2026-05-20' }),
    ];
    const today = '2026-08-01';

    expect(summarize(schedules, today)).toEqual({
      total: 3,
      overdue: 1,
      soon: 1,
      safe: 1,
      unknown: 0,
    });
    expect(sortByUrgency(schedules, today).map((item) => item.id)).toEqual([
      'telat',
      'segera',
      'aman',
    ]);
  });
});
