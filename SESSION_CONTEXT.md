# Konteks Sesi — Tenggat (Pengingat Servis & Masa Berlaku)

> **Dokumen ini aman di-commit** — tidak berisi token, password, atau connection string.
> Nilai kredensial ada di `SESSION_CREDENTIALS.local.md` yang **di-gitignore**.

- **Terakhir diperbarui:** 2026-10-21
- **Repo:** `appgurumam1-svg/tes` (publik) — rename ke `pengingat-aqil` belum dilakukan
- **Branch kerja:** `cline/787rz3m1`
- **Commit terakhir saat dokumen ini dibuat:** `767c17d`
- **Domain utama:** https://ingatkansaya.vercel.app
- **Verifikasi terakhir (2026-10-21):** `npm test` 53/53 lulus, `npm run build` sukses,
  `GET /health` → `{"ok":true,"database":"up"}`, situs produksi `200`, allowlist CORS
  berperilaku benar (origin asing tanpa `Access-Control-Allow-Origin`, request tanpa JWT
  → `401`), dan pemindaian seluruh 16 commit tidak menemukan kredensial ter-commit.
  Uji E2E terautentikasi lulus: sign-up/sign-in → JWT, CRUD jadwal, log servis,
  upload → signed URL → hapus lampiran, CRUD kategori, push subscribe/unsubscribe.
  Workbook Excel berisi sheet `Jadwal` + `Riwayat`; aset PWA produksi (manifest, `sw.js`,
  3 ikon) semua `200`; alias `pengingataqil.vercel.app` sudah menunjuk produksi.
  Email pengingat aktif lewat **Brevo API**: email uji terkirim ke `appgurumam1@gmail.com`,
  function `remind` deployment 4 memuat `BREVO_API_KEY` + `REMINDER_EMAIL_FROM` + VAPID.

---

## 1. Ringkasan produk

Aplikasi web untuk mencatat aktivitas/servis/dokumen yang punya tenggat:

- Dua jenis jadwal: **berkala** (mis. oli tiap 3 bulan) dan **tanggal tetap** (SIM/STNK/plat).
- Menghitung jatuh tempo, sisa hari, keterlambatan, dan durasi "sudah berapa lama".
- Status: Terlambat / Segera / Aman + progress bar.
- Kategori bisa dikelola user (tambah/ubah/hapus, emoji), 6 kategori bawaan.
- Riwayat servis + biaya + lampiran struk (Object Storage) + hapus lampiran.
- Auth email/password (Neon Auth, OTP untuk verifikasi & reset password).
- Ekspor Excel 2 sheet (Jadwal, Riwayat).
- Tema terang/gelap/ikuti sistem, PWA installable, Web Push harian.

Stack: **React 19 + TypeScript + Vite 8**, API **Neon Functions (Hono + node-postgres)**,
DB **Neon Postgres**, auth **Neon Auth**, storage **Neon Object Storage**, hosting **Vercel**.

---

## 2. URL & ID (bukan rahasia)

| Item | Nilai |
| --- | --- |
| Frontend produksi | https://ingatkansaya.vercel.app |
| Alias Vercel lain | `tes-appgurumam1-svg.vercel.app`, `tes-git-cline-787rz3m1-appgurumam1-svg.vercel.app` |
| Alias sekunder | `pengingataqil.vercel.app` (domain proyek, menyajikan produksi yang sama; bukan domain utama) |
| API Function | `https://br-young-firefly-a130i8rh-api.compute.c-1.ap-southeast-1.aws.neon.tech` |
| Reminder Function | `https://br-young-firefly-a130i8rh-remind.compute.c-1.ap-southeast-1.aws.neon.tech` |
| Neon Auth base | `https://ep-rapid-tooth-a1az3by9.neonauth.ap-southeast-1.aws.neon.tech/neondb/auth` |
| JWKS | `{AUTH_BASE}/.well-known/jwks.json` |
| Object Storage endpoint | `https://br-young-firefly-a130i8rh.storage.c-1.ap-southeast-1.aws.neon.tech` |
| Bucket | `assets` (private), region `ap-southeast-1` |
| Vercel project | `tes` — `prj_ZMg5k29QUkl82SSSsutk6xcfGn8A`, team `team_Xvv1xe8TXSSMzaOPmhyUCd3y` |
| Neon org / project | `org-ancient-cell-00957436` / `spring-sound-61634981` |
| Neon branch | `production` — `br-young-firefly-a130i8rh` |
| Function trigger | `daily-reminder` → cron `0 1 * * *` UTC (08.00 WIB) |

