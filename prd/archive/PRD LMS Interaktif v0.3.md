# PRD LMS Interaktif

Versi 0.3 (patched) - 16 November 2026 - Pemilik produk: [isi nama]

> **Changelog v0.2 -> v0.3:**
> 1. **Model data & randomisasi (Seksi 8, 11):** ditambah koleksi `classes/{code}` (`nama`, `mapel`, `anggota[]`); ditambah field `quizId` + `attemptNo` pada `attempts` dan `results`; ditambah snapshot `quizVersion` + `duration` + `keyVersion` pada `starts`; jawaban di `attempts` dan kunci di `quizKeys` wajib memakai `optionId` stabil (bukan huruf posisi A/B/C/D); pengacakan soal/opsi memakai PRNG deterministik `seed = hash(uid + quizId + quizVersion)` dan hasil shuffle disimpan di `starts`.
> 2. **Deadline ganda & ketahanan kirim (Seksi 12, 14):** diseragamkan `closeAt = openAt + durasi + toleransi 90s`; baca soal wajib `request.time in [openAt, closeAt]` DAN `starts` ada; tulis `attempts` wajib `request.time <= startedAt + durasi + 90s` ditambah grace write 5 menit untuk retry jaringan; UI wajib menampilkan status terkirim/tidak secara eksplisit, retry backoff 3x, dan menyimpan draft jawaban di `localStorage`.
> 3. **Dua instance Firestore (Seksi 11, 12):** karena offline persistence bersifat global per instance, wajib memisahkan `dbApp` (`persistentLocalCache` untuk kursus/modul) dan `dbExam` (memory cache / tanpa persist, khusus `starts` dan `attempts`).
> 4. **Immutability soal, attempts, dan results (Seksi 11, 12):** `quizKeys` tidak boleh diedit setelah ada `starts` (koreksi wajib membuat versi baru `quizzes/{id}_v2`, bukan menimpa); `attempts` bersifat create-only dan `results` bersifat create-only (re-grading = `revision` / `_v2`); pembuatan ulang sesi/attempts hanya diizinkan bila berumur `< 30 detik` dan belum ada `attempts`.
> 5. **Aturan batch penilaian & access-call (Seksi 12, 13):** batas `writeBatch` maks 500 write/batch dan maks 20 access-call per batched write (10 untuk single-doc); dikoreksi bahwa `get()` ke dokumen admin yang sama di-cache per request (= 1 access-call, bukan 300), sehingga risiko nyata hanya muncul bila Rules memanggil `get()` ke dokumen berbeda per item (mis. `get(starts/{uid_quiz})` per result).
> 6. **Leaderboard bebas konflik (Seksi 8, 11, 13):** memakai `leaderboard/{quizId}` per mapel ATAU menulis `leaderboard/current` sekali setelah semua mapel selesai dinilai (menghindari *last-write-wins*), serta hanya mengagregasi `results` resmi (bukan XP/badge).
> 7. **Transparansi kuota, DST, dan TTL (Seksi 11, 13, 18):** tabel Seksi 13 dihitung ulang secara transparan dengan label *"estimasi; ukur nyata via Emulator"* untuk 1.000 akun unik (1.800 sesi, ~1,8 sesi/siswa) dalam dua skenario (cache-on dan cache-off); waktu reset kuota disesuaikan DST (`14:00-15:00 WIB`, larangan mulai sesi > 60 menit sebelum reset); retensi storage 1 GiB memakai field `expireAt` + Firestore TTL policy di `starts`/`attempts` (gratis di Spark, namun delete tetap memotong kuota 20.000/hari).
> 8. **Koreksi App Check, Batas Auth Spark, GitHub Pages, dan Kriteria Uji (Seksi 9, 12, 13, 17, 18):** reCAPTCHA v3 (Essentials) dan Enterprise sama-sama dibatasi 10.000 assessments/bulan gratis (tidak cukup untuk ~60.000/bulan) sehingga App Check disetel mode monitor/opsional dan keamanan utama bersandar pada Firestore Rules + Auth; ditambah seksi Batas Firebase Auth Spark beserta rencana pembuatan akun bertahap; ditambah spesifikasi GitHub Pages (`base: '/nama-repo/'`, `404.html`, timeout 10 menit, soft limit 10 build/jam); kriteria rilis diperketat menjadi uji TANPA cache `<= 60%` read (`<= 30.000`) dan `<= 60%` write (`<= 12.000`) dengan definisi error terukur `< 1%`.
>
> **Changelog v0.1 -> v0.2:** kuota ditulis ulang per-hari (6 mapel x 300 = 1.800 sesi, puncak 900 concurrent) + komponen browsing; ditambah strategi cache konten; `leaderboard/current` dokumen agregat; `attempts` per-`questionId`; toleransi 90 detik; larangan offline persistence untuk attempts; `version` field; 404.html + App Check di deployment; kriteria uji ditambah. Selaras dengan `spec tech.md`.

## 1. Ringkasan

LMS interaktif untuk 1.000 akun siswa unik dengan biaya $0 (beban puncak ujian: 6 mapel/hari, 300 siswa/mapel, 3 mapel bersamaan = 900 concurrent, total 1.800 sesi ujian/hari atau ~1,8 sesi/siswa). Tampilan di-host di GitHub Pages, backend memakai Firebase paket Spark (Authentication dan Firestore) tanpa Cloud Functions dan tanpa Cloud Storage. Fitur utama: kursus berurutan, video, kuis latihan instan, ujian resmi yang dinilai guru secara massal, pelacakan progress, serta pengayaan Tahap 2 berupa gamifikasi sederhana dan sertifikat PDF.

## 2. Latar belakang dan masalah

- Google Classroom dan Google Forms terlalu terbatas untuk pengalaman belajar yang interaktif dan branding sendiri.
- Moodle lengkap tetapi butuh VPS dan perawatan server.
- Dibutuhkan solusi gratis, tampilan bebas, dan stabil untuk ujian serentak 900 siswa (puncak).
- Masalah yang ingin diselesaikan: [isi masalah konkret di lembaga Anda].

## 3. Tujuan dan metrik keberhasilan

