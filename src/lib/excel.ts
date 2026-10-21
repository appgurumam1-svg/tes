import writeExcelFile from 'write-excel-file/browser';
import type { Cell, SheetData } from 'write-excel-file/browser';
import { formatDateID } from './date';
import { findCategory } from './categories';
import {
  STATUS_LABEL,
  computeSchedule,
  countdown,
  describeInterval,
  referenceDate,
} from './schedule';
import type { CategoryItem, Schedule } from '../types';

function headerCell(value: string): Cell {
  return { value, fontWeight: 'bold', backgroundColor: '#EEF2FF', align: 'center' };
}

function text(value: string | number | undefined | null): Cell {
  return { value: value ?? '' };
}

/**
 * Ekspor seluruh jadwal + riwayat ke satu file .xlsx (dua sheet).
 * Dipakai tombol "Ekspor Excel" di toolbar.
 */
export async function exportSchedulesToExcel(
  schedules: Schedule[],
  today: string,
  categories: CategoryItem[],
): Promise<void> {
  const jadwalHeader = [
    'Judul',
    'Kategori',
    'Jenis',
    'Status',
    'Jatuh Tempo',
    'Sisa / Telat',
    'Terakhir / Berlaku Sejak',
    'Interval',
    'Pengingat (hari)',
    'Estimasi Biaya (Rp)',
    'Catatan',
  ].map(headerCell);

  const jadwalRows: SheetData = schedules.map((schedule) => {
    const computed = computeSchedule(schedule, today);
    const { value, caption } = countdown(computed);
    const ref = referenceDate(schedule);
    const sisaTelat =
      computed.status === 'unknown' ? '-' : `${value} ${caption}`.trim();

    return [
      text(schedule.title),
      text(findCategory(categories, schedule.category).name),
      text(schedule.kind === 'fixed' ? 'Tanggal tetap' : 'Berkala'),
      text(STATUS_LABEL[computed.status]),
      text(computed.dueDate ? formatDateID(computed.dueDate) : '-'),
      text(sisaTelat),
      text(ref ? formatDateID(ref) : '-'),
      text(describeInterval(schedule)),
      text(schedule.remindBeforeDays),
      text(schedule.cost ?? ''),
      text(schedule.note ?? ''),
    ];
  });

  const riwayatHeader = [
    'Jadwal',
    'Tanggal',
    'Biaya (Rp)',
    'Catatan',
    'Berlaku Sampai',
    'Lampiran',
  ].map(headerCell);

  const riwayatRows: SheetData = schedules.flatMap((schedule) =>
    schedule.history.map((entry) => [
      text(schedule.title),
      text(formatDateID(entry.date)),
      text(entry.cost ?? ''),
      text(entry.note ?? ''),
      text(entry.nextDueDate ? formatDateID(entry.nextDueDate) : ''),
      text(entry.attachment?.name ?? ''),
    ]),
  );

  const blob = await writeExcelFile([
    {
      data: [jadwalHeader, ...jadwalRows],
      sheet: 'Jadwal',
      columns: [
        { width: 30 },
        { width: 14 },
        { width: 16 },
        { width: 12 },
        { width: 18 },
        { width: 18 },
        { width: 24 },
        { width: 18 },
        { width: 16 },
        { width: 18 },
        { width: 40 },
      ],
      stickyRowsCount: 1,
    },
    {
      data: [riwayatHeader, ...riwayatRows],
      sheet: 'Riwayat',
      columns: [
        { width: 30 },
        { width: 18 },
        { width: 14 },
        { width: 36 },
        { width: 18 },
        { width: 26 },
      ],
      stickyRowsCount: 1,
    },
  ]).toBlob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `tenggat-${today}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