---

## 3. Arsitektur

```
Browser (SPA Vite di Vercel)
  ├─ Neon Auth (cookie SameSite=None; Partitioned) → JWT EdDSA 15 menit
  ├─ Authorization: Bearer <JWT>
  ▼
Neon Function "api" (Hono)
  ├─ verifikasi JWT via JWKS (issuer & audience = origin Auth)
  ├─ Postgres (pooled DATABASE_URL) — filter user_id
  └─ S3-compatible Object Storage (upload/signed URL/delete)
Neon Function "remind" (cron harian) → Web Push (VAPID) + email (Resend/SMTP)
```

Mode lokal tetap ada: bila `VITE_API_URL` kosong, data disimpan di `localStorage`
(dipakai juga saat unit test, `MODE === 'test'`).

---

## 4. Skema database

```sql
schedules(
  id text pk, user_id text, title text, category text, kind text check(interval|fixed),
  note text, last_done_date date, interval_value int, interval_unit text,
  due_date date, remind_before_days int, cost numeric, history jsonb,
  created_at timestamptz, updated_at timestamptz
)

categories(
  user_id text, id text, name text, emoji text, sort_order int, created_at timestamptz,
  primary key (user_id, id)
)

push_subscriptions(
  endpoint text pk, user_id text, subscription jsonb, created_at timestamptz
)

email_reminder_log(
  user_id text, sent_on date, created_at timestamptz, primary key (user_id, sent_on)
)
```

- Tabel dibuat otomatis oleh `ensureSchema()` pada request pertama.
- Kategori default di-seed per user oleh `ensureDefaultCategories(userId)`.
- `history` berisi array entri: `{id,date,cost?,note?,nextDueDate?,attachment?}`.
- Menghapus kategori memindahkan `schedules.category` ke `lainnya`; `lainnya` tidak bisa dihapus.

---

## 5. API (Function `api`)

Semua endpoint kecuali `/health` dan `/push/config` memerlukan
`Authorization: Bearer <JWT Neon Auth>`.

| Method | Path | Fungsi |
| --- | --- | --- |
| GET | `/health` | cek DB |
| GET | `/schedules` | daftar jadwal milik user |
| POST | `/schedules` | tambah jadwal |
| PUT | `/schedules/:id` | ubah jadwal |
| DELETE | `/schedules/:id` | hapus jadwal |
| POST | `/schedules/:id/logs` | catat servis/perpanjangan (+ lampiran) |
| PUT | `/schedules` | ganti seluruh jadwal user (dipakai "Muat contoh") |
| POST | `/uploads` | upload struk (multipart `file`, maks 8 MB, JPG/PNG/WEBP/HEIC/PDF) |
| GET | `/uploads/signed?key=` | signed URL 10 menit |
| DELETE | `/uploads?key=` | hapus object + referensi di riwayat |
| GET | `/categories` | daftar kategori (seed default) |
| POST | `/categories` | tambah kategori |
| PUT | `/categories/:id` | ubah nama/emoji |
| DELETE | `/categories/:id` | hapus + pindah jadwal ke `lainnya` |
| GET | `/push/config` | VAPID public key |
| POST | `/push/subscribe` | simpan subscription |
| DELETE | `/push/unsubscribe?endpoint=` | hapus subscription |

CORS allowlist (`functions/api.ts`):
`https://ingatkansaya.vercel.app`, `https://pengingataqil.vercel.app`, `http://localhost:5173`,
`http://127.0.0.1:5173`, plus regex preview `https://tes-*-appgurumam1-svg.vercel.app`,
plus `APP_ORIGIN` opsional (dipisah koma).

---

## 6. Auth, domain, dan keamanan