| Tujuan | Metrik | Target |
| --- | --- | --- |
| Siswa menyelesaikan kursus | Persentase penyelesaian | [isi, mis. 70%] |
| Ujian serentak berjalan stabil | Error saat ujian (sesi gagal muat soal atau gagal kirim jawaban / total sesi ujian) | < 1% |
| Biaya tetap nol | Tagihan bulanan | $0 |
| Guru hemat waktu | Waktu rekap nilai | [isi, mis. 10] menit per ujian |
| Adopsi | Siswa aktif mingguan | [isi, mis. 60%] |

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
| Siswa | Belajar runtut dari HP, tahu progress, dapat sertifikat | Kuota internet, login rumit, jawaban gagal terkirim |
| Guru | Buat kuis, jadwalkan ujian, rekap nilai | Rumit, nilai tidak adil, kuota habis saat ujian |
| Admin | Kelola akun, kelas, dan akses | Keamanan data siswa, batas pembuatan akun massal |

## 6. Ruang lingkup

**MVP (wajib)**

- Login dan pendaftaran terjadwal dengan kode kelas (`classes/{code}`)
- Halaman kursus, modul berurutan, video YouTube
- Progress per modul
- Kuis latihan instan (skor lokal, XP 1 write/sesi)
- Ujian resmi: mulai (`starts` dengan snapshot versi & durasi), kerjakan (acak PRNG ber-seed), kirim (`attempts` per `questionId` dengan `optionId` stabil), dinilai guru (`results`)
- Halaman admin: kelola kelas, buat kuis, jadwal, nilai massal + pembaruan dokumen agregat leaderboard, rekap, ekspor CSV

**Tahap 2**

- XP, badge, streak, antarmuka papan peringkat (leaderboard)
- Sertifikat PDF dengan nomor verifikasi publik
- Forum diskusi sederhana

**Tahap 3 (opsional)**

- Bank soal dan soal acak lebih lanjut (subset soal per siswa)
- Fitur AI untuk guru (pembuat soal)
- Opsi upgrade ke Blaze untuk nilai instan (di luar cakupan biaya $0 versi 1)

## 7. User stories

**Siswa**

- Sebagai siswa, saya ingin masuk dengan akun dan kode kelas agar langsung masuk kelas yang benar.
- Sebagai siswa, saya ingin melihat modul dan progress agar tahu apa yang harus dipelajari berikutnya.
- Sebagai siswa, saya ingin mengerjakan kuis latihan dan melihat skor langsung agar bisa belajar dari kesalahan.
- Sebagai siswa, saya ingin mengerjakan ujian dengan timer yang jelas serta status pengiriman jawaban yang pasti agar adil dan tenang.
- Sebagai siswa, saya ingin mengunduh sertifikat setelah lulus (Tahap 2).

**Guru**

- Sebagai guru, saya ingin membuat kuis dan menjadwalkan ujian agar siswa hanya bisa mengerjakan pada waktunya.
- Sebagai guru, saya ingin menilai semua jawaban sekali klik per mapel agar hemat waktu.
- Sebagai guru, saya ingin mengekspor rekap nilai ke CSV per kelas dan mata pelajaran.

**Admin**

- Sebagai admin, saya ingin mengatur siapa yang menjadi guru, mengelola dokumen kelas (`classes/{code}`), dan mengatur pembuatan akun siswa secara bertahap sesuai batas kuota layanan.

## 8. Kebutuhan fungsional

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| F-01 | Registrasi dan login (email/password atau Google), reset sandi (mengikuti batas kuota Auth Spark) | Wajib |
| F-02 | Bergabung ke kelas dengan kode kelas (`classes/{code}`) | Wajib |
| F-03 | Daftar kursus dan modul, modul terkunci berurutan | Wajib |
| F-04 | Tampilkan video YouTube dan bacaan per modul | Wajib |
| F-05 | Tombol "selesai" modul dan progress bar | Wajib |
| F-06 | Kuis latihan dengan skor instan (XP ditulis **sekali per sesi**) | Wajib |
| F-07 | Ujian resmi: catat waktu mulai di server (`starts`) beserta snapshot `quizVersion`, `duration`, `keyVersion`; jadwal buka/tutup seragam (`closeAt = openAt + durasi + 90s`) | Wajib |
| F-08 | Kirim jawaban ujian **sekali (create-only)**, tidak bisa diubah, disimpan **per `questionId`** dengan nilai **`optionId` stabil** (bukan huruf posisi A/B/C/D) | Wajib |
| F-09 | Acak urutan soal dan pilihan per siswa di klien (**gratis kuota**) memakai **PRNG deterministik** `seed = hash(uid + quizId + quizVersion)`, hasil shuffle disimpan di `starts` | Penting |
| F-10 | Admin: buat kuis dan atur jadwal; `quizKeys` tidak boleh diedit setelah ada `starts` (koreksi wajib buat versi baru `quizzes/{id}_v2`) | Wajib |
| F-11 | Admin: penilaian massal (`results` create-only) + update dokumen agregat `leaderboard/{quizId}` atau `leaderboard/current` sekali setelah semua mapel dinilai | Wajib |
| F-12 | Siswa melihat hasil dan pembahasan | Wajib |
| F-13 | Ekspor rekap nilai ke CSV (dapat difilter per kelas dan `quizId`) | Wajib |
| F-14 | XP, badge, streak (XP = 1 write/sesi) | Penting |
| F-15 | Leaderboard dibaca dari dokumen agregat (`leaderboard/{quizId}` atau `leaderboard/current`), **bukan** query `results`, dan **hanya** mengagregasi `results` resmi (bukan XP/badge) | Opsional |
| F-16 | Sertifikat PDF (jsPDF) dengan nomor verifikasi | Penting |
| F-17 | Halaman verifikasi sertifikat publik | Penting |
| F-18 | Pengelolaan peran admin/guru (`admins/{uid}`) | Wajib |
| F-19 | Admin: buat dan kelola dokumen kelas (`classes/{code}` berisi nama, mapel, dan daftar anggota) | Wajib |

## 9. Kebutuhan non-fungsional

