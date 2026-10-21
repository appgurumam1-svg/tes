// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from './App';
import { createSeedSchedules } from './lib/seed';
import { saveSchedules } from './lib/storage';

beforeEach(() => {
  localStorage.clear();
  // Data awal untuk test yang butuh jadwal; empty-state diuji terpisah.
  saveSchedules(createSeedSchedules());
});

afterEach(() => {
  cleanup();
});

describe('App', () => {
  it('mulai kosong bila belum ada data, dan contoh hanya dimuat saat diminta', () => {
    localStorage.clear();
    render(<App />);

    expect(screen.getByText('Belum ada jadwal')).toBeTruthy();
    expect(screen.queryByText('Ganti oli motor')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Muat contoh' }));

    expect(screen.getByText('Ganti oli motor')).toBeTruthy();
    expect(screen.queryByText('Belum ada jadwal')).toBeNull();
  });

  it('menampilkan jadwal contoh beserta status', () => {
    render(<App />);

    expect(screen.getByText('Ganti oli motor')).toBeTruthy();
    expect(screen.getByText('Pajak STNK tahunan')).toBeTruthy();
    expect(screen.getByText('Perpanjang SIM C')).toBeTruthy();
    expect(screen.getAllByText(/Terlambat|Segera|Aman/).length).toBeGreaterThan(0);
  });

  it('menambah jadwal berkala baru lewat modal', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Tambah jadwal/i }));

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Nama aktivitas'), {
      target: { value: 'Ganti filter udara' },
    });
    fireEvent.change(within(dialog).getByLabelText('Terakhir dilakukan'), {
      target: { value: '2026-01-01' },
    });
    fireEvent.change(within(dialog).getByLabelText('Diulang setiap'), {
      target: { value: '6' },
    });

    expect(within(dialog).getByText(/Jatuh tempo berikutnya/i)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Tambah jadwal' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Ganti filter udara')).toBeTruthy();
    expect(screen.getByText('Jadwal baru ditambahkan.')).toBeTruthy();
  });

  it('menolak nama kosong dengan pesan validasi', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Tambah jadwal/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tambah jadwal' }));

    expect(within(dialog).getByText('Nama aktivitas wajib diisi.')).toBeTruthy();
  });

  it('mencatat servis dan memperbarui tanggal terakhir', () => {
    render(<App />);

    const card = screen.getByText('Ganti oli motor').closest('article');
    expect(card).not.toBeNull();
    fireEvent.click(within(card as HTMLElement).getByRole('button', { name: 'Catat servis' }));

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Tanggal dilakukan'), {
      target: { value: '2026-10-20' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan catatan' }));

    expect(screen.getByText(/Tercatat: Ganti oli motor/)).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('menghapus jadwal setelah konfirmasi', () => {
    render(<App />);

    const firstCard = document.querySelector('article.card') as HTMLElement;
    const title = within(firstCard).getByRole('heading').textContent ?? '';
    expect(title.length).toBeGreaterThan(0);

    fireEvent.click(within(firstCard).getByRole('button', { name: 'Hapus' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/tidak bisa dibatalkan/i)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Ya, hapus' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText(title)).toBeNull();
  });

  it('memfilter berdasarkan status terlambat', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: /Terlambat/ }));

    const cards = document.querySelectorAll('article.card');
    expect(cards.length).toBe(1);
    expect(screen.getByText('Servis CVT & roller')).toBeTruthy();
  });
});