- Managed Better Auth (email/password), verifikasi email **OTP 6 digit**, reset password OTP.
- JWT EdDSA, issuer & audience = origin `NEON_AUTH_BASE_URL` (tanpa path).
- Trusted domain Neon Auth: `ingatkansaya.vercel.app`, `pengingataqil.vercel.app`,
  `tes-git-cline-787rz3m1-appgurumam1-svg.vercel.app`; localhost diizinkan.
- Isolasi data: semua query `schedules`/`categories`/`push_subscriptions` difilter `user_id = sub`.
- Lampiran privat; akses via signed URL 10 menit; key harus berprefix `receipts/<userId>/`.
- CORS origin asing tidak mendapat header `Access-Control-Allow-Origin`.
- Catatan: CORS server Neon Auth mencerminkan origin apa pun (perilaku layanan); cookie
  `Partitioned` membatasi konteks pihak ketiga.

---

## 7. Fitur & status

| Fitur | Status |
| --- | --- |
| Jadwal berkala & tanggal tetap, hitung telat/sisa | ✅ |
| Riwayat + biaya + lampiran + hapus lampiran | ✅ |
| Kategori dinamis (CRUD, emoji, reassign ke Lainnya) | ✅ |
| Auth JWT + isolasi user + OTP email/reset | ✅ |
| Ekspor Excel 2 sheet | ✅ |
| Tema terang/gelap/sistem | ✅ |
| PWA (manifest, service worker, ikon) | ✅ |
| Web Push harian (cron 01:00 UTC) | ✅ (pengiriman ke perangkat belum diuji dari sandbox) |
| Email pengingat harian (Brevo API, opsional) | ✅ aktif; email uji terkirim 2026-10-21 |
| Import JSON | ❌ dihapus (diganti ekspor Excel) |
| Notifikasi real-time | ❌ (harian saja) |


---

## 8. Environment variables

Disimpan di `.env.local` (gitignored) dan di-set di Vercel untuk yang berawalan `VITE_`.

| Variabel | Sumber | Publik? |
| --- | --- | --- |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Neon (pull) | tidak |
| `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL` | Neon (pull) | URL aman |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION` | Neon (pull) | tidak |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | dibuat sendiri | private key **tidak** |
| `BREVO_API_KEY` / `RESEND_API_KEY` / `SMTP_URL` | dibuat sendiri (Brevo / Resend / SMTP) | tidak |
| `REMINDER_EMAIL_FROM` | alamat pengirim email | tidak |
| `APP_URL` | opsional, default `https://ingatkansaya.vercel.app` | ya |
| `VITE_API_URL` | URL function | ya (ter-bundle) |
| `VITE_NEON_AUTH_URL` | `NEON_AUTH_BASE_URL` | ya |
| `VITE_VAPID_PUBLIC_KEY` | VAPID public | ya |
| `APP_ORIGIN` | opsional | tidak |

Vercel env saat ini (production/preview/development):
`VITE_API_URL`, `VITE_NEON_AUTH_URL`, `VITE_VAPID_PUBLIC_KEY`.

---

## 9. Perintah penting

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # vitest
npm run build        # typecheck klien + API, lalu vite build
npm run icons        # regenerate ikon PWA (sharp)

# Backend / Neon
neon deploy -y --env .env.local      # deploy functions + trigger + env
neon functions get api               # URL & status
neon triggers list                   # cek cron
neon neon-auth domain list           # trusted domains
neon env pull                        # tarik env terbaru ke .env.local

# Frontend
git push origin cline/787rz3m1       # Vercel auto-deploy
```

Verifikasi cepat:

```bash
curl -s https://br-young-firefly-a130i8rh-api.compute.c-1.ap-southeast-1.aws.neon.tech/health
curl -s -o /dev/null -w '%{http_code}\n' https://ingatkansaya.vercel.app/
```

---

## 10. Catatan / gotcha

1. **Rename repo tidak bisa dari sandbox.** Semua trafik GitHub lewat egress proxy yang
   menyuntikkan kredensialnya sendiri; header `Authorization` dari agent diabaikan.
   Kredensial proxy tidak punya `administration=write`, jadi `PATCH /repos/... {name}`
   selalu `403`. Rename harus manual di GitHub Settings.
2. **Deployment URL Vercel** (`tes-*.vercel.app`) dilindungi Vercel Authentication (302),
   sedangkan alias produksi `ingatkansaya.vercel.app` publik. Uji lewat alias.
3. **Alias lama** `pengingataqil.vercel.app` kini terpasang sebagai domain proyek dan
   menyajikan deployment produksi yang sama. Domain utama tetap `ingatkansaya.vercel.app`.
4. **AI Gateway** tidak tersedia di plan Free → dihapus dari `neon.ts`.
5. `neon deploy` menulis `.env.local` dengan nilai **ber-quote**; parser manual harus
   menghapus `"` di awal/akhir.