| Aspek | Persyaratan |
| --- | --- |
| Kinerja | Halaman utama termuat < 3 detik di jaringan 4G |
| Kapasitas | Cohort 1.000 akun siswa unik; mendukung **900 siswa concurrent** (3 mapel x 300); 1.800 sesi ujian/hari |
| Ketersediaan | Mengikuti layanan Google/GitHub, tanpa SLA sendiri |
| Kompatibilitas | Chrome, Safari, Firefox versi terbaru; layar HP 360 px ke atas |
| Aksesibilitas | Kontras cukup, teks bisa dibesarkan, navigasi keyboard |
| Bahasa | Bahasa Indonesia (opsi Inggris di tahap lanjut) |
| Biaya | Tetap di paket gratis ($0) |
| Routing & Hosting | GitHub Pages dengan Vite `base: '/nama-repo/'`, SPA fallback `public/404.html` (deep-link jalan), build timeout 10 menit, soft limit 10 build/jam |

## 10. Alur pengguna utama

**Belajar (via instance `dbApp`)** Daftar/masuk terjadwal -> masukkan kode kelas (`classes/{code}`) -> pilih kursus -> buka modul -> tonton video -> tandai selesai -> modul berikutnya terbuka.

**Ujian resmi (via instance `dbExam`)** Siswa klik mulai (dokumen `starts` ditulis dengan server timestamp + snapshot `quizVersion`, `duration`, `keyVersion` + hasil shuffle dari PRNG deterministik `seed = hash(uid + quizId + quizVersion)`) -> soal dimuat (selama `request.time in [openAt, closeAt]` dan `starts` ada) dan timer berjalan -> selama pengerjaan, draft jawaban disimpan di `localStorage` -> siswa kirim jawaban (`attempts`, create-only, per `questionId` berisi `optionId` stabil, dengan retry backoff 3x dan indikator status terkirim eksplisit) -> guru klik "Nilai semua" per mapel -> hasil (`results`, create-only) terbit + `leaderboard/{quizId}` (atau `leaderboard/current` setelah semua mapel dinilai) diperbarui -> siswa lihat nilai dan unduh sertifikat.

**Kuis latihan (via instance `dbApp`)** Buka kuis -> jawab di browser -> skor instan dihitung lokal -> XP ditulis sekali di akhir sesi ke `progress/{uid}`.

## 11. Arsitektur dan data

| Lapisan | Teknologi |
| --- | --- |
| Frontend | Vite + JavaScript (atau React), Firebase SDK modular |
| Hosting | GitHub Pages (`base: '/nama-repo/'`, `public/404.html` SPA fallback; build timeout 10 menit, soft limit 10 build/jam) + GitHub Actions |
| Auth | Firebase Authentication (Email/Password dan Google Sign-In) |
| Database | Firestore (2 instance terpisah: `dbApp` dan `dbExam`) |
| Video | YouTube unlisted |
| Sertifikat | jsPDF di browser |

**Wajib Dua Instance Firestore (`dbApp` dan `dbExam`):**
Karena pengaturan offline persistence (`persistentLocalCache` / IndexedDB) bersifat **global per instance Firestore**, aplikasi wajib menginisialisasi dua instance terpisah:
1. **`dbApp` (`persistentLocalCache` aktif):** dipakai untuk pembacaan dan penulisan modul, kursus (`courses`), profil (`users`), kelas (`classes`), dan `progress`.
2. **`dbExam` (memory cache / tanpa offline persistence):** dipakai khusus untuk alur ujian resmi (`starts`, `quizzes` ujian, dan `attempts`). Hal ini mencegah write `attempts` tertahan di antrean offline lokal dan baru dikirim setelah batas waktu berakhir (yang akan ditolak oleh Security Rules).

**Koleksi Firestore**

- `users/{uid}`: `nama`, `kelas` (kode kelas), `createdAt`
- `admins/{uid}`: penanda admin/guru
- `classes/{code}`: `nama` (nama kelas), `mapel` (daftar mata pelajaran), `anggota[]` (array UID siswa anggota kelas)
- `courses/{id}`: judul dan daftar modul (1 dokumen) + **field `version`** (cache invalidation)
- `quizzes/{id}`: soal tanpa kunci (`questions[]` dalam 1 dokumen, 50 soal; tiap soal memiliki `questionId` dan tiap opsi memiliki `optionId` stabil), `duration` (durasi menit), jadwal `openAt` dan `closeAt` (`closeAt = openAt + duration + 90s`), serta **field `version`**
- `quizKeys/{id}`: kunci jawaban per `questionId` yang menyimpan **`optionId` stabil** (BUKAN huruf posisi A/B/C/D; hanya bisa dibaca admin) + **field `keyVersion`**
- `starts/{uid_quiz}`: waktu mulai (`startedAt` server timestamp), `quizId`, `attemptNo`, snapshot **`quizVersion` + `duration` + `keyVersion`**, susunan hasil shuffle dari **PRNG deterministik `seed = hash(uid + quizId + quizVersion)`**, serta field **`expireAt`** (untuk Firestore TTL)
- `attempts/{uid_quiz}`: jawaban **per `questionId`** berisi **`optionId` stabil** (create-only / tulis sekali), ditambah field **`quizId`**, **`attemptNo`**, dan **`expireAt`** (untuk Firestore TTL)
- `results/{uid_quiz}`: skor resmi (ditulis admin, **create-only**, tanpa `serverTimestamp()` di dalam batch), ditambah field **`quizId`**, **`attemptNo`**, dan `revision` (jika ada penilaian ulang/re-grading, ditulis sebagai dokumen baru `results/{uid_quiz}_v2` atau field `revision`)
- `progress/{uid}`: modul selesai, XP, badge, streak (1 dokumen)
- `leaderboard/{quizId}` atau `leaderboard/current`: **dokumen agregat skor resmi** (ditulis admin, dibaca user login). Gunakan `leaderboard/{quizId}` per mapel ATAU tulis `leaderboard/current` **sekali** setelah seluruh mapel selesai dinilai (untuk menghindari *last-write-wins*). Hanya berisi agregasi `results` resmi, **bukan** XP/badge.
- `certificates/{id}`: nomor verifikasi, `uid`, `courseId`

