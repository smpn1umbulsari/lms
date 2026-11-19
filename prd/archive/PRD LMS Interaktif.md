# PRD LMS Interaktif

Versi 0.2 (patched) · 16 November 2026 · Pemilik produk: \[isi nama\]

> **Changelog v0.1 → v0.2:** kuota ditulis ulang per-hari (6 mapel × 300 = 1.800 sesi, puncak 900 concurrent) + komponen browsing; ditambah strategi cache konten; `leaderboard/current` dokumen agregat; `attempts` per-`questionId`; toleransi 90 detik; larangan offline persistence untuk attempts; `version` field; 404.html + App Check di deployment; kriteria uji ditambah. Selaras dengan `spec tech.md`.

## 1. Ringkasan

LMS interaktif untuk sekitar 1000 siswa dengan biaya $0. Tampilan di GitHub Pages, backend memakai Firebase paket Spark (Auth dan Firestore). Fitur utama: kursus berurutan, video, kuis latihan instan, ujian resmi yang dinilai guru, progress, gamifikasi sederhana, dan sertifikat PDF.

## 2. Latar belakang dan masalah

- Google Classroom dan Google Forms terlalu terbatas untuk pengalaman belajar yang interaktif dan branding sendiri.
- Moodle lengkap tetapi butuh VPS dan perawatan server.
- Dibutuhkan solusi gratis, tampilan bebas, dan stabil untuk ujian serentak 900 siswa (puncak).
- Masalah yang ingin diselesaikan: \[isi masalah konkret di lembaga Anda\].

## 3. Tujuan dan metrik keberhasilan

| Tujuan | Metrik | Target |
| --- | --- | --- |
| Siswa menyelesaikan kursus | Persentase penyelesaian | \[isi, mis. 70%\] |
| Ujian serentak berjalan stabil | Error saat ujian | < 1% |
| Biaya tetap nol | Tagihan bulanan | $0 |
| Guru hemat waktu | Waktu rekap nilai | \[isi\] menit per ujian |
| Adopsi | Siswa aktif mingguan | \[isi, mis. 60%\] |

## 4. Non-tujuan (di luar cakupan versi 1)

- Penilaian ujian otomatis di server (butuh Cloud Functions/Blaze)
- Unggah file siswa (butuh Cloud Storage/Blaze)
- Video hosting sendiri (memakai YouTube unlisted)
- Aplikasi mobile native (cukup web responsif)
- Pengawasan ujian ketat (kamera, lockdown browser)
- Pembayaran dan pendaftaran publik berbayar

## 5. Persona pengguna

| Persona | Kebutuhan | Kekhawatiran |
| --- | --- | --- |
| Siswa | Belajar runtut dari HP, tahu progress, dapat sertifikat | Kuota internet, login rumit |
| Guru | Buat kuis, jadwalkan ujian, rekap nilai | Rumit, nilai tidak adil |
| Admin | Kelola akun, kelas, dan akses | Keamanan data siswa |

## 6. Ruang lingkup

**MVP (wajib)**

- Login dan pendaftaran dengan kode kelas
- Halaman kursus, modul berurutan, video YouTube
- Progress per modul
- Kuis latihan instan
- Ujian resmi: mulai, kerjakan, kirim, dinilai guru
- Halaman admin: buat kuis, jadwal, nilai massal, rekap, ekspor CSV

**Tahap 2**

- XP, badge, streak, leaderboard
- Sertifikat PDF dengan nomor verifikasi publik
- Forum diskusi sederhana

**Tahap 3 (opsional)**

- Bank soal dan soal acak lebih lanjut
- Fitur AI untuk guru (pembuat soal)
- Upgrade ke Blaze untuk nilai instan

## 7. User stories

**Siswa**

- Sebagai siswa, saya ingin masuk dengan akun dan kode kelas agar langsung masuk kelas yang benar.
- Sebagai siswa, saya ingin melihat modul dan progress agar tahu apa yang harus dipelajari berikutnya.
- Sebagai siswa, saya ingin mengerjakan kuis latihan dan melihat skor langsung agar bisa belajar dari kesalahan.
- Sebagai siswa, saya ingin mengerjakan ujian dengan timer yang jelas agar adil.
- Sebagai siswa, saya ingin mengunduh sertifikat setelah lulus.

**Guru**

