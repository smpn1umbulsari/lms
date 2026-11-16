# Spesifikasi Teknis LMS (Firebase Spark + GitHub Pages)

> Versi 2 — hasil diskusi & review. Perubahan dari draft awal ditandai **🆕**.
> Target: 1000+ siswa, biaya **$0**, tanpa Cloud Functions & Cloud Storage.

---

## 1. Tujuan dan Batasan

- 1000 siswa (real: 6 mapel/hari, 300 siswa/mapel, 3 mapel bersamaan → 1.800 sesi/hari, puncak 900 concurrent).
- Biaya **$0**: Firebase **Spark** + **GitHub Pages**.
- **Tanpa** Cloud Functions, **tanpa** Cloud Storage.
- Ujian resmi dinilai guru (batch); kuis latihan dinilai instan di browser.
- Kuota harian Spark: **50.000 baca**, **20.000 tulis**, 20.000 delete, 1 GiB storage, 10 GiB/bulan egress.
- 🆕 **Tanpa offline persistence untuk `attempts`** (lihat §5).

---

## 2. Arsitektur

| Lapisan | Teknologi |
|---|---|
| Frontend | Vite + JavaScript (atau React), Firebase SDK modular |
| Hosting | GitHub Pages + GitHub Actions |
| Auth | Firebase Auth (email/password atau Google) |
| Database | Firestore |
| Video | YouTube unlisted |
| Sertifikat | jsPDF di browser |

🆕 Vite SPA di Pages **wajib `public/404.html` fallback** (copy `index.html`) atau hash-router — tanpa ini deep-link mati.
🆕 **App Check reCAPTCHA v3** (gratis di Spark): aktifkan **monitor dulu**, enforce setelah terbukti tak ada false-positive.

---

## 3. Peran Pengguna

- **Siswa**: belajar, kuis latihan, ujian resmi, unduh sertifikat.
- **Guru/admin**: dicek lewat dokumen `admins/{uid}` — buat kuis, jadwal, nilai massal, rekap, ekspor CSV.

---

## 4. Struktur Firestore

```
users/{uid}            nama, kelas
admins/{uid}           penanda admin
courses/{id}           judul, modul[]            (1 dokumen)
quizzes/{id}           soal TANPA kunci, durasi, openAt, closeAt
quizKeys/{id}          kunci jawaban (admin only)
starts/{uid_quiz}      startedAt (server timestamp)
attempts/{uid_quiz}    jawaban per questionId (tulis sekali)
results/{uid_quiz}     skor (ditulis admin)
progress/{uid}         modul selesai, XP, badge   (1 dokumen)
leaderboard/current    🆕 agregat skor (1 dokumen, admin)
certificates/{id}      nomor verifikasi, uid, course
```

🆕 **`leaderboard/current`** = satu dokumen agregat yang ditulis admin sekali setelah grading. Siswa membaca 1 dokumen ini, **bukan** query langsung ke `results`.

---

## 5. Security Rules (prinsip)

- `users`, `progress`: siswa baca/tulis miliknya sendiri.
- `quizKeys`: **hanya admin**.
- `quizzes`: baca hanya jika `get(starts/{uid_quiz})` ada **dan** `request.time` dalam `[openAt, closeAt]`.
  - ⚠️ `get()` di Rules = **1 read berbayar** tiap muat soal.
- `starts`: siswa buat sekali, tidak bisa diubah, `startedAt == request.time`.
- `attempts`: buat sekali, tidak bisa diubah, hanya jika `request.time <= starts.startedAt + durasi + toleransi`.
  - 🆕 **toleransi = 90 detik** (wifi sekolah).
- `results`: baca milik sendiri, **tulis hanya admin**.
- 🆕 `leaderboard/current`: baca semua user login, **tulis hanya admin**.
- `certificates`: baca publik per-ID (verifikasi), tulis hanya admin.

---

## 6. Alur Ujian Resmi

1. Siswa klik mulai → tulis `starts`.
2. Muat soal → timer tampil di klien, batas sebenarnya dijaga Rules.
3. Kirim jawaban → tulis `attempts` (sekali), **per `questionId`**.
4. Admin klik "Nilai semua" → hitung dengan `quizKeys` → `writeBatch` `results`.
5. 🆕 Admin tulis ulang `leaderboard/current` (1 write).
6. Siswa lihat nilai → unduh sertifikat PDF.

---

## 7. Alur Latihan (instan)

Soal + kunci dimuat ke browser, dinilai lokal. Tidak dipakai untuk nilai resmi (kunci bisa diintip).

🆕 **XP ditulis SEKALI di akhir sesi kuis** (satu `setDoc` ke `progress`), **bukan per jawaban**. Tulis per-jawaban = 20 write/siswa → 20k/hari jebol.

---

## 8. Fitur per Modul

- **Auth**: daftar dengan kode kelas, login, reset sandi.
- **Kursus**: daftar modul, video YouTube, tombol selesai, modul terkunci berurutan.
- **Gamifikasi**: XP, badge, streak. 🆕 **Leaderboard dibaca dari `leaderboard/current`**, bukan query `results`.
- **Admin**: buat kuis, jadwal, nilai massal, rekap, ekspor CSV.
- **Sertifikat**: jsPDF, nomor unik, halaman verifikasi publik.

---

## 9. Anggaran Kuota

### Ujian resmi — 1 mapel, 300 siswa
```
starts + attempts : 300 × 2 = 600 write
muat soal (+rule-get) : 300 × 2 = 600 read
grading (baca attempts + tulis results) : 300 + 300
leaderboard (admin tulis 1×, siswa baca 1×) : 1 write + 300 read
```