**Aturan Randomisasi, Kunci Jawaban, dan Immutability Soal:**
- **Jawaban dan kunci memakai `optionId` stabil:** Huruf A/B/C/D di layar hanya label urutan tampilan. Baik `attempts` maupun `quizKeys` wajib menyimpan ID opsi yang stabil (mis. `opt_a`, `opt_b`) agar pengacakan urutan opsi tidak menyebabkan kesalahan penilaian.
- **PRNG deterministik:** Pengacakan urutan soal dan opsi di klien wajib memakai algoritma PRNG ber-seed deterministik (mis. mulberry32) dengan `seed = hash(uid + quizId + quizVersion)`, bukan `Math.random()`. Hasil urutan shuffle disimpan di dokumen `starts` saat ujian dimulai agar konsisten bila halaman dimuat ulang dan dapat diverifikasi.
- **Larangan edit soal/kunci saat ujian berlangsung:** Setelah terdapat dokumen `starts` pada suatu ujian, `quizzes/{id}` dan `quizKeys/{id}` **tidak boleh diedit atau ditimpa**. Jika ada koreksi soal atau kunci, admin wajib menerbitkan dokumen versi baru (`quizzes/{id}_v2` dan `quizKeys/{id}_v2`). Snapshot `quizVersion`, `duration`, dan `keyVersion` di `starts` menjamin siswa dinilai sesuai versi soal saat ia mulai.

**Cache Konten Statis & Retensi Data (Firestore TTL):**
- **Cache konten statis (WAJIB):** `courses` dan kuis latihan bersifat immutable setelah publish; simpan di `localStorage` beserta `version` dan muat ulang isi dokumen hanya jika `version` berubah. Untuk soal ujian resmi (`quizzes`), cache hanya di memori/sesi aktif selama ujian berlangsung agar bank soal tidak tersimpan permanen di perangkat siswa (catatan: karena 1 dokumen bank soal dipakai bersama, acak urutan di klien berfungsi mencegah salin nomor urut, bukan anti-nyontek sebangku penuh).
- **Retensi penyimpanan 1 GiB (Firestore TTL):** Batas storage Spark adalah **1 GiB**. Koleksi `starts` dan `attempts` wajib menyertakan field timestamp `expireAt` dan didaftarkan pada **Firestore TTL policy** (fitur ini tersedia gratis di paket Spark tanpa Cloud Functions). Penghapusan otomatis oleh TTL **tetap memotong kuota delete harian (20.000 delete/hari)**, sehingga TTL hanya diterapkan pada `starts` dan `attempts` yang sudah kedaluwarsa (mis. 30-90 hari setelah ujian), bukan pada `results`, `users`, atau `certificates`. Aktifkan juga single-field index exemption pada field teks soal panjang di `quizzes` untuk menghemat ruang indeks.

## 12. Keamanan dan privasi

- **Security Rules dan Firebase Auth sebagai garis pertahanan utama:** siswa hanya dapat membaca/menulis data miliknya sendiri, `quizKeys` hanya bisa dibaca admin (`admins/{uid}`), dan validasi waktu dijaga di server melalui `request.time`.
- **Aturan deadline ganda yang selaras (`openAt`, `closeAt`, `startedAt`):**
  - Waktu tutup kuis diseragamkan: **`closeAt = openAt + durasi + toleransi 90 detik`** (berlaku seragam bagi semua siswa di sesi tersebut).
  - **Baca soal (`quizzes/{id}`):** diizinkan hanya jika `request.time` berada di dalam `[openAt, closeAt]` **DAN** dokumen `starts/{uid_quiz}` sudah ada.
  - **Tulis jawaban (`attempts/{uid_quiz}`):** batas waktu utama pengerjaan adalah `request.time <= starts.startedAt + durasi + 90 detik` (toleransi WiFi sekolah), ditambah **grace write 5 menit** di Security Rules khusus untuk menampung retry jaringan atas pengiriman yang dilakukan tepat sebelum waktu habis.
- **Ketahanan pengiriman di klien (UI) & larangan offline persistence ujian:**
  - Alur ujian wajib menggunakan instance `dbExam` (memory cache, tanpa `persistentLocalCache` / `enableIndexedDbPersistence`) agar tidak ada write yang tertahan di antrean offline.
  - Selama ujian, klien wajib menyimpan **draft jawaban di `localStorage`**, menjalankan **retry otomatis 3x dengan exponential backoff** saat terjadi gagal jaringan ketika kirim `attempts`, dan menampilkan **state pengiriman secara eksplisit** (`Terkirim`, `Sedang mengirim...`, atau `Gagal terkirim - klik coba lagi`).
- **Aturan `create-only` dan pembuatan ulang sesi:**
  - `attempts` bersifat **create-only** (`update` dan `delete` oleh siswa ditolak sepenuhnya).
  - `results` bersifat **create-only** oleh admin (re-grading / revisi nilai tidak boleh menimpa dokumen lama secara diam-diam, melainkan melalui field `revision` atau dokumen versi baru `results/{uid_quiz}_v2`).
  - Pembuatan ulang sesi/percobaan awal (`starts` / inisialisasi `attempts` dengan `attemptNo`) **HANYA diizinkan apabila dokumen `starts` lama berumur `< 30 detik` dan belum ada dokumen `attempts`**.
- **Aturan Batch Penilaian & Batas Access-Call Security Rules:**
  - Firestore membatasi `writeBatch` maksimal **500 write per batch** DAN membatasi evaluasi Security Rules maksimal **10 access-call (`get`/`exists`/`getAfter`) untuk single-document request** serta **20 access-call untuk multi-document request, transaksi, dan `writeBatch`**.
  - **Catatan teknis penting:** Pemanggilan `get()` atau `exists()` ke dokumen admin yang **SAMA** (mis. `admins/{uid}`) di dalam satu `writeBatch` berisi 300 dokumen `results` di-cache per request oleh Firestore, sehingga **hanya dihitung 1 access-call** (bukan 300 access-call). Risiko menembus batas 20 access-call **hanya terjadi jika Rules `results` memanggil `get()` ke dokumen yang BERBEDA untuk setiap write** (misalnya memanggil `get(starts/{uid_quiz})` per siswa saat menulis `results`).
  - Oleh karena itu, Security Rules pada `results` hanya boleh memeriksa keberadaan dokumen `admins/$(request.auth.uid)` (1 access-call per batch) dan tidak boleh memanggil `get()` ke dokumen per-siswa.
