import { describe, expect, it } from 'vitest';
import { buildReminderEmail, describeDays, formatDateID } from './reminder-email';

describe('formatDateID', () => {
  it('memformat tanggal ISO ke bahasa Indonesia', () => {
    expect(formatDateID('2026-10-21')).toBe('21 Okt 2026');
    expect(formatDateID('2026-01-05')).toBe('5 Jan 2026');
  });

  it('mengembalikan nilai asli bila format tidak valid', () => {
    expect(formatDateID('bukan-tanggal')).toBe('bukan-tanggal');
    expect(formatDateID('2026-13-01')).toBe('2026-13-01');
  });
});

describe('describeDays', () => {
  it('membedakan telat, hari ini, dan akan datang', () => {
    expect(describeDays(-3)).toBe('telat 3 hari');
    expect(describeDays(0)).toBe('jatuh tempo hari ini');
    expect(describeDays(7)).toBe('7 hari lagi');
  });
});

describe('buildReminderEmail', () => {
  const appUrl = 'https://ingatkansaya.vercel.app';

  it('menyusun subjek dan teks untuk beberapa jadwal, urut paling mendesak', () => {
    const email = buildReminderEmail(
      [
        { title: 'Servis CVT', dueDate: '2026-10-28', daysLeft: 7 },
        { title: 'Ganti oli', dueDate: '2026-10-19', daysLeft: -2 },
        { title: 'Pajak STNK', dueDate: '2026-10-21', daysLeft: 0 },
      ],
      appUrl,
    );

    expect(email.subject).toBe('Tenggat: 3 jadwal perlu dicek');
    expect(email.text).toContain('Ada 3 jadwal yang perlu dicek:');
    expect(email.text.indexOf('Ganti oli')).toBeLessThan(email.text.indexOf('Pajak STNK'));
    expect(email.text.indexOf('Pajak STNK')).toBeLessThan(email.text.indexOf('Servis CVT'));
    expect(email.text).toContain('- Ganti oli — telat 2 hari · jatuh tempo 19 Okt 2026');
    expect(email.text).toContain('Pajak STNK — jatuh tempo hari ini · 21 Okt 2026');
    expect(email.text).toContain(`Buka aplikasi: ${appUrl}`);
  });

  it('memakai subjek tunggal untuk satu jadwal', () => {
    const email = buildReminderEmail(
      [{ title: 'Ganti plat', dueDate: '2026-11-01', daysLeft: 11 }],
      appUrl,
    );
    expect(email.subject).toBe('Tenggat: 1 jadwal perlu dicek');
    expect(email.text).toContain('Ada 1 jadwal yang perlu dicek:');
  });

  it('meng-escape HTML dari judul jadwal', () => {
    const email = buildReminderEmail(
      [{ title: '<img src=x onerror=alert(1)>', dueDate: '2026-10-21', daysLeft: 0 }],
      appUrl,
    );
    expect(email.html).not.toContain('<img src=x');
    expect(email.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('menyertakan tautan aplikasi di HTML', () => {
    const email = buildReminderEmail(
      [{ title: 'Servis', dueDate: '2026-10-21', daysLeft: 0 }],
      appUrl,
    );
    expect(email.html).toContain(`href="${appUrl}"`);
  });
});