### Ujian penuh — 6 mapel × 300 = 1.800 sesi/hari
```
Write : starts+attempts 3.600 + results 1.800 + leaderboard 6 = ~5.400  → 27% dari 20k ✅
Read  : muat soal 3.600 + grading 1.800 + leaderboard 1.800       = ~7.200  → 14% dari 50k ✅
```

### Browsing harian (di luar ujian) — penentu utama
```
900 unik,  TANPA cache : 900 × 3 buka × 8 read = 21.600
1.800 unik, TANPA cache: 1.800 × 3 × 8        = 43.200
900 unik,  DENGAN cache: ~2.700
1.800 unik, DENGAN cache: ~5.400
```

### Total hari ujian + browsing
```
900 unik,  TANPA cache : 7.200 + 21.600 = 28.800  → 58%  (lolos, tipis)
1.800 unik, TANPA cache: 7.200 + 43.200 = 50.400  → 101% (JEBOL)
900 unik,  DENGAN cache: 7.200 + ~2.700 = ~9.900  → 20%  (santai)
1.800 unik, DENGAN cache: 7.200 + ~5.400 = ~12.600 → 25%  (santai)
```

### Aturan hemat (WAJIB)
1. **Cache konten statis** (`courses`, soal) di `localStorage` + field `version` → potong read terbesar.
2. **Soal ujian = 1 dokumen** (`quizzes/{id}.questions[]`), bukan subcollection per-soal.
3. **XP = 1 write per sesi**, bukan per jawaban.
4. **Leaderboard = 1 dokumen agregat**, bukan query `results`.
5. **Nol realtime listener** — pakai `getDoc`/`getDocs` sekali, **bukan `onSnapshot`**.
6. **Grading batch** — baca `attempts` sekali, hitung di memori, `writeBatch` results.
7. **`progress` dibaca sekali/sesi**, cache di memori.

---

## 10. Randomisasi Soal

- Acak **urutan** 50 soal per siswa: **gratis kuota**.
  - Soal tetap **1 dokumen** `quizzes/{id}.questions[]`.
  - Klien mengacak urutan: `shuffle(questions)` dengan seed = `uid` (konsisten saat refresh).
  - Server tidak menyimpan salinan per siswa — 1 dokumen melayani 900 siswa.
- **Jawaban disimpan per `questionId`**, BUKAN per posisi: `attempts/{uid_quiz} = { q_101: "B", q_207: "A", ... }`.
  - Menyimpan per posisi (`answers[0], answers[1]`) = grading kacau saat urutan diacak.
- Acak **pilihan jawaban** (A/B/C/D): tetap gratis di klien; `quizKeys` simpan jawaban benar sebagai **nilai/teks**, bukan huruf posisi.
- **Hindari**: soal 1 dokumen/soal (50 read/siswa → jebol); subset soal per siswa disimpan terpisah (pakai bank besar di-cache + pilih subset by seed).
- **Catatan**: acak urutan saja tidak mencegah nyontek sebangku; butuh subset/variasi parameter untuk itu (keputusan ujian, bukan biaya kuota).

---

## 11. Deployment

- Repo GitHub → build Vite → deploy ke Pages lewat GitHub Actions.
- Tambahkan domain GitHub Pages (`username.github.io`) di Firebase Auth → Authorized domains.
- 🆕 Aktifkan **App Check reCAPTCHA v3** (mode monitor dulu).
- 🆕 Sediakan `public/404.html` (copy `index.html`) untuk SPA fallback.

---

## 12. Pengujian Sebelum Produksi

- **Firebase Emulator** untuk Rules:
  - siswa tidak bisa baca `quizKeys`;
  - tidak bisa tulis `attempts` dua kali;
  - tidak bisa kirim lewat batas waktu (`request.time > startedAt + durasi + toleransi`);
  - rule `get()` terhitung read.
- 🆕 Uji **XP 1-write/sesi** dan **leaderboard dari dokumen agregat**.
- Uji beban kecil 20–30 siswa, lalu eskalasi ke 900 concurrent sebelum produksi.
- Simulasi hitung kuota satu ujian penuh (6 mapel).

---

## 13. Risiko dan Mitigasi

| Risiko | Mitigasi |
|---|---|
| Kuota harian habis | Ujian bergelombang per kelas; cache konten; soal 1 dokumen |
| 🆕 Leaderboard query langsung | Wajib dokumen agregat `leaderboard/current` |
| 🆕 XP per-jawaban | Batch 1 write/sesi |
| 🆕 Reset kuota = tengah malam Pacific (~15:00 WIB) | Jadwalkan ujian sadar batas ini |
| Nilai tidak instan | Admin nilai tepat setelah ujian |
| XP bisa dimanipulasi | Anggap hiburan; nilai resmi dari `results` |
| Rules salah | Wajib uji Emulator |
| Perlu nilai instan | Titik upgrade ke Blaze + Cloud Functions |

---

## 14. Fase Pengerjaan

1. Setup Firebase, Auth, deploy Pages (+ `404.html` fallback).
2. Kursus, video, progress (+ cache konten statis).
3. Rules + alur `starts → attempts` (+ Emulator test).
4. Halaman admin + penilaian massal + leaderboard agregat.
5. Sertifikat + gamifikasi.

---

## 15. Catatan Istilah

- **"Unik"** dalam anggaran kuota = **jumlah akun siswa berbeda yang aktif hari itu** (900 vs 1.800), **bukan** soal acak.
- **Puncak 900 concurrent** = pertanyaan koneksi/latensi, **bukan kuota**; Firestore auto-scale, Spark sanggup (uji 30 → 900).
