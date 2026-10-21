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
5. Lampiran struk/foto bisa diunggah saat mencatat (maks. 8 MB, JPG/PNG/WEBP/HEIC/PDF).
   File disimpan privat di Object Storage dan dibuka lewat tautan sementara.

### Akun

Aplikasi memakai Neon Auth (email + password). Daftar sekali, lalu data jadwal tersimpan per akun
dan bisa dibuka dari perangkat lain. Tombol keluar ada di kanan atas.

## Fitur

- Hitung umur aktivitas dalam tahun/bulan/hari, bukan sekadar selisih hari
- Perhitungan bulan kalender dengan pengamanan akhir bulan
  (31 Januari + 1 bulan = 28/29 Februari)
- Status berwarna + progress bar pemakaian interval
- Pencarian, filter status & kategori, urut dari yang paling mendesak
- Riwayat lengkap dengan biaya aktual dan total pengeluaran per jadwal
- **Manajemen kategori**: tambah/ubah/hapus kategori sendiri (emoji + nama), jadwal pada kategori yang dihapus dipindah ke "Lainnya"
- **Ekspor Excel (.xlsx)** berisi sheet **Jadwal** dan **Riwayat** (siap dibuka di Excel/Sheets)
- **Tema terang / gelap / ikuti sistem** (tersimpan di perangkat)
- **PWA**: bisa dipasang ke home screen, shell tetap terbuka saat offline
- **Notifikasi push** harian (Web Push + VAPID) dikirim function `remind` pukul 08.00 WIB untuk jadwal yang mendekati/lewat tenggat
- **Email pengingat harian** (opsional) — satu digest per user per hari ke email akun; aktif bila provider email diset
- **Verifikasi email & reset password** lewat OTP 6 digit (Neon Auth)
- **Hapus lampiran** dari storage sekaligus melepas referensinya di riwayat
- Data tersimpan per akun di Neon Postgres; mode `localStorage` hanya dipakai bila `VITE_API_URL` kosong
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
    storage.ts            localStorage + validasi data tersimpan
    excel.ts              ekspor .xlsx (sheet Jadwal & Riwayat)
    seed.ts               data contoh saat pertama dibuka
  types.ts
  styles.css
```

## Database: Neon Postgres

**Status deployment:** aktif.

| Item | Nilai |
| --- | --- |
| Neon project | `spring-sound-61634981` (org Ancient Cell), branch `production` |
| Neon Function | `api` → `https://br-young-firefly-a130i8rh-api.compute.c-1.ap-southeast-1.aws.neon.tech` |
| Neon Function | `remind` (cron harian `0 1 * * *` UTC / 08.00 WIB) |
| Neon Auth | `https://ep-rapid-tooth-a1az3by9.neonauth.ap-southeast-1.aws.neon.tech/neondb/auth` |
| Object Storage | bucket `assets` (private), endpoint `https://br-young-firefly-a130i8rh.storage.c-1.ap-southeast-1.aws.neon.tech` |
| Frontend | https://ingatkansaya.vercel.app (domain utama); alias: `pengingataqil.vercel.app` |
| Vercel project | `tes` (env `VITE_API_URL`, `VITE_NEON_AUTH_URL`, target production/preview/development) |

Aplikasi punya dua mode penyimpanan:

| Mode | Aktif saat | Data disimpan di |
| --- | --- | --- |
| **Cloud** | `VITE_API_URL` diisi saat build | Neon Postgres, lewat Neon Function |
| **Lokal** | `VITE_API_URL` kosong | `localStorage` browser |

Arsitektur cloud:

```
Browser (SPA Vite di Vercel)
    │  HTTPS + JSON
    ▼
Neon Function "api" (Hono + node-postgres)
    │  pooled DATABASE_URL (di-inject Neon)
    ▼
Neon Postgres — tabel schedules
```

Tabel `schedules` dibuat otomatis (idempotent) pada request pertama, jadi tidak ada langkah
migrasi manual.

### Endpoint API

| Method | Path | Fungsi |
| --- | --- | --- |
| GET | `/health` | Cek koneksi database |
| GET | `/schedules` | Ambil semua jadwal |
| POST | `/schedules` | Tambah jadwal |
| PUT | `/schedules/:id` | Ubah jadwal |
| DELETE | `/schedules/:id` | Hapus jadwal |
| POST | `/schedules/:id/logs` | Catat servis / perpanjangan (+ lampiran) |
| PUT | `/schedules` | Ganti seluruh isi milik user (dipakai "Muat contoh") |
| POST | `/uploads` | Upload struk/foto (multipart `file`) |
| GET | `/uploads/signed?key=` | URL sementara (10 menit) untuk lampiran |
| DELETE | `/uploads?key=` | Hapus lampiran + referensinya |
| GET | `/push/config` | VAPID public key |
| POST | `/push/subscribe` | Simpan subscription Web Push |
| DELETE | `/push/unsubscribe?endpoint=` | Hapus subscription |
| GET | `/categories` | Daftar kategori (default di-seed otomatis) |
| POST | `/categories` | Tambah kategori |
| PUT | `/categories/:id` | Ubah nama/emoji kategori |
| DELETE | `/categories/:id` | Hapus kategori + pindah jadwal ke "Lainnya" |