- Sebagai guru, saya ingin membuat kuis dan menjadwalkan ujian agar siswa hanya bisa mengerjakan pada waktunya.
- Sebagai guru, saya ingin menilai semua jawaban sekali klik agar hemat waktu.
- Sebagai guru, saya ingin mengekspor rekap nilai ke CSV.

**Admin**

- Sebagai admin, saya ingin mengatur siapa yang menjadi guru dan membuat kode kelas.

## 8. Kebutuhan fungsional

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| F-01 | Registrasi dan login (email/password atau Google), reset sandi | Wajib |
| F-02 | Bergabung ke kelas dengan kode kelas | Wajib |
| F-03 | Daftar kursus dan modul, modul terkunci berurutan | Wajib |
| F-04 | Tampilkan video YouTube dan bacaan per modul | Wajib |
| F-05 | Tombol "selesai" modul dan progress bar | Wajib |
| F-06 | Kuis latihan dengan skor instan (XP ditulis **sekali per sesi**) | Wajib |
| F-07 | Ujian resmi: catat waktu mulai di server, durasi, jadwal buka/tutup | Wajib |
| F-08 | Kirim jawaban ujian **sekali**, tidak bisa diubah, disimpan **per `questionId`** (bukan per posisi) | Wajib |
| F-09 | Acak urutan soal dan pilihan per siswa (seed = uid, di klien, **gratis kuota**) | Penting |
| F-10 | Admin: buat dan ubah kuis, atur jadwal | Wajib |
| F-11 | Admin: penilaian massal + update `leaderboard/current` | Wajib |
| F-12 | Siswa melihat hasil dan pembahasan | Wajib |
| F-13 | Ekspor rekap nilai ke CSV | Wajib |
| F-14 | XP, badge, streak (XP = 1 write/sesi) | Penting |
| F-15 | Leaderboard dibaca dari `leaderboard/current` (dokumen agregat), **bukan** query `results` | Opsional |
| F-16 | Sertifikat PDF (jsPDF) dengan nomor verifikasi | Penting |
| F-17 | Halaman verifikasi sertifikat publik | Penting |
| F-18 | Pengelolaan peran admin/guru | Wajib |

## 9. Kebutuhan non-fungsional

| Aspek | Persyaratan |
| --- | --- |
| Kinerja | Halaman utama termuat < 3 detik di jaringan 4G |
| Kapasitas | Mendukung **900 siswa concurrent** (3 mapel × 300); 1.800 sesi ujian/hari |
| Ketersediaan | Mengikuti layanan Google/GitHub, tanpa SLA sendiri |
| Kompatibilitas | Chrome, Safari, Firefox versi terbaru; layar HP 360 px ke atas |
| Aksesibilitas | Kontras cukup, teks bisa dibesarkan, navigasi keyboard |
| Bahasa | Bahasa Indonesia (opsi Inggris di tahap lanjut) |
| Biaya | Tetap di paket gratis |
| Routing | SPA pakai `public/404.html` fallback (deep-link jalan) |

## 10. Alur pengguna utama

**Belajar** Daftar → masukkan kode kelas → pilih kursus → buka modul → tonton video → tandai selesai → modul berikutnya terbuka.

**Ujian resmi** Siswa klik mulai (dokumen `starts` ditulis dengan waktu server) → soal dimuat dan timer berjalan → siswa kirim jawaban (`attempts`, satu kali, per `questionId`) → guru klik "Nilai semua" → hasil (`results`) terbit + `leaderboard/current` diperbarui → siswa lihat nilai dan unduh sertifikat.

**Kuis latihan** Buka kuis → jawab → skor instan di browser → XP ditulis sekali di akhir sesi.

## 11. Arsitektur dan data

| Lapisan | Teknologi |
| --- | --- |
| Frontend | Vite + JavaScript (atau React), Firebase SDK |
| Hosting | GitHub Pages + GitHub Actions |
| Auth | Firebase Authentication |
| Database | Firestore |
| Video | YouTube unlisted |
| Sertifikat | jsPDF di browser |

**Koleksi Firestore**

- `users/{uid}`: nama, kelas
- `admins/{uid}`: penanda admin/guru
- `courses/{id}`: judul dan daftar modul (1 dokumen) + **field `version`** (cache invalidation)
- `quizzes/{id}`: soal tanpa kunci (`questions[]` 1 dokumen), durasi, jadwal + **field `version`**
- `quizKeys/{id}`: kunci jawaban (hanya admin)
- `starts/{uid_quiz}`: waktu mulai (server timestamp)
- `attempts/{uid_quiz}`: jawaban **per `questionId`** (tulis sekali)
- `results/{uid_quiz}`: skor (ditulis admin)
- `progress/{uid}`: modul selesai, XP, badge
- `leaderboard/current`: **agregat skor** (1 dokumen, ditulis admin) — dibaca semua user login
- `certificates/{id}`: nomor verifikasi, uid, kursus