6. `ensureSchema()` baru berjalan saat request pertama; setelah deploy fungsi baru,
   panggil `/health` dulu sebelum query tabel baru.
7. Propagasi Neon Function setelah deploy ±30–60 detik.
8. Service worker cache: setelah deploy, lakukan hard refresh agar bundle baru terpakai.
9. Email OTP memakai shared SMTP Neon (`auth@mail.myneon.app`); link butuh SMTP kustom,
   sedangkan kode OTP didukung.
10. Menghapus kategori memindahkan jadwal ke `lainnya` (tidak menghapus jadwal).
11. **Shared SMTP Neon Auth hanya untuk email autentikasi** (OTP/verifikasi/reset), bukan
    pengingat aplikasi. Email pengingat memakai provider sendiri: `BREVO_API_KEY`
    (disarankan), `RESEND_API_KEY`, atau `SMTP_URL` + `REMINDER_EMAIL_FROM`
    (lihat `.env.example`). Catatan Brevo: baik SMTP maupun API menolak IP yang tidak
    di-whitelist (`https://app.brevo.com/security/authorised_ips`), sedangkan Neon Function
    memakai IP keluar dinamis. Untuk deployment ini blokir IP Brevo sudah **dinonaktifkan**
    (API & SMTP keys) pada 2026-10-21.
12. Email pengingat hanya dikirim sekali per user per hari lewat `email_reminder_log`;
    kalau pengiriman gagal, baris log dihapus agar percobaan berikutnya bisa mengirim ulang.
    Tanpa konfigurasi email, function tetap jalan dan hanya mengirim Web Push.

---

## 11. Handover checklist

- [x] `npm install && npm test && npm run build` hijau (49 test, 2026-10-21).
- [x] Function `api` & `remind` berstatus `completed`; `neon triggers list` menunjukkan
      `daily-reminder` (cron `0 1 * * *`, run berikutnya 2026-10-22T01:00Z). `neon deploy`
      tidak dijalankan ulang karena source tidak berubah.
- [x] `GET /health` → `{"ok":true,"database":"up"}`.
- [x] Auth teruji lewat API: sign-up + sign-in + `/token` → JWT (akun uji sudah dihapus).
- [x] Tambah/ubah/hapus jadwal, catat servis, upload → signed URL (`200`) → hapus lampiran.
- [x] Kategori: 6 default ter-seed, tambah/ubah/hapus (reassign ke `lainnya`).
- [x] Ekspor Excel: workbook berisi sheet `Jadwal` + `Riwayat`.
- [ ] Ganti tema & install PWA di perangkat nyata (aset PWA produksi sudah `200`).
- [ ] Terima notifikasi push di perangkat (butuh browser ber-izin; subscribe/unsubscribe
      API sudah `201`/`200`).
- [x] Kirim email pengingat nyata: email uji Brevo masuk (2026-10-21). Cron pertama
      mengirim otomatis 2026-10-22 pukul 01:00 UTC (08.00 WIB).
- [ ] Revoke semua token lama (lihat `SESSION_CREDENTIALS.local.md`).

---

## 12. Kredensial

Nilai token/keys **tidak** ditulis di sini. Lihat:

- `SESSION_CREDENTIALS.local.md` (gitignored, hanya ada di workspace)
- `.env.local` (gitignored) untuk `DATABASE_URL`, AWS, VAPID, `BREVO_API_KEY`, dan URL Neon

> Jika file credentials hilang (sandbox dihapus), buat ulang:
> - Vercel token: https://vercel.com/account/tokens
> - Neon API key: https://console.neon.tech/app/settings/api-keys
> - VAPID: `npx web-push generate-vapid-keys`
> lalu set ulang env Vercel + `neon deploy`.