- **App Check (reCAPTCHA v3 / Enterprise) sebagai mode monitor/opsional:**
  - Berdasarkan skema harga Google Cloud (2024+), baik **reCAPTCHA v3 (Essentials)** maupun **reCAPTCHA Enterprise** sama-sama hanya memberikan kuota gratis **10.000 assessments/bulan** (tidak bebas kuota).
  - Untuk 1.000 siswa aktif dengan rata-rata ~2 refresh/hari (~60.000 assessments/bulan), kuota gratis 10.000/bulan akan terlampaui.
  - **Kebijakan PRD:** App Check disetel pada **mode monitor / opsional** (tidak dijadikan klaim pertahanan wajib), dan keamanan utama sepenuhnya bersandar pada **Firestore Security Rules + Firebase Authentication**.
- **Leaderboard dan Gamifikasi:**
  - Dokumen `leaderboard/{quizId}` atau `leaderboard/current` hanya boleh ditulis oleh admin dan **hanya mengagregasi skor resmi dari `results`**.
  - Kuis latihan dan XP di sisi klien dapat dimanipulasi sehingga tidak pernah dipakai untuk nilai resmi maupun leaderboard ujian.
- **Privasi dan Retensi Data:**
  - Data pribadi minimal: nama, kelas, email.
  - Dokumen sementara ujian (`starts` dan `attempts`) dibersihkan otomatis melalui Firestore TTL (`expireAt`), sedangkan penghapusan akun siswa mengikuti kebijakan retensi sekolah.
  - Persetujuan orang tua jika ada siswa di bawah umur: [isi sesuai kebijakan lembaga].
  - Pengelolaan peran admin (`admins/{uid}`) dibatasi hanya melalui Firebase Console.

## 13. Anggaran kuota (Spark)

Batas gratis harian Firestore Spark: **50.000 read**, **20.000 write**, **20.000 delete**, **1 GiB storage**, **10 GiB egress/bulan**.

> **Label Penting:** Seluruh angka di bawah ini adalah **estimasi; wajib diukur nyata via Firebase Emulator** sebelum rilis produksi.
> **Premis Beban:** Kohort **1.000 akun siswa unik**, beban ujian **6 mapel/hari x 300 siswa/mapel = 1.800 sesi ujian/hari (~1,8 sesi/siswa)**, puncak **900 concurrent** (3 mapel bersamaan).

### 13.1 Tabel Hitung Ulang Transparan Harian (Ujian + Browsing + Latihan)

Asumsi eksplisit yang disertakan dalam perhitungan:
1. **Rule-get muat soal:** setiap baca `quizzes/{id}` memicu 1 `get(starts/{uid_quiz})` di Security Rules (= 1 dok + 1 rule-get = 2 read/sesi).
2. **Rule-get tulis `attempts`:** saat siswa menulis `attempts/{uid_quiz}`, Rules memvalidasi waktu mulai dan durasi. Karena `duration` sudah di-snapshot di `starts/{uid_quiz}`, Rules cukup membaca 1 dokumen `starts` (= 1.800 read). Jika Rules juga membaca `quizzes/{id}`, angkanya menjadi 2 read/sesi (= 3.600 read).
3. **Penilaian massal & rule-get baca `attempts`:** admin membaca 1.800 `attempts` (query per `quizId` = 300 dok x 6 mapel) + 6 `quizKeys` (= 1.806 read). Di Rules, pengecekan `admins/{uid}` untuk query per mapel hanya memicu 1 rule-get per request (= 6 read), tetapi jika Rules memanggil `get(starts/{uid_quiz})` per dokumen `attempts`, akan muncul tambahan 1.800 read. Saat menulis `results`, `writeBatch` 300 siswa tetap dihitung **300 write** (bukan 1 write), total **1.800 write** (wajib tanpa `serverTimestamp()` agar tidak menggandakan write).
4. **Rebuild & baca leaderboard:** admin memperbarui `leaderboard/{quizId}` (6 write) atau `leaderboard/current` sekali setelah semua mapel selesai dinilai (1 write). Jika dibangun di memori saat proses grading = 0 read tambahan; jika re-baca seluruh `results` = +1.800 read. Siswa membaca leaderboard 1x/sesi = 1.800 read.
5. **Baca & tulis `progress/{uid}`:** dibaca 1x per sesi/kunjungan (1.800 sesi ujian + 1.000 sesi belajar/latihan = 2.800 - 3.800 read). Tulis selesai modul (1.000 write) + XP kuis latihan 1 write/sesi (1.000 - 2.000 write) = 2.000 - 3.000 write.
6. **Write `users/{uid}`, `classes`, dan `certificates/{id}`:** pembuatan `users` + gabung `classes` (1.000 - 2.000 write) dilakukan pada masa onboarding H-7 s.d. H-2, dan `certificates` (1.000 - 1.800 write) diterbitkan setelah periode ujian selesai. Tabel menampilkan angka hari ujian aktif serta catatan jika seluruh write tersebut digabung di hari yang sama.
7. **Browsing harian (1.000 akun unik):**
   - **Skenario Cache-On (`localStorage` + cek `version`):** 1.000 akun x 3 buka x 1 read cek versi/metadata = ~3.000 - 5.000 read (+ 2.000 read kuis latihan bila belum ter-cache).
   - **Skenario Cache-Off (tanpa cache / cache invalid serentak):** 1.000 akun x 3 buka x 8 read = 24.000 read (konstanta browsing penuh).

