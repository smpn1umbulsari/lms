# Kebutuhan Sistem LMS

> Daftar apa saja yang **harus ada** agar LMS (Firebase Spark + GitHub Pages) jalan.
> Dibagi: prasyarat → fungsional → non-fungsional → data → konten.

---

## 1. Prasyarat Akun & Layanan (setup sekali)

- **Akun Firebase** (project baru, plan **Spark / gratis**).
- **Firebase Auth** aktif — provider: Email/Password (utama) + Google (opsional).
- **Firestore** aktif (mode production + rules).
- **App Check** reCAPTCHA v3 (mode monitor dulu).
- **Akun GitHub** + repo (public/private) + **GitHub Pages** aktif.
- **GitHub Actions** (workflow build & deploy Vite).
- **Channel YouTube** (video unlisted) — bukan Cloud Storage.
- **Domain Pages** (`username.github.io`) ditambahkan ke Auth → Authorized domains.
- **Node.js + npm** di mesin dev (build Vite).

---

## 2. Kebutuhan Fungsional

### 2.1 Auth & Pengguna
- Daftar akun (email/password) + **verifikasi kode kelas** saat daftar.
- Login / logout / reset sandi.
- Profil siswa: nama, kelas.
- Penanda admin via dokumen `admins/{uid}`.

### 2.2 Kursus & Pembelajaran
- Daftar kursus & modul.
- Pemutar video YouTube (unlisted).
- Tombol "selesai" per modul.
- Modul terkunci berurutan (harus selesai modul N untuk buka N+1).
- Progress tersimpan per siswa (`progress/{uid}`).

### 2.3 Kuis Latihan (instan)
- Soal + kunci dimuat ke browser, dinilai lokal (tanpa tulis server per jawaban).
- XP ditulis **sekali per sesi** ke `progress`.
- **Tidak** dipakai untuk nilai resmi.

### 2.4 Ujian Resmi
- Mulai ujian → tulis `starts` (server timestamp).
- Muat soal (tanpa kunci) — dibatasi Rules: hanya jika `starts` ada & dalam jadwal.
- Timer klien; batas waktu sebenarnya dijaga Rules.
- Kirim jawaban → tulis `attempts` **sekali**, **per `questionId`**.
- Toleransi keterlambatan **90 detik**.
- Acak urutan soal per siswa (seed = uid), jawaban per `questionId`.
- Jadwal buka/tutup (`openAt`, `closeAt`) per kuis.

### 2.5 Penilaian (Admin)
- Buat/edit kuis + kunci (`quizKeys`, admin-only).
- Atur jadwal, durasi, jumlah soal.
- "Nilai semua" → hitung dengan `quizKeys` → `writeBatch` `results`.
- Update `leaderboard/current` (dokumen agregat) setelah grading.
- Rekap nilai + ekspor CSV.

### 2.6 Gamifikasi
- XP, badge, streak dari aktivitas.
- Leaderboard dibaca dari `leaderboard/current` (bukan query `results`).
- XP = hiburan; nilai resmi hanya dari `results`.

### 2.7 Sertifikat
- Generate PDF (jsPDF) di browser.
- Nomor verifikasi unik.
- Halaman verifikasi publik (baca `certificates/{id}` per-ID).

---

## 3. Kebutuhan Non-Fungsional

- **Biaya $0** — tanpa Cloud Functions, tanpa Cloud Storage, tanpa Blaze.
- **Kuota aman** — cache konten statis (`localStorage` + `version`), soal 1 dokumen, nol realtime listener, XP 1 write/sesi, leaderboard agregat.
- **Puncak 900 concurrent** — Firestore auto-scale; uji 30 → 900 sebelum produksi.
- **Keamanan** — `quizKeys` admin-only; siswa hanya baca/tulis miliknya; waktu dijaga Rules (`request.time`).
- **Anti-kehilangan data** — `attempts` sekali tulis; toleransi 90s; **tanpa offline persistence untuk attempts** (write telat ditolak).
- **Responsif** — mobile-first (siswa pakai HP).
- **SPA routing** — `public/404.html` fallback (deep-link jalan).
- **Aksesibilitas dasar** — kontras, label form, keyboard.

---

## 4. Kebutuhan Data (Firestore)

```
users/{uid}            nama, kelas
admins/{uid}           penanda admin
courses/{id}           judul, modul[]
quizzes/{id}           questions[] (tanpa kunci), durasi, openAt, closeAt, version
quizKeys/{id}          kunci (admin only)
starts/{uid_quiz}      startedAt
attempts/{uid_quiz}    jawaban per questionId (sekali tulis)
results/{uid_quiz}     skor (admin)
progress/{uid}         modul selesai, XP, badge
leaderboard/current    agregat skor (admin)
certificates/{id}      nomor, uid, course
```

Field tambahan wajib: **`version`** di `courses`/`quizzes` (untuk cache invalidation).

---

## 5. Konten yang Harus Disiapkan (bukan kode)

- **Daftar kursus & modul** per mapel.
- **Video** per modul (YouTube unlisted).
- **Bank soal ujian** per mapel (soal + kunci terpisah) — min. 50 soal/mapel.
- **Soal kuis latihan** (dengan kunci, boleh diintip).
- **Daftar kelas + kode kelas** (untuk registrasi).
- **Daftar admin/guru** (UID untuk `admins/`).
- **Aturan penilaian** (bobot, skala, KKM bila perlu).

---

## 6. Kebutuhan Pengujian

- Firebase Emulator untuk Rules:
  - siswa tak bisa baca `quizKeys`;
  - tak bisa tulis `attempts` dua kali;
  - tak bisa kirim lewat batas waktu;
  - rule `get()` terhitung read.
- Uji XP 1-write/sesi & leaderboard agregat.
- Uji beban 20–30 siswa → eskalasi 900.
- Simulasi hitung kuota satu hari ujian penuh (6 mapel).

---

## 7. Di Luar Cakupan (sengaja tidak dibuat)

- Nilai instan untuk ujian resmi (butuh Blaze + Functions).
- Upload file/gambar (butuh Cloud Storage) — video pakai YouTube.
- Notifikasi push / email transaksional otomatis (butuh server).
- Chat / forum.
- Multi-sekolah / multi-tenant.

Tambahkan hanya kalau kebutuhan nyata muncul (naik ke Blaze).
