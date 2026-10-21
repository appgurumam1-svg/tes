// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it('mengelola kategori: tambah, ubah, hapus, dan jadwal dipindah ke Lainnya', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Kelola kategori' }));
    const dialog = screen.getByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('Nama kategori baru'), {
      target: { value: 'Elektronik' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tambah' }));
    expect(await within(dialog).findByText('Elektronik')).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit Elektronik' }));
    fireEvent.change(within(dialog).getByLabelText('Nama kategori'), {
      target: { value: 'Gadget' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }));
    await waitFor(() => expect(within(dialog).getByText('Gadget')).toBeTruthy());

    const gadgetRow = within(dialog).getByText('Gadget').closest('li') as HTMLElement;
    fireEvent.click(within(gadgetRow).getByRole('button', { name: 'Hapus Gadget' }));
    await waitFor(() => expect(within(dialog).queryByText('Gadget')).toBeNull());

    const kendaraanRow = within(dialog).getByText('Kendaraan').closest('li') as HTMLElement;
    fireEvent.click(within(kendaraanRow).getByRole('button', { name: 'Hapus Kendaraan' }));
    await waitFor(() =>
      expect(within(dialog).queryByText('Kendaraan')).toBeNull(),
    );

    expect(screen.getByText('Ganti oli motor')).toBeTruthy();
    expect(screen.getAllByText(/Lainnya/).length).toBeGreaterThan(0);
    confirmSpy.mockRestore();
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

  it('menandai selesai dan memperbarui tanggal terakhir', () => {
    render(<App />);

    const card = screen.getByText('Ganti oli motor').closest('article');
    expect(card).not.toBeNull();
    fireEvent.click(within(card as HTMLElement).getByRole('button', { name: 'Tandai selesai' }));

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
