/**
 * Penyusun isi email pengingat harian.
 *
 * Modul ini tidak menyentuh database maupun jaringan supaya bisa diuji
 * tanpa DATABASE_URL. Pengiriman ada di `mailer.ts`.
 */

export interface ReminderItem {
  title: string;
  /** Tanggal jatuh tempo dalam format `yyyy-mm-dd`. */
  dueDate: string;
  daysLeft: number;
}

export interface ReminderEmail {
  subject: string;
  text: string;
  html: string;
}

const MONTHS = [
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
];

/** `2026-10-21` → `21 Okt 2026`. */
export function formatDateID(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day || month < 1 || month > 12) return iso;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export function describeDays(daysLeft: number): string {
  if (daysLeft < 0) return `telat ${Math.abs(daysLeft)} hari`;
  if (daysLeft === 0) return 'jatuh tempo hari ini';
  return `${daysLeft} hari lagi`;
}

/** `telat 2 hari · jatuh tempo 19 Okt 2026` */
function describeItem(item: ReminderItem): string {
  const due = formatDateID(item.dueDate);
  if (item.daysLeft === 0) return `jatuh tempo hari ini · ${due}`;
  return `${describeDays(item.daysLeft)} · jatuh tempo ${due}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Menyusun email digest: satu email per user berisi semua jadwal yang
 * mendekati/melewati tenggat, diurutkan dari yang paling mendesak.
 */
export function buildReminderEmail(items: ReminderItem[], appUrl: string): ReminderEmail {
  const sorted = [...items].sort((a, b) => a.daysLeft - b.daysLeft);
  const total = sorted.length;
  const subject =
    total === 1 ? 'Tenggat: 1 jadwal perlu dicek' : `Tenggat: ${total} jadwal perlu dicek`;

  const lines = sorted.map((item) => `- ${item.title} — ${describeItem(item)}`);

  const text = [
    'Halo,',
    '',
    total === 1
      ? 'Ada 1 jadwal yang perlu dicek:'
      : `Ada ${total} jadwal yang perlu dicek:`,
    '',
    ...lines,
    '',
    `Buka aplikasi: ${appUrl}`,
    '',
    '—',
    'Email ini dikirim otomatis oleh Tenggat karena ada jadwal yang mendekati atau melewati tenggat.',
  ].join('\n');

  const listItems = sorted
    .map(
      (item) =>
        `<li style="margin:0 0 10px"><strong>${escapeHtml(item.title)}</strong><br>` +
        `<span style="color:#4b5563">${escapeHtml(describeItem(item))}</span></li>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="id">
  <body style="margin:0;padding:24px;background:#f4f5f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
      <h1 style="margin:0 0 4px;font-size:20px">Tenggat</h1>
      <p style="margin:0 0 20px;color:#6b7280;font-size:13px">Pengingat servis &amp; masa berlaku</p>
      <p style="margin:0 0 12px">${
        total === 1 ? 'Ada <strong>1</strong> jadwal yang perlu dicek:' : `Ada <strong>${total}</strong> jadwal yang perlu dicek:`
      }</p>
      <ul style="margin:0 0 20px;padding-left:20px">${listItems}</ul>
      <p style="margin:0 0 24px">
        <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px">Buka Tenggat</a>
      </p>
      <p style="margin:0;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;padding-top:12px">
        Email ini dikirim otomatis oleh Tenggat karena ada jadwal yang mendekati atau melewati tenggat.
      </p>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}