**Cache konten statis (WAJIB):** `courses` dan soal (`quizzes`) bersifat immutable setelah publish. Simpan di `localStorage` + cek `version`; muat ulang hanya jika `version` berubah. Ini pemotong read terbesar (browsing harian).

## 12. Keamanan dan privasi

- Security Rules sebagai garis pertahanan utama: siswa hanya membaca data miliknya, kunci jawaban hanya bisa dibaca admin, `attempts` tidak bisa diubah, batas waktu dijaga lewat `request.time`.
- **Toleransi keterlambatan 90 detik:** `attempts` diterima jika `request.time <= starts.startedAt + durasi + 90s` (wifi sekolah).
- **Larangan offline persistence untuk `attempts`:** jangan aktifkan `enableIndexedDbPersistence` untuk alur ujian — write yang di-flush setelah deadline ditolak Rules = jawaban hilang diam-diam.
- `leaderboard/current` ditulis **hanya admin**; siswa tidak query langsung ke `results`.
- Konfigurasi Firebase di HTML bersifat publik, keamanan ada di Rules dan App Check.
- Kuis latihan dan XP di sisi klien bisa dimanipulasi, tidak dipakai untuk nilai resmi.
- Data pribadi minimal: nama, kelas, email. Tentukan kebijakan retensi dan penghapusan data.
- Persetujuan orang tua jika ada siswa di bawah umur: \[isi sesuai kebijakan lembaga\].
- Batasi pengelolaan peran admin hanya lewat Firebase Console.

## 13. Anggaran kuota (Spark)

Batas gratis harian Firestore: 50.000 baca, 20.000 tulis, 20.000 delete.

**Beban ujian — 6 mapel × 300 = 1.800 sesi/hari, puncak 900 concurrent:**

| Operasi | Tulis | Baca |
| --- | --- | --- |
| starts + attempts (1.800 × 2) | 3.600 | — |
| muat soal (1 dok + 1 rule-get × 1.800) | — | 3.600 |
| penilaian massal (baca attempts + tulis results) | 1.800 | 1.800 |
| leaderboard (admin tulis 1×/mapel, siswa baca 1×) | 6 | 1.800 |
| **Subtotal ujian** | **~5.400** | **~7.200** |

**Beban browsing harian (penentu utama) — WAJIB pakai cache:**

| Skenario | Baca |
| --- | --- |
| 900 unik, tanpa cache (900 × 3 buka × 8) | 21.600 |
| 1.800 unik, tanpa cache | 43.200 |
| 900 unik, dengan cache | ~2.700 |
| 1.800 unik, dengan cache | ~5.400 |

**Total hari ujian + browsing:**
- 1.800 unik, **tanpa cache**: 7.200 + 43.200 = **50.400 → JEBOL (101%)**
- 1.800 unik, **dengan cache**: 7.200 + 5.400 = **~12.600 → aman (25%)**
- 900 unik, dengan cache: 7.200 + 2.700 = **~9.900 → aman (20%)**

**Aturan hemat (WAJIB):**
1. Cache konten statis (`courses`, soal) di `localStorage` + `version` → potong read terbesar.
2. Soal ujian = 1 dokumen (`quizzes/{id}.questions[]`), bukan subcollection per-soal.
3. XP = 1 write per sesi, bukan per jawaban.
4. Leaderboard = dokumen agregat `leaderboard/current`, bukan query `results`.
5. Nol realtime listener — `getDoc`/`getDocs` sekali, bukan `onSnapshot`.
6. Grading batch — baca `attempts` sekali, hitung di memori, `writeBatch` results.
7. `progress` dibaca sekali/sesi, cache di memori.

Jika kuota habis, Spark berhenti merespons sampai reset harian (tengah malam Pacific ≈ 15:00 WIB) dan tidak menagih. Verifikasi angka terbaru di firebase.google.com/pricing.

## 14. UX dan UI

- Mobile first, tombol besar, navigasi sederhana.
- Halaman: beranda, daftar kursus, halaman modul, kuis/ujian, hasil, profil, sertifikat, admin.
- Panduan gaya: \[logo, warna utama, font, tone bahasa\].
- Wireframe: \[tautan atau lampirkan\].
- Status jelas: timer terlihat, peringatan sebelum kirim, konfirmasi setelah kirim.

