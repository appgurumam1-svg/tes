# Tenggat

Aplikasi web untuk mencatat aktivitas yang punya tenggat dan masa berlaku: ganti oli,
servis CVT, perpanjang SIM, ganti plat nomor, pajak STNK, dan lain-lain.

Setiap jadwal menghitung sendiri:

- **Jatuh tempo** berikutnya
- **Sisa hari** atau **sudah telat berapa hari**
- **Sudah berapa lama** sejak terakhir dilakukan (contoh: "2 bulan 5 hari sejak 12 Mei 2026")
- **Status**: Terlambat / Segera (dalam masa pengingat) / Aman

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build produksi ke dist/
npm run preview  # cek hasil build
npm test         # unit test (Vitest)
npm run typecheck
```

## Cara pakai

1. Klik **Tambah jadwal**.
2. Pilih jenis jadwal:
   - **Berkala** — untuk aktivitas berulang. Isi *terakhir dilakukan* + *diulang setiap*
     (misal 3 bulan). Jatuh tempo dihitung otomatis dari tanggal terakhir.
   - **Tanggal tetap** — untuk dokumen dengan masa berlaku (SIM, STNK, plat nomor).
     Isi langsung *berlaku sampai*.
3. Atur **ingatkan sebelum** berapa hari → status berubah jadi "Segera" saat mendekati tenggat.
4. Saat servis/perpanjangan dilakukan, klik **Catat servis** / **Perpanjang**.
   Tanggal terakhir (atau masa berlaku baru) otomatis diperbarui dan masuk ke riwayat.

## Fitur

- Hitung umur aktivitas dalam tahun/bulan/hari, bukan sekadar selisih hari
- Perhitungan bulan kalender dengan pengamanan akhir bulan
  (31 Januari + 1 bulan = 28/29 Februari)
- Status berwarna + progress bar pemakaian interval
- Pencarian, filter status & kategori, urut dari yang paling mendesak
- Riwayat lengkap dengan biaya aktual dan total pengeluaran per jadwal
- Ekspor/impor JSON untuk backup atau pindah perangkat
- Data disimpan di `localStorage` browser — tanpa server, tanpa akun
- Tema terang/gelap mengikuti preferensi sistem, layout responsif

## Struktur

```
src/
  App.tsx                 state utama, filter, modal
  components/
    ScheduleCard.tsx      kartu jadwal + countdown + progress
    ScheduleForm.tsx      form tambah/edit dengan preview jatuh tempo
    LogModal.tsx          form catat servis / perpanjang
    HistoryList.tsx       daftar riwayat + total biaya
    Modal.tsx             dialog aksesibel (Esc, backdrop, scroll lock)
    Icons.tsx             ikon SVG inline
  lib/
    date.ts               aritmetika tanggal kalender (tanpa dependency)
    schedule.ts           status, progress, sorting, label
    storage.ts            localStorage + validasi impor
    seed.ts               data contoh saat pertama dibuka
  types.ts
  styles.css
```

## Deploy

### Vercel

```bash
npx vercel@latest login      # sekali saja (interaktif, di mesin sendiri)
npm run deploy               # atau: npx vercel deploy --prod
```

Konfigurasi ada di `vercel.json` (framework Vite, output `dist`, cache immutable untuk aset).

Alternatif tanpa CLI: hubungkan repo GitHub ini di dashboard Vercel → setiap push ke branch
utama otomatis ter-deploy.

### Hosting statis lain

`npm run build` menghasilkan folder `dist/` yang bisa diunggah ke Netlify, Cloudflare Pages,
GitHub Pages, atau hosting statis apa pun. Tidak ada server/API yang dibutuhkan.

## Catatan

- Perhitungan memakai kalender lokal (`yyyy-mm-dd`), bukan timestamp, agar tidak bergeser
  karena timezone.
- Aplikasi belum mengirim notifikasi push; status "Segera" muncul saat aplikasi dibuka.