Semua endpoint `/schedules` dan `/uploads` memerlukan header
`Authorization: Bearer <JWT>` dari Neon Auth. Tanpa token → `401`.

### Variabel environment

| Variabel | Sumber | Dipakai |
| --- | --- | --- |
| `DATABASE_URL` | di-inject Neon ke Function | `functions/api.ts` |
| `NEON_AUTH_BASE_URL` | di-inject Neon | issuer JWT + URL Auth di klien |
| `NEON_AUTH_JWKS_URL` | di-inject Neon | verifikasi tanda tangan JWT |
| `AWS_*` | di-inject Neon | upload & signed URL Object Storage |
| `VITE_API_URL` | invocation URL Function | client (`src/lib/api.ts`) |
| `VITE_NEON_AUTH_URL` | `NEON_AUTH_BASE_URL` | client (`src/lib/auth.ts`) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | dibuat sendiri (web-push) | Function `api` & `remind` |
| `VITE_VAPID_PUBLIC_KEY` | sama dengan public key | client (`src/lib/push.ts`) |
| `BREVO_API_KEY` / `RESEND_API_KEY` / `SMTP_URL` | dibuat sendiri (Brevo / Resend / SMTP) | email di Function `remind` |
| `REMINDER_EMAIL_FROM` | mis. `Tenggat <appgurumam1@gmail.com>` | alamat pengirim email |
| `APP_URL` | opsional, default `https://ingatkansaya.vercel.app` | tautan di email |
| `APP_ORIGIN` | opsional, pisahkan dengan koma | tambahan origin CORS |

`VITE_API_URL` diisi di `.env.local` (gitignored). Tanpa variabel itu, aplikasi tetap jalan
dengan data lokal.

### Perintah

```bash
neon login                 # sekali saja
neon dev                   # jalankan Neon Function secara lokal (hot reload)
neon deploy                # terapkan neon.ts: provision services + deploy function
neon deploy --env .env.local   # sekaligus unggah env milik Function
```

### Layanan Neon

| Service | Status |
| --- | --- |
| Postgres | **dipakai** — tabel `schedules` |
| Functions | **dipakai** — REST API `api` |
| Auth | **dipakai** — Managed Better Auth (email/password), JWT diverifikasi Function |
| Object Storage | **dipakai** — bucket `assets` untuk struk/foto, akses via signed URL |
| AI Gateway | **gagal** — tidak tersedia di plan Free, dihapus dari `neon.ts` |
| Function Trigger | **dipakai** — cron harian `0 1 * * *` → function `remind` |

### Keamanan

- **Autentikasi:** setiap request ke `/schedules` dan `/uploads` wajib membawa JWT Neon Auth.
  Token diverifikasi terhadap JWKS (`EdDSA`), issuer & audience dicek.
- **Isolasi data:** tabel punya kolom `user_id`; semua query difilter `user_id = sub` dari JWT,
  sehingga user lain tidak bisa membaca/menghapus data (diuji → `404`).
- **CORS:** hanya `https://ingatkansaya.vercel.app`, `https://pengingataqil.vercel.app`, localhost, dan preview project ini.
  Origin asing tidak mendapat header `Access-Control-Allow-Origin`.
- **Lampiran:** bucket privat; akses hanya lewat signed URL 10 menit milik pemilik key.
- `DATABASE_URL` tidak pernah dikirim ke browser.


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
GitHub Pages, atau hosting statis apa pun. Build tanpa `VITE_API_URL` berjalan dalam mode
lokal; fitur akun, lampiran, dan push membutuhkan Neon Function.

## Catatan

- Perhitungan memakai kalender lokal (`yyyy-mm-dd`), bukan timestamp, agar tidak bergeser
  karena timezone.
- Status "Segera" dihitung saat aplikasi dibuka; notifikasi push dikirim sekali sehari oleh
  function `remind` (cron `0 1 * * *` UTC).
- User baru otomatis mendapat 6 jadwal contoh saat pertama masuk; bisa dihapus.
- Sesi Neon Auth memakai cookie `SameSite=None; Partitioned`. Browser yang memblokir total
  cookie pihak ketiga (mis. Safari dengan ITP ketat) bisa diminta login ulang.
- Lampiran bisa dihapus dari halaman edit jadwal (tombol "Hapus lampiran"); object di bucket
  dan referensi di riwayat ikut terhapus.
- Push notification butuh HTTPS + izin browser. Di iOS perlu PWA dipasang ke home screen
  (iOS 16.4+). Function `remind` berjalan sekali sehari; tidak ada pengiriman real-time.
- **Email pengingat opsional.** Isi `BREVO_API_KEY` (disarankan), `RESEND_API_KEY`, atau
  `SMTP_URL` (SMTP apa pun, mis. Gmail app password) plus `REMINDER_EMAIL_FROM`, lalu deploy
  ulang function `remind`. Tanpa konfigurasi itu email dilewati dan push tetap berjalan.
- Email hanya dikirim sekali per user per hari (tabel `email_reminder_log`), jadi retry
  trigger tidak menghasilkan duplikat. Penerima = email akun Neon Auth.
- Shared SMTP Neon Auth (`auth@mail.myneon.app`) hanya untuk email autentikasi
  (OTP/verifikasi/reset password) dan tidak bisa dipakai untuk pengingat aplikasi.
- Ganti VAPID key = semua subscription lama harus mendaftar ulang.
