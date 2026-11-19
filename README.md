# SITURI LMS — SMPN 1 Umbulsari

LMS pembelajaran, penugasan, dan asesmen CBT SMPN 1 Umbulsari berbasis **Firebase Spark** (Auth Email/Password + Firestore) dan **Firebase Hosting** (`https://lms-situri.web.app`). Tanpa backend server/Cloud Functions dan tanpa bundler build step.

## Fitur Utama
- **Satu Pintu Masuk (`docs/index.html`)**: login NIS siswa (otomatis dipetakan ke `@smpn1umbulsari.sch.id`) atau email guru/admin; akun `admins` otomatis diarahkan ke `docs/admin.html`.
- **RBAC Ketat (`firestore.rules`)**: pemisahan `role: "admin"` (Admin Utama / Operator) dan `role: "guru"` (Guru Pengampu), ikatan NIS roster tervalidasi tanpa Anonymous Auth / pendaftaran mandiri terbuka.
- **CBT Terpadu (`docs/js/siswa/exam-*.js`)**: 4 tipe soal (PG, Benar/Salah, Menjodohkan, Uraian), timer server-window, throttle simpan 18 detik, antrean cadangan IndexedDB, serta konfirmasi server ACK (`TERKIRIM` vs `TERTUNDA`).
- **Penilaian Berbobot Tunggal (`docs/js/core/scoring.js`)**: penghitungan skor berbobot `0–100%` identik di sisi siswa dan guru, koreksi Uraian aman tanpa menimpa nilai tersimpan, paginasi kursor 50 baris, serta ekspor rekap terpadu Excel/CSV (40% Tugas + 60% Ujian).
- **Onboarding Massal (`tools/provision-accounts.mjs`)**: generator akun `PBKDF2_SHA256` siap `firebase auth:import` dan kartu login cetak.
- **Panduan Guru & Operator (`docs/panduan-guru.html`)**: buku saku siap cetak langsung dari aplikasi.

## Struktur Direktori
- `docs/` — aplikasi produksi statis (Firebase Hosting public root): shell HTML (`index.html`, `admin.html`, `panduan-guru.html`), `partials/`, `css/`, `js/`, dan `sw.js` (`situri-shell-v4`).
- `firestore.rules` & `firebase.json` — keamanan basis data, CSP, SRI vendor, dan header no-cache root/HTML.
- `tools/` — utilitas CLI: `check-size.mjs`, `check-hygiene.mjs`, `backfill-admin-roles.mjs`, `provision-accounts.mjs`.
- `spike/` & `tests/` — unit test murni, tes smoke HTML/PWA, serta suite keamanan Firestore Emulator (`rules.test.mjs`).
- `prd/` — spesifikasi aktif (`PRD LMS Interaktif v0.8`, `KONSEP Import Excel`, `requirements.md`, `spec tech.md`) dan `prd/archive/` (arsip v0.3–v0.7).

## Pengujian Lokal & CI
```bash
npm test
```
Menjalankan audit ukuran file (`check:size`), audit kebersihan/sintaks (`check:hygiene`), seluruh unit test (`scoring`, `import`, `prng`, `export`, `queue`, `attempt-queue`, `provision`), dan smoke test (`tests/smoke.test.mjs`).

Untuk menjalankan tes Firestore Security Rules (emulator lokal, membutuhkan Java 21):
```powershell
$env:JAVA_HOME = "d:\Project\LMS\.tools\jdk-21.0.13+9-jre"; $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
npx firebase emulators:exec --only firestore --project demo-lms "node spike/rules.test.mjs"
```

## Deploy Produksi
Lihat langkah lengkap dan urutan aman migrasi di [DEPLOY.md](DEPLOY.md).