| Komponen Operasi (1.000 Akun Unik, 1.800 Sesi Ujian) | Read (Skenario 1: Cache-On) | Read (Skenario 2: Cache-Off) | Write (Hari Ujian Aktif) | Write (Jika +Onboarding & Sertifikat di Hari Sama) |
| --- | --- | --- | --- | --- |
| 1. Tulis `starts` + `attempts` (1.800 x 2) | 0 | 0 | 3.600 | 3.600 |
| 2. Muat soal `quizzes` + rule-get `starts` (1.800 x 2) | 3.600 | 3.600 | 0 | 0 |
| 3. Rule-get saat tulis `attempts` (baca `starts` [1.800] s.d. `starts+quizzes` [3.600]) | 1.800 - 3.600 | 1.800 - 3.600 | 0 | 0 |
| 4. Penilaian massal: baca `attempts` (1.800) + `quizKeys` (6) + rule-get (`admins` [6] s.d. `starts` [1.800]); tulis `results` | 1.812 - 3.606 | 1.812 - 3.606 | 1.800 | 1.800 |
| 5. Rebuild leaderboard (di memori [0] s.d. re-baca `results` [1.800]) + siswa baca leaderboard | 1.800 - 3.600 | 1.800 - 3.600 | 1 - 6 | 1 - 6 |
| 6. Baca & tulis `progress/{uid}` (modul selesai + XP 1 write/sesi) | 2.800 - 3.800 | 2.800 - 3.800 | 2.000 - 3.000 | 3.000 |
| 7. Browsing kursus/modul + kuis latihan (1.000 akun unik) | 3.000 - 6.000 | 24.000 - 28.000 | 0 | 0 |
| 8. Registrasi `users` (1.000) + `certificates` (1.800) *(jadwal di luar hari ujian)* | 0 | 0 - 2.000 | 0 *(di luar hari H)* | 2.800 |
| **TOTAL ESTIMASI (Rentang Teroptimasi s.d. Beban Penuh)** | **14.812 - 24.206 (30% - 48%)** | **35.812 - 48.206 (72% - 96%)** | **7.401 - 8.406 (37% - 42%)** | **11.201 - 11.206 (56%)** |
| **TOTAL KHUSUS JALUR UJIAN + PROGRESS (Tanpa Browsing Modul)** | **11.812 - 18.206 (24% - 36%)** | **11.812 - 18.206 (24% - 36%)** | **7.401 - 8.406 (37% - 42%)** | **11.201 - 11.206 (56%)** |

**Catatan Analisis Tabel:**
- Agar skenario **Cache-Off** pada hari ujian penuh tetap berada di bawah ambang rilis **`<= 30.000 read (60%)` dan `<= 12.000 write (60%)`**:
  1. Gunakan snapshot `duration` di `starts` (hemat 1.800 read pada baris 3).
  2. Gunakan pengecekan `admins/{uid}` saja saat admin membaca `attempts` dan menulis `results` (hemat 1.800 read pada baris 4).
  3. Bangun agregat leaderboard langsung di memori admin saat menghitung `results` (hemat 1.800 read pada baris 5).
  4. Selama jam ujian puncak, bekukan revisi `courses` (pre-warm cache H-1) atau batasi browsing modul non-ujian sehingga read hari ujian tanpa cache berada di kisaran **~26.000 - 29.800 read (< 60%)** dan write **~7.400 - 11.200 write (< 60%)**.

### 13.2 Aturan Hemat Kuota (WAJIB)

1. **Cache konten statis (`courses`, latihan) di `localStorage` + `version`:** potong read browsing harian terbesar. Pre-warm perubahan konten pada H-1 sebelum hari ujian.
2. **Soal ujian = 1 dokumen (`quizzes/{id}.questions[]`):** bukan subcollection per-soal.
3. **XP = 1 write per sesi:** digabung ke `progress/{uid}` di akhir sesi latihan, bukan per jawaban.
4. **Leaderboard = dokumen agregat (`leaderboard/{quizId}` atau `leaderboard/current`):** dibangun di memori saat grading, bukan query `results` oleh siswa.
5. **Nol realtime listener:** wajib pakai `getDoc`/`getDocs` sekali, **bukan `onSnapshot`**.
6. **Grading batch sadar kuota:** baca `attempts` per `quizId`, hitung di memori, tulis `results` dengan `writeBatch` (ingat: `writeBatch` berisi N dokumen tetap dihitung N write, bukan 1 write; jangan gunakan `FieldValue.serverTimestamp()` di dalam batch).
7. **`progress` dibaca sekali/sesi:** simpan di memori selama sesi berlangsung.
8. **Snapshot `duration` di `starts` & rule admin sederhana:** agar evaluasi Security Rules tidak memicu `get()` berantai.

### 13.3 Waktu Reset Kuota Harian (Mengikuti DST)

Jika kuota habis, Spark berhenti merespons (`RESOURCE_EXHAUSTED`) sampai reset harian dan tidak menagih biaya.
- Reset kuota harian Firestore berlangsung pada tengah malam waktu Pasifik (`00:00 America/Los_Angeles`), yang bergeser mengikuti **Daylight Saving Time (DST)**: **14:00 WIB** (saat PDT / UTC-7) atau **15:00 WIB** (saat PST / UTC-8), yakni pada rentang **14:00-15:00 WIB**.
- **Aturan Penjadwalan Wajib:** Tidak boleh ada sesi ujian yang dijadwalkan mulai **> 60 menit sebelum waktu reset** (dilarang memulai sesi yang melintasi jendela 13:00-15:00 WIB) agar kuota tidak ter-reset atau habis tepat di tengah pengerjaan ujian.

### 13.4 Batas Firebase Auth (Spark) dan Rencana Pembuatan Akun

Selain kuota Firestore, layanan **Firebase Authentication pada paket Spark** memiliki batas keras (*hard limits*) yang menjadi **blocker operasional** bila tidak dijadwalkan:

| Jenis Operasi Firebase Auth (Spark) | Batas Kuota Gratis | Dampak Operasional pada 1.000 Siswa |
| --- | --- | --- |
| **Reset sandi (*Password reset emails*)** | **150 email / hari** | Reset massal pada hari ujian akan gagal setelah siswa ke-150. |
| **Verifikasi alamat email (*Address verification*)** | **1.000 email / hari** | Pas-pasan untuk 1.000 siswa; 1 kali kirim ulang akan melampaui batas harian. |
| **Login tautan email (*Email-link sign-in*)** | **5 email / hari** | **Tidak bisa dipakai** untuk siswa (hanya 5/hari). |
| **Pembuatan akun baru (*Account signup*)** | **100 akun / jam / IP** | Jika 1.000 siswa daftar serentak dari **1 IP WiFi sekolah yang sama**, butuh **~10 jam** dan akun ke-101+ akan ditolak (`TOO_MANY_ATTEMPTS_TRY_LATER`). |
| **Pengguna aktif harian (*Tier 1 DAU*)** | **3.000 DAU / hari** | Aman untuk 1.000 siswa + guru/admin, namun wajib dipantau. |