## 15. Analitik dan pemantauan

- Pantau penggunaan kuota Firestore di Firebase Console setiap hari saat ujian.
- Metrik produk: siswa aktif, penyelesaian modul, rata-rata skor, tingkat pengerjaan ujian.
- Log kesalahan klien (opsional, mis. Firebase Analytics).

## 16. Rilis dan roadmap

| Fase | Isi | Target |
| --- | --- | --- |
| 1. Fondasi | Project Firebase, Auth, kode kelas, deploy Pages (+ `404.html`) | \[tanggal\] |
| 2. Konten | Kursus, video, progress modul (+ cache statis) | \[tanggal\] |
| 3. Kuis aman | Alur starts → attempts, Security Rules, uji Emulator | \[tanggal\] |
| 4. Admin | Penilaian massal, rekap, ekspor CSV, `leaderboard/current` | \[tanggal\] |
| 5. Pengayaan | Sertifikat, XP, badge, leaderboard | \[tanggal\] |
| Pilot | 20-30 siswa, lalu eskalasi 30 → 900 concurrent | \[tanggal\] |
| Peluncuran | 1000 siswa, ujian bergelombang per kelas | \[tanggal\] |

## 17. Pengujian dan kriteria penerimaan

- Firebase Emulator: siswa tidak bisa membaca `quizKeys`, tidak bisa menulis `attempts` dua kali, **tidak bisa mengirim setelah `startedAt + durasi + 90s`**, tidak bisa menulis `results`, tidak bisa menulis `leaderboard/current`.
- Uji **XP 1-write/sesi** dan **leaderboard dari dokumen agregat** (bukan query `results`).
- Uji **cache**: ubah `version` → konten termuat ulang; tanpa ubah → 0 read.
- Uji fungsi: alur belajar, kuis, ujian, penilaian, sertifikat.
- Uji perangkat: HP Android dan iOS, beberapa browser.
- Uji beban kecil dan simulasi hitung kuota satu hari ujian penuh (6 mapel).
- Rilis dianggap siap jika semua fitur Wajib lulus uji, pilot berjalan tanpa kehilangan data, dan **perkiraan kuota satu hari ujian penuh (dengan cache) di bawah 60% batas harian**.

## 18. Asumsi, dependensi, dan risiko

**Asumsi**

- Semua siswa punya perangkat dan internet saat ujian.
- Guru bersedia menilai massal setelah ujian.

**Dependensi**

- Firebase (Spark), GitHub Pages, YouTube

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Kuota harian habis | Layanan berhenti sementara | Ujian bergelombang per kelas, cache konten, soal 1 dokumen, pantau kuota |
| Leaderboard query langsung | Read jebol | Wajib dokumen agregat `leaderboard/current` |
| XP per-jawaban | Write jebol | Batch 1 write/sesi |
| Nilai tidak instan | Ketidakpuasan siswa | Jadwalkan penilaian segera setelah ujian |
| Security Rules salah | Kunci bocor atau data bisa diubah | Wajib uji Emulator |
| XP bisa dimanipulasi | Leaderboard tidak adil | Leaderboard resmi dari `results` (via agregat) |
| Kebijakan Firebase berubah | Fitur gratis berkurang | Cek berkala, siapkan jalur upgrade |
| Kecurangan ujian | Nilai tidak sahih | Soal diacak (seed uid), kunci tidak dikirim ke klien, batas waktu via Rules `request.time` (timer klien hanya tampilan) |
| Reset kuota = 15:00 WIB | Ujian sore straddle reset | Jadwalkan ujian sadar batas ini |

## 19. Pertanyaan terbuka

- Siapa yang mengelola akun siswa dan kode kelas?
- Apakah login wajib memakai akun Google sekolah?
- ~~Berapa durasi dan jumlah soal ujian tipikal?~~ → **Asumsi awal: 50 soal/mapel, ~90 menit/mapel** (dari analisis; sesuaikan bila perlu).
- Apakah nilai wajib instan? Jika ya, kapan upgrade ke Blaze?
- Kebijakan data siswa di bawah umur dan retensi data?

## 20. Lampiran

- Spesifikasi teknis lengkap dan Security Rules (`spec tech.md`)
- Wireframe dan panduan gaya
- Contoh format CSV rekap nilai
- Template sertifikat
