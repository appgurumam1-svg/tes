import { addDaysISO, addMonthsISO, todayISO } from './date';
import { uid } from './storage';
import type { Schedule } from '../types';

/**
 * Data contoh supaya aplikasi langsung "hidup" saat pertama dibuka.
 * Tanggal dihitung relatif terhadap hari ini agar statusnya selalu relevan
 * (ada yang aman, segera, dan terlambat).
 */
export function createSeedSchedules(today: string = todayISO()): Schedule[] {
  const now = new Date().toISOString();

  const base = (): Pick<Schedule, 'id' | 'history' | 'createdAt' | 'updatedAt'> => ({
    id: uid('seed'),
    history: [],
    createdAt: now,
    updatedAt: now,
  });

  return [
    {
      ...base(),
      title: 'Ganti oli motor',
      category: 'kendaraan',
      kind: 'interval',
      lastDoneDate: addMonthsISO(today, -2),
      intervalValue: 3,
      intervalUnit: 'month',
      remindBeforeDays: 30,
      cost: 65_000,
      note: 'Oli mesin 800 ml + filter. Motor dipakai harian.',
    },
    {
      ...base(),
      title: 'Servis CVT & roller',
      category: 'kendaraan',
      kind: 'interval',
      lastDoneDate: addMonthsISO(today, -7),
      intervalValue: 6,
      intervalUnit: 'month',
      remindBeforeDays: 30,
      cost: 150_000,
      note: 'Bersihkan CVT, cek roller dan v-belt.',
    },
    {
      ...base(),
      title: 'Pajak STNK tahunan',
      category: 'dokumen',
      kind: 'fixed',
      dueDate: addDaysISO(today, 25),
      remindBeforeDays: 30,
      cost: 250_000,
      note: 'Bayar di Samsat atau lewat aplikasi Signal.',
    },
    {
      ...base(),
      title: 'Perpanjang SIM C',
      category: 'dokumen',
      kind: 'fixed',
      dueDate: addMonthsISO(today, 26),
      remindBeforeDays: 60,
      cost: 80_000,
      note: 'SIM berlaku 5 tahun. Bawa KTP + SIM lama.',
    },
    {
      ...base(),
      title: 'Ganti plat nomor',
      category: 'dokumen',
      kind: 'fixed',
      dueDate: addMonthsISO(today, 38),
      remindBeforeDays: 60,
      cost: 100_000,
      note: 'Plat berlaku 5 tahun, sekalian pajak 5 tahunan.',
    },
    {
      ...base(),
      title: 'Cek tekanan angin ban',
      category: 'kendaraan',
      kind: 'interval',
      lastDoneDate: addDaysISO(today, -10),
      intervalValue: 1,
      intervalUnit: 'month',
      remindBeforeDays: 5,
      note: 'Depan 29 psi, belakang 33 psi (berdua).',
    },
  ];
}