**Rencana Pembuatan Akun & Mitigasi Operasional (WAJIB):**
1. **Pendaftaran bertahap sebelum hari ujian (H-7 s.d. H-2):** Pembuatan 1.000 akun siswa wajib dibagi per gelombang kelas di hari yang berbeda atau dilakukan siswa dari jaringan seluler masing-masing di rumah (agar tidak terkonsentrasi pada 1 alamat IP WiFi sekolah).
2. **Gunakan Google Sign-In atau Email/Password tanpa wajib verifikasi email saat ujian:** Jangan aktifkan *email-link sign-in* (limit 5/hari) dan jangan paksa verifikasi email di pagi hari ujian.
3. **Manajemen lupa sandi:** Karena email reset sandi dibatasi 150/hari, lakukan uji login serentak pada H-2 ujian agar masalah lupa sandi terselesaikan sebelum hari H.

## 14. UX dan UI

- Mobile first, tombol besar, navigasi sederhana.
- Halaman: beranda, daftar kursus, halaman modul, kuis/ujian, hasil, profil, sertifikat, admin.
- Panduan gaya: [logo, warna utama, font, tone bahasa].
- Wireframe: [tautan atau lampirkan].
- **UX Ketahanan Ujian (Wajib):**
  - Timer terlihat jelas (dihitung terhadap waktu mulai server `startedAt` + `duration`).
  - Setiap perubahan jawaban ujian langsung disimpan sebagai **draft di `localStorage`** perangkat siswa.
  - Saat tombol kirim ditekan, tampilkan **status pengiriman yang eksplisit** (`Sedang mengirim...` -> `Jawaban Berhasil Terkirim` dengan waktu terima, atau `Gagal Terkirim - Mencoba ulang (1/3)...`).
  - Klien melakukan **retry otomatis 3x dengan exponential backoff** jika pengiriman terkendala jaringan, memanfaatkan jendela toleransi 90 detik + grace write 5 menit.

## 15. Analitik dan pemantauan

- Pantau penggunaan kuota read, write, dan delete Firestore serta kuota Auth di Firebase Console setiap hari saat pekan ujian.
- Pasang alarm operasional manual: jika penggunaan read/write mendekati 70% sebelum sesi siang, tunda gelombang ujian non-kritis atau nonaktifkan fitur browsing tambahan.
- Metrik produk: siswa aktif, penyelesaian modul, rata-rata skor, rasio error sesi ujian (`starts` tanpa `attempts` valid).
- Log kesalahan klien (opsional, mis. pencatatan gagal muat soal / gagal kirim jawaban).

## 16. Rilis dan roadmap

| Fase | Isi | Target |
| --- | --- | --- |
| 1. Fondasi & Akun | Project Firebase, Auth, koleksi `classes/{code}`, deploy GitHub Pages (`base: '/nama-repo/'` + `404.html`), pembuatan akun bertahap (<= 100/jam/IP) | [tanggal] |
| 2. Konten & Cache | Kursus, video, progress modul (`dbApp` dengan `persistentLocalCache`), cache `localStorage` + `version`, penyiapan bank soal 6 mapel x 50 soal (`optionId` stabil) | [tanggal] |
| 3. Ujian Aman | Instance `dbExam` (tanpa persist), alur `starts` (snapshot + PRNG shuffle) -> `attempts` (create-only + draft + retry 3x), Security Rules deadline ganda, TTL `expireAt`, uji Emulator | [tanggal] |
| 4. Admin & Grading | Penilaian massal (`writeBatch` <= 500 write & <= 20 access-call, `results` create-only), rekap per kelas/kuis, ekspor CSV, update `leaderboard/{quizId}` atau `leaderboard/current` | [tanggal] |
| 5. Pengayaan (Tahap 2) | Sertifikat PDF (jsPDF), XP, badge, streak, halaman leaderboard siswa | [tanggal] |
| Pilot | 20-30 siswa, lalu simulasi beban eskalasi 30 -> 900 concurrent di Emulator | [tanggal] |
| Peluncuran | 1.000 siswa, ujian bergelombang per kelas di luar jendela reset DST 14:00-15:00 WIB | [tanggal] |

## 17. Pengujian dan kriteria penerimaan

- **Uji Firebase Emulator (Security Rules & Kuota):**
  - Siswa tidak bisa membaca `quizKeys`.
  - Siswa hanya bisa membaca `quizzes` jika `request.time in [openAt, closeAt]` (`closeAt = openAt + durasi + 90s`) **DAN** dokumen `starts/{uid_quiz}` ada.
  - Siswa tidak bisa mengedit/menimpa `quizKeys` atau `quizzes` setelah ada `starts`.
  - Siswa tidak bisa menulis `attempts` dua kali (`create-only`), dan hanya boleh membuat ulang sesi bila `starts` berumur `< 30 detik` serta belum ada `attempts`.
  - Siswa tidak bisa mengirim `attempts` setelah `startedAt + durasi + 90s` (+ grace write 5 menit untuk retry jaringan).
  - Siswa tidak bisa menulis `results` atau `leaderboard`; admin menulis `results` secara `create-only` dalam batch yang mematuhi batas `<= 500 write` dan `<= 20 access-call` per batch.
- **Uji Randomisasi & Grading:** jawaban disimpan dan dinilai dengan `optionId` stabil (bukan huruf posisi); urutan soal/opsi dari PRNG `seed = hash(uid + quizId + quizVersion)` konsisten saat halaman di-refresh.
- **Uji Dua Instance Firestore & Resiliensi UI:** pastikan `dbExam` tidak memakai offline persistence, draft jawaban tersimpan di `localStorage`, dan retry backoff 3x berjalan saat jaringan diputus sementara.
- **Uji XP & Leaderboard:** XP tercatat 1 write/sesi; leaderboard hanya membaca dokumen agregat dari `results` resmi (bukan query `results` dan bukan dari XP).
- **Uji Cache:** saat `version` diubah -> konten termuat ulang; saat `version` tetap -> 0 read untuk dokumen isi konten (maksimal 1 read pengecekan versi/metadata).
- **Uji Perangkat:** HP Android dan iOS (lebar layar >= 360 px), Chrome, Safari, Firefox.
- **Kriteria Rilis (Wajib Lulus):**
  1. Semua fitur Wajib lulus uji fungsional dan Security Rules di Firebase Emulator.
  2. **Kriteria kuota TANPA cache:** Simulasi/uji satu hari ujian penuh (6 mapel, 1.800 sesi dari 1.000 akun unik) pada skenario **TANPA cache (cache-off)** terbukti menghasilkan **<= 60% batas read harian (<= 30.000 read dari 50.000) DAN <= 60% batas write harian (<= 12.000 write dari 20.000)**.
  3. **Kriteria reliabilitas ujian (definisi error terukur):** Rasio **error sesi ujian = (jumlah sesi yang gagal memuat soal atau gagal mengirim jawaban) / (total sesi ujian yang dimulai) < 1%** pada uji pilot.

## 18. Asumsi, dependensi, dan risiko

**Asumsi**

- Semua siswa punya perangkat dan koneksi internet saat ujian.
- Guru bersedia menjalankan penilaian massal setelah sesi ujian selesai.
- Pendaftaran akun siswa dapat dijadwalkan beberapa hari sebelum ujian berlangsung.

**Dependensi**

- Firebase Spark (Authentication & Firestore), GitHub Pages + GitHub Actions, YouTube.

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Kuota Firestore harian habis | Layanan berhenti sementara (`RESOURCE_EXHAUSTED`) | Cache konten statis, pre-warm H-1, soal 1 dokumen, snapshot `duration` di `starts`, pantau kuota harian |
| Batas Auth Spark: signup 100/jam/IP & reset sandi 150/hari | Siswa gagal daftar/login serentak dari WiFi sekolah di hari ujian | Buat akun bertahap H-7 s.d. H-2 per kelas atau via seluler rumah; gunakan Google Sign-In; uji login H-2; jangan pakai email-link (limit 5/hari) |
| App Check melewati kuota gratis (10.000 assessments/bulan) | reCAPTCHA v3/Enterprise berhenti membedakan bot atau butuh billing | Jalankan App Check hanya dalam mode monitor/opsional; pertahanan utama wajib di Firestore Rules + Auth |
| Offline persistence menunda write `attempts` melewati deadline | Jawaban ditolak Rules dan hilang diam-diam | Wajib 2 instance Firestore (`dbApp` persist, `dbExam` memory cache tanpa persist) + grace write 5 menit + retry backoff 3x + draft `localStorage` |
| Deadline baca soal vs tulis jawaban tidak sinkron | Siswa yang masuk terlambat tidak bisa muat soal atau gagal kirim | Seragamkan `closeAt = openAt + durasi + 90s`; baca soal butuh `request.time in [openAt, closeAt]` & `starts` ada; tulis `attempts <= startedAt + durasi + 90s` + grace 5m |
| Soal/kunci diedit saat ujian sedang berjalan | Nilai 300 siswa salah atau tidak konsisten | Larang edit `quizKeys` setelah ada `starts`; simpan snapshot `quizVersion` + `duration` + `keyVersion` di `starts`; koreksi wajib buat `quizzes/{id}_v2` |
| Acak opsi mengacaukan kunci huruf (A/B/C/D) | Penilaian salah sistematis | Simpan jawaban di `attempts` dan kunci di `quizKeys` sebagai `optionId` stabil; shuffle pakai PRNG `seed = hash(uid + quizId + quizVersion)` disimpan di `starts` |
| Batch penilaian ditolak Rules (> 20 access-call) | Penilaian massal gagal terbit | Rules `results` hanya cek `admins/{uid}` (1 access-call ter-cache per batch), jangan panggil `get()` dokumen per-siswa; pecah batch <= 500 write tanpa `serverTimestamp()` |
| `leaderboard/current` tertimpa (*last-write-wins*) atau tercemar XP | Skor mapel sebelumnya hilang atau dimanipulasi dari klien | Gunakan `leaderboard/{quizId}` per mapel ATAU tulis `leaderboard/current` sekali setelah semua mapel dinilai; hanya agregasi `results` resmi |
| Storage 1 GiB penuh oleh data ujian lama | Penulisan dokumen baru gagal setelah beberapa bulan | Pasang field `expireAt` + Firestore TTL policy pada `starts` dan `attempts` (gratis di Spark, pantau agar delete TTL <= 20.000/hari) |
| Reset kuota mengikuti DST (14:00-15:00 WIB) | Ujian siang/sore terputus saat pergantian hari kuota | Larang penjadwalan sesi ujian yang mulai > 60 menit sebelum jendela reset 14:00-15:00 WIB |
| Deploy GitHub Pages gagal / rute SPA 404 | Halaman ujian tidak bisa dibuka lewat tautan langsung | Set Vite `base: '/nama-repo/'`, sediakan `public/404.html` fallback, patuhi batas build timeout 10 menit dan soft limit 10 build/jam |

## 19. Pertanyaan terbuka

- Siapa penanggung jawab operasional pembuatan akun bertahap (H-7 s.d. H-2) dan pembagian kode kelas (`classes/{code}`)?
- Apakah seluruh siswa memiliki akun Google sekolah (direkomendasikan untuk menghindari limit email verifikasi 1.000/hari dan reset sandi 150/hari)?
- ~~Berapa durasi dan jumlah soal ujian tipikal?~~ -> **Asumsi tetap: 50 soal/mapel, ~90 menit/mapel** (1 dokumen `quizzes/{id}`).
- Apakah lembaga membutuhkan `leaderboard/{quizId}` per mata pelajaran, atau cukup satu `leaderboard/current` gabungan yang ditulis sekali setelah semua mapel dinilai?
- Berapa lama masa simpan (`expireAt` TTL) dokumen `starts` dan `attempts` setelah nilai resmi (`results`) diterbitkan (mis. 30 hari atau 90 hari)?
- Kebijakan persetujuan orang tua untuk siswa di bawah umur: [isi sesuai kebijakan lembaga].

## 20. Lampiran

- Spesifikasi teknis lengkap dan Security Rules (`spec tech.md`)
- Daftar kebutuhan sistem (`requirements.md`)
- Wireframe dan panduan gaya
- Contoh format CSV rekap nilai (dengan filter `classCode` dan `quizId`)
- Template sertifikat
