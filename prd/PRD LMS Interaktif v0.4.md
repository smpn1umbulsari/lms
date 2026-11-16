# PRD LMS Interaktif

Versi 0.4 (patched) - 16 November 2026 - Pemilik produk: [isi nama]

> **Changelog v0.3 -> v0.4 (16 November 2026):**
> 1. **Penyelarasan Gate Rilis & Tabel Kuota (Seksi 13, 17):** dihapus kontradiksi kriteria rilis lama yang menuntut `<= 30.000 read` tanpa cache (mustahil lulus karena browsing cache-off 24.000 + minimum jalur ujian 11.812 = 35.812 > 30.000). Kriteria rilis ditulis ulang secara jujur: *"Uji beban hari ujian penuh dengan CACHE AKTIF (browsing cache-on); jalur ujian (baca soal, tulis attempts/results, leaderboard) dalam kondisi worst-case (get() rules tidak di-cache lintas dokumen). Batas: <=60% read (<=30.000) dan <=60% write (<=12.000)"*, dengan target lulus rentang Cache-On **14.812 - 24.206 read (30% - 48%)** dan **7.401 - 11.206 write (37% - 56%)**.
> 2. **Koreksi Dua Angka Tabel Tanpa Asal & Hitung Ulang Cache-Off (Seksi 13.1):** (a) baris 7 kolom Cache-Off dikoreksi menjadi angka tunggal **24.000 read** (konsisten dengan Asumsi 7: `1.000 x 3 x 8 = 24.000 flat`, menghapus angka `28.000` tanpa asal); (b) baris 8 kolom Cache-Off dikoreksi menjadi **0 read** (menghapus `0 - 2.000 read` pada baris operasi write di luar hari ujian). Total kolom Cache-Off dihitung ulang secara jujur menjadi **35.812 - 42.206 read (72% - 84%)** (bukan 96%).
> 3. **Penyeragaman Deadline Model "Ujian Sinkron" (Seksi 8, 10, 11, 12, 13, 17, 18):** dipilih dan ditetapkan secara eksplisit model **ujian sinkron**: semua siswa wajib mulai dalam jendela **`[openAt, openAt + toleransiMulai]`**; timer per-siswa adalah **`startedAt + durasi + 90s`**; jendela tutup global didefinisikan sebagai **`closeAt = openAt + toleransiMulai + durasi + 90s`** (sudah memperhitungkan siswa paling telat, menggantikan definisi lama). Baca soal diizinkan selama **`[openAt, closeAt]`** dan tulis `attempts` diizinkan selama **`startedAt + durasi + 90s` DAN `<= closeAt`**, sehingga write-block per-siswa tidak pernah melewati `closeAt` dan siswa yang mulai terlambat tidak pernah terkena read-block saat timernya masih berjalan.
> 4. **Pengaktifan `attemptNo` pada ID Dokumen (Seksi 8, 10, 11, 12, 17):** ID dokumen diubah menjadi **`attempts/{uid}_{quizId}_{attemptNo}`** (mis. `attempts/u123_quiz45_1`), selaras dengan `starts/{uid}_{quizId}_{attemptNo}` dan `results/{uid}_{quizId}_{attemptNo}`. Aturan `create-only` diperbarui: setiap dokumen attempt bersifat create-only, dan pembuatan attempt baru diizinkan selama nomor `attemptNo` tersebut belum ada (`!exists`), masih `<= maxAttempts`, dan masih berada di dalam jendela waktu ujian.
> 5. **Solusi Kuota Signup 100/jam/IP (Seksi 13.4, 16, 18):** ditegaskan bahwa batas `100 akun/jam/IP` hanya berlaku untuk **signup sisi-klien (*client-side*)**. Ditambahkan dua solusi langsung agar pembuatan 1.000 akun tidak membutuhkan 10 jam: (a) kuota dapat dinaikkan sementara via Firebase Console (gratis), atau (b) pembuatan 1.000 akun dilakukan via **Firebase Admin SDK / server-side** yang bebas dari kuota per-IP.
> 6. **Pelunakan Framing `serverTimestamp()` / Field Transform (Seksi 11, 13.1, 13.2, 18):** klaim bahwa `serverTimestamp()` pasti "menggandakan write" dilunakkan sesuai dokumentasi resmi menjadi: *"field transform dapat menambah operasi tertagih; untuk `results` create-only, `serverTimestamp` tidak diperlukan sehingga dihindari"*.
> 7. **Sumber & Tanggal Akses Batas Auth + Perbaikan Minor GitHub Pages & `certificates` (Seksi 9, 11, 13.1, 13.4, 18):** ditambahkan kolom sumber dan catatan bahwa angka batas Auth (reset sandi 150/hari, verifikasi email 1.000/hari, email-link 5/hari) mengacu pada halaman *Firebase Authentication Limits* per tanggal akses **16 November 2026** dan dapat berubah sewaktu-waktu (sedangkan signup 100/jam/IP terkonfirmasi akurat); dicatat bahwa *soft limit* 10 build/jam GitHub Pages tidak berlaku untuk build via *custom GitHub Actions*; dijelaskan asumsi `certificates` **1.000 - 1.800 write** (1.000 jika 1 per siswa unik/kursus, 1.800 jika 1 per sesi mapel karena siswa bisa mengikuti >1 mapel).
>
> **Changelog v0.2 -> v0.3:**
> 1. **Model data & randomisasi (Seksi 8, 11):** ditambah koleksi `classes/{code}` (`nama`, `mapel`, `anggota[]`); ditambah field `quizId` + `attemptNo` pada `attempts` dan `results`; ditambah snapshot `quizVersion` + `duration` + `keyVersion` pada `starts`; jawaban di `attempts` dan kunci di `quizKeys` wajib memakai `optionId` stabil (bukan huruf posisi A/B/C/D); pengacakan soal/opsi memakai PRNG deterministik `seed = hash(uid + quizId + quizVersion)` dan hasil shuffle disimpan di `starts`.
> 2. **Deadline & ketahanan kirim (Seksi 12, 14):** baca soal wajib `request.time in [openAt, closeAt]` DAN `starts` ada; tulis `attempts` wajib memenuhi batas waktu pengerjaan per-siswa dan jendela global; UI wajib menampilkan status terkirim/tidak secara eksplisit, retry backoff 3x, dan menyimpan draft jawaban di `localStorage`.
> 3. **Dua instance Firestore (Seksi 11, 12):** karena offline persistence bersifat global per instance, wajib memisahkan `dbApp` (`persistentLocalCache` untuk kursus/modul) dan `dbExam` (memory cache / tanpa persist, khusus `starts` dan `attempts`).
> 4. **Immutability soal, attempts, dan results (Seksi 11, 12):** `quizKeys` tidak boleh diedit setelah ada `starts` (koreksi wajib membuat versi baru `quizzes/{id}_v2`, bukan menimpa); `attempts` bersifat create-only dan `results` bersifat create-only (re-grading = `revision` / `_v2`).
> 5. **Aturan batch penilaian & access-call (Seksi 12, 13):** batas `writeBatch` maks 500 write/batch dan maks 20 access-call per batched write (10 untuk single-doc); dikoreksi bahwa `get()` ke dokumen admin yang sama di-cache per request (= 1 access-call, bukan 300), sehingga risiko nyata hanya muncul bila Rules memanggil `get()` ke dokumen berbeda per item (mis. `get(starts/{uid_quiz_attempt})` per result).
> 6. **Leaderboard bebas konflik (Seksi 8, 11, 13):** memakai `leaderboard/{quizId}` per mapel ATAU menulis `leaderboard/current` sekali setelah semua mapel selesai dinilai (menghindari *last-write-wins*), serta hanya mengagregasi `results` resmi (bukan XP/badge).
> 7. **Transparansi kuota, DST, dan TTL (Seksi 11, 13, 18):** tabel Seksi 13 dihitung ulang secara transparan dengan label *"estimasi; ukur nyata via Emulator"* untuk 1.000 akun unik (1.800 sesi, ~1,8 sesi/siswa) dalam dua skenario (cache-on dan cache-off); waktu reset kuota disesuaikan DST (`14:00-15:00 WIB`, larangan mulai sesi > 60 menit sebelum reset); retensi storage 1 GiB memakai field `expireAt` + Firestore TTL policy di `starts`/`attempts` (gratis di Spark, namun delete tetap memotong kuota 20.000/hari).
> 8. **Koreksi App Check, Batas Auth Spark, GitHub Pages, dan Kriteria Uji (Seksi 9, 12, 13, 17, 18):** reCAPTCHA v3 (Essentials) dan Enterprise sama-sama dibatasi 10.000 assessments/bulan gratis (tidak cukup untuk ~60.000/bulan) sehingga App Check disetel mode monitor/opsional dan keamanan utama bersandar pada Firestore Rules + Auth; ditambah seksi Batas Firebase Auth Spark beserta rencana pembuatan akun; ditambah spesifikasi GitHub Pages (`base: '/nama-repo/'`, `404.html`, timeout 10 menit); kriteria rilis ditetapkan menjadi `<= 60%` read (`<= 30.000`) dan `<= 60%` write (`<= 12.000`) dengan definisi error terukur `< 1%`.
>
> **Changelog v0.1 -> v0.2:** kuota ditulis ulang per-hari (6 mapel x 300 = 1.800 sesi, puncak 900 concurrent) + komponen browsing; ditambah strategi cache konten; `leaderboard/current` dokumen agregat; `attempts` per-`questionId`; toleransi 90 detik; larangan offline persistence untuk attempts; `version` field; 404.html + App Check di deployment; kriteria uji ditambah. Selaras dengan `spec tech.md`.

## 1. Ringkasan

LMS interaktif untuk 1.000 akun siswa unik dengan biaya $0 (beban puncak ujian: 6 mapel/hari, 300 siswa/mapel, 3 mapel bersamaan = 900 concurrent, total 1.800 sesi ujian/hari atau ~1,8 sesi/siswa). Tampilan di-host di GitHub Pages, backend memakai Firebase paket Spark (Authentication dan Firestore) tanpa Cloud Functions dan tanpa Cloud Storage. Fitur utama: kursus berurutan, video, kuis latihan instan, ujian resmi sinkron yang dinilai guru secara massal, pelacakan progress, serta pengayaan Tahap 2 berupa gamifikasi sederhana dan sertifikat PDF.

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

- Login dan pendaftaran dengan kode kelas (`classes/{code}`)
- Halaman kursus, modul berurutan, video YouTube
- Progress per modul
- Kuis latihan instan (skor lokal, XP 1 write/sesi)
- Ujian resmi sinkron: mulai dalam `[openAt, openAt + toleransiMulai]` (`starts/{uid}_{quizId}_{attemptNo}` dengan snapshot versi & durasi), kerjakan (acak PRNG ber-seed), kirim (`attempts/{uid}_{quizId}_{attemptNo}` per `questionId` dengan `optionId` stabil), dinilai guru (`results/{uid}_{quizId}_{attemptNo}`)
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

- Sebagai guru, saya ingin membuat kuis dan menjadwalkan ujian sinkron agar siswa hanya bisa mengerjakan pada waktunya.
- Sebagai guru, saya ingin menilai semua jawaban sekali klik per mapel agar hemat waktu.
- Sebagai guru, saya ingin mengekspor rekap nilai ke CSV per kelas dan mata pelajaran.

**Admin**

- Sebagai admin, saya ingin mengatur siapa yang menjadi guru, mengelola dokumen kelas (`classes/{code}`), dan menyiapkan pembuatan 1.000 akun siswa dengan lancar (via Firebase Admin SDK, penaikan kuota Console, atau pendaftaran terjadwal).

## 8. Kebutuhan fungsional

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| F-01 | Registrasi dan login (email/password atau Google), reset sandi (mengikuti batas kuota Auth Spark) | Wajib |
| F-02 | Bergabung ke kelas dengan kode kelas (`classes/{code}`) | Wajib |
| F-03 | Daftar kursus dan modul, modul terkunci berurutan | Wajib |
| F-04 | Tampilkan video YouTube dan bacaan per modul | Wajib |
| F-05 | Tombol "selesai" modul dan progress bar | Wajib |
| F-06 | Kuis latihan dengan skor instan (XP ditulis **sekali per sesi**) | Wajib |
| F-07 | Ujian resmi (model **ujian sinkron**): siswa wajib mulai dalam `[openAt, openAt + toleransiMulai]`; catat waktu mulai di server (`starts/{uid}_{quizId}_{attemptNo}`) beserta snapshot `quizVersion`, `duration`, `keyVersion`; jadwal tutup global seragam **`closeAt = openAt + toleransiMulai + durasi + 90s`** | Wajib |
| F-08 | Kirim jawaban ujian ke `attempts/{uid}_{quizId}_{attemptNo}` (**create-only per `attemptNo`**; boleh attempt baru selama `attemptNo` belum ada, `<= maxAttempts`, dan masih dalam jendela waktu `startedAt + durasi + 90s <= closeAt`), disimpan **per `questionId`** dengan nilai **`optionId` stabil** (bukan huruf posisi A/B/C/D) | Wajib |
| F-09 | Acak urutan soal dan pilihan per siswa di klien (**gratis kuota**) memakai **PRNG deterministik** `seed = hash(uid + quizId + quizVersion)`, hasil shuffle disimpan di `starts` | Penting |
| F-10 | Admin: buat kuis dan atur jadwal (`openAt`, `toleransiMulai`, `duration`, `closeAt`); `quizKeys` tidak boleh diedit setelah ada `starts` (koreksi wajib buat versi baru `quizzes/{id}_v2`) | Wajib |
| F-11 | Admin: penilaian massal (`results/{uid}_{quizId}_{attemptNo}` create-only) + update dokumen agregat `leaderboard/{quizId}` atau `leaderboard/current` sekali setelah semua mapel dinilai | Wajib |
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
| Routing & Hosting | GitHub Pages dengan Vite `base: '/nama-repo/'`, SPA fallback `public/404.html` (deep-link jalan), build timeout 10 menit (catatan: *soft limit* 10 build/jam tidak berlaku untuk build via *custom GitHub Actions* yang digunakan proyek ini) |

## 10. Alur pengguna utama

**Belajar (via instance `dbApp`)** Daftar/masuk -> masukkan kode kelas (`classes/{code}`) -> pilih kursus -> buka modul -> tonton video -> tandai selesai -> modul berikutnya terbuka.

**Ujian resmi sinkron (via instance `dbExam`)** Siswa klik mulai di dalam jendela `[openAt, openAt + toleransiMulai]` (dokumen `starts/{uid}_{quizId}_{attemptNo}` ditulis dengan server timestamp + snapshot `quizVersion`, `duration`, `keyVersion` + hasil shuffle dari PRNG deterministik `seed = hash(uid + quizId + quizVersion)`) -> soal dimuat selama `request.time in [openAt, closeAt]` (dengan `closeAt = openAt + toleransiMulai + durasi + 90s`) dan dokumen `starts` ada, lalu timer per-siswa (`startedAt + durasi + 90s`) berjalan -> selama pengerjaan, draft jawaban disimpan di `localStorage` -> siswa kirim jawaban (`attempts/{uid}_{quizId}_{attemptNo}`, create-only per `attemptNo`, selama `request.time <= startedAt + durasi + 90s` DAN `request.time <= closeAt`, per `questionId` berisi `optionId` stabil, dengan retry backoff 3x dan indikator status terkirim eksplisit) -> guru klik "Nilai semua" per mapel -> hasil (`results/{uid}_{quizId}_{attemptNo}`, create-only) terbit + `leaderboard/{quizId}` (atau `leaderboard/current` setelah semua mapel dinilai) diperbarui -> siswa lihat nilai dan unduh sertifikat.

**Kuis latihan (via instance `dbApp`)** Buka kuis -> jawab di browser -> skor instan dihitung lokal -> XP ditulis sekali di akhir sesi ke `progress/{uid}`.

## 11. Arsitektur dan data

| Lapisan | Teknologi |
| --- | --- |
| Frontend | Vite + JavaScript (atau React), Firebase SDK modular |
| Hosting | GitHub Pages (`base: '/nama-repo/'`, `public/404.html` SPA fallback; build timeout 10 menit; catatan: *soft limit* 10 build/jam tidak berlaku untuk build via *custom GitHub Actions*) + GitHub Actions |
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
- `quizzes/{id}`: soal tanpa kunci (`questions[]` dalam 1 dokumen, 50 soal; tiap soal memiliki `questionId` dan tiap opsi memiliki `optionId` stabil), `duration` (durasi menit), `toleransiMulai` (batas keterlambatan mulai ujian sinkron, mis. 15 menit), `maxAttempts` (batas percobaan, default `1`), jadwal `openAt` dan `closeAt` dengan rumus eksplisit **`closeAt = openAt + toleransiMulai + duration + 90s`** (jendela global yang sudah memperhitungkan siswa paling telat), serta **field `version`**
- `quizKeys/{id}`: kunci jawaban per `questionId` yang menyimpan **`optionId` stabil** (BUKAN huruf posisi A/B/C/D; hanya bisa dibaca admin) + **field `keyVersion`**
- `starts/{uid}_{quizId}_{attemptNo}` (mis. `starts/u123_quiz45_1`): waktu mulai (`startedAt` server timestamp, wajib dibuat saat `request.time in [openAt, openAt + toleransiMulai]`), `quizId`, `attemptNo`, snapshot **`quizVersion` + `duration` + `keyVersion`**, susunan hasil shuffle dari **PRNG deterministik `seed = hash(uid + quizId + quizVersion)`**, serta field **`expireAt`** (untuk Firestore TTL)
- `attempts/{uid}_{quizId}_{attemptNo}` (mis. `attempts/u123_quiz45_1`): jawaban **per `questionId`** berisi **`optionId` stabil** (**create-only per dokumen `attemptNo`**; boleh membuat attempt baru selama dokumen untuk `attemptNo` tersebut belum ada, `attemptNo <= maxAttempts`, dan masih di dalam jendela waktu `startedAt + duration + 90s <= closeAt`), ditambah field **`quizId`**, **`attemptNo`**, dan **`expireAt`** (untuk Firestore TTL)
- `results/{uid}_{quizId}_{attemptNo}` (mis. `results/u123_quiz45_1`): skor resmi (ditulis admin, **create-only**, tanpa `serverTimestamp()` di dalam batch karena *field transform* dapat menambah operasi tertagih; untuk `results` create-only, `serverTimestamp` tidak diperlukan sehingga dihindari), ditambah field **`quizId`**, **`attemptNo`**, dan `revision` (jika ada penilaian ulang/re-grading, ditulis sebagai dokumen baru `results/{uid}_{quizId}_{attemptNo}_v2` atau field `revision`)
- `progress/{uid}`: modul selesai, XP, badge, streak (1 dokumen)
- `leaderboard/{quizId}` atau `leaderboard/current`: **dokumen agregat skor resmi** (ditulis admin, dibaca user login). Gunakan `leaderboard/{quizId}` per mapel ATAU tulis `leaderboard/current` **sekali** setelah seluruh mapel selesai dinilai (untuk menghindari *last-write-wins*). Hanya berisi agregasi `results` resmi, **bukan** XP/badge.
- `certificates/{id}`: nomor verifikasi, `uid`, `courseId` (atau `quizId`). Asumsi volume penerbitan adalah **1.000 - 1.800 dokumen**: **1.000** bila diterbitkan 1 sertifikat per siswa unik (kelulusan kursus) atau **1.800** bila diterbitkan 1 sertifikat per sesi mata pelajaran (6 mapel x 300 siswa = 1.800 sesi mapel, karena siswa dapat mengikuti >1 mapel).

**Aturan Randomisasi, Kunci Jawaban, dan Immutability Soal:**
- **Jawaban dan kunci memakai `optionId` stabil:** Huruf A/B/C/D di layar hanya label urutan tampilan. Baik `attempts` maupun `quizKeys` wajib menyimpan ID opsi yang stabil (mis. `opt_a`, `opt_b`) agar pengacakan urutan opsi tidak menyebabkan kesalahan penilaian.
- **PRNG deterministik:** Pengacakan urutan soal dan opsi di klien wajib memakai algoritma PRNG ber-seed deterministik (mis. mulberry32) dengan `seed = hash(uid + quizId + quizVersion)`, bukan `Math.random()`. Hasil urutan shuffle disimpan di dokumen `starts` saat ujian dimulai agar konsisten bila halaman dimuat ulang dan dapat diverifikasi.
- **Larangan edit soal/kunci saat ujian berlangsung:** Setelah terdapat dokumen `starts` pada suatu ujian, `quizzes/{id}` dan `quizKeys/{id}` **tidak boleh diedit atau ditimpa**. Jika ada koreksi soal atau kunci, admin wajib menerbitkan dokumen versi baru (`quizzes/{id}_v2` dan `quizKeys/{id}_v2`). Snapshot `quizVersion`, `duration`, dan `keyVersion` di `starts` menjamin siswa dinilai sesuai versi soal saat ia mulai.

**Cache Konten Statis & Retensi Data (Firestore TTL):**
- **Cache konten statis (WAJIB):** `courses` dan kuis latihan bersifat immutable setelah publish; simpan di `localStorage` beserta `version` dan muat ulang isi dokumen hanya jika `version` berubah. Untuk soal ujian resmi (`quizzes`), cache hanya di memori/sesi aktif selama ujian berlangsung agar bank soal tidak tersimpan permanen di perangkat siswa (catatan: karena 1 dokumen bank soal dipakai bersama, acak urutan di klien berfungsi mencegah salin nomor urut, bukan anti-nyontek sebangku penuh).
- **Retensi penyimpanan 1 GiB (Firestore TTL):** Batas storage Spark adalah **1 GiB**. Koleksi `starts` dan `attempts` wajib menyertakan field timestamp `expireAt` dan didaftarkan pada **Firestore TTL policy** (fitur ini tersedia gratis di paket Spark tanpa Cloud Functions). Penghapusan otomatis oleh TTL **tetap memotong kuota delete harian (20.000 delete/hari)**, sehingga TTL hanya diterapkan pada `starts` dan `attempts` yang sudah kedaluwarsa (mis. 30-90 hari setelah ujian), bukan pada `results`, `users`, atau `certificates`. Aktifkan juga single-field index exemption pada field teks soal panjang di `quizzes` untuk menghemat ruang indeks.

## 12. Keamanan dan privasi

- **Security Rules dan Firebase Auth sebagai garis pertahanan utama:** siswa hanya dapat membaca/menulis data miliknya sendiri, `quizKeys` hanya bisa dibaca admin (`admins/{uid}`), dan validasi waktu dijaga di server melalui `request.time`.
- **Model "Ujian Sinkron" dan Penyeragaman Deadline (`openAt`, `toleransiMulai`, `closeAt`, `startedAt`):**
  - Seluruh ujian resmi menerapkan model **ujian sinkron** dengan aturan waktu yang seragam antara gerbang baca soal dan gerbang tulis jawaban:
    1. **Jendela mulai (`starts/{uid}_{quizId}_{attemptNo}`):** Semua siswa WAJIB memulai ujian di dalam rentang **`[openAt, openAt + toleransiMulai]`**. Pembuatan dokumen `starts` di luar jendela ini ditolak oleh Security Rules.
    2. **Timer per-siswa:** Waktu pengerjaan tiap siswa adalah **`startedAt + durasi + 90s`** (sudah mencakup toleransi jaringan 90 detik).
    3. **Rumus `closeAt` global:** **`closeAt = openAt + toleransiMulai + durasi + 90s`**. Karena `closeAt` dihitung dari batas akhir `openAt + toleransiMulai`, jendela global ini **sudah memperhitungkan siswa yang mulai paling telat**, sehingga batas waktu per-siswa (`startedAt + durasi + 90s`) tidak pernah melewati `closeAt`.
    4. **Gerbang baca soal (`quizzes/{id}`):** Diizinkan selama **`request.time >= openAt && request.time <= closeAt`** **DAN** dokumen `starts/{uid}_{quizId}_1` sudah ada. Siswa yang mulai terlambat (di dalam `toleransiMulai`) tidak akan pernah terkena *read-block* saat timernya masih berjalan.
    5. **Gerbang tulis jawaban (`attempts/{uid}_{quizId}_{attemptNo}`):** Diizinkan selama **`request.time <= starts.startedAt + durasi + 90s` DAN `request.time <= closeAt`**.
- **Ketahanan pengiriman di klien (UI) & larangan offline persistence ujian:**
  - Alur ujian wajib menggunakan instance `dbExam` (memory cache, tanpa `persistentLocalCache` / `enableIndexedDbPersistence`) agar tidak ada write yang tertahan di antrean offline.
  - Selama ujian, klien wajib menyimpan **draft jawaban di `localStorage`**, menjalankan **retry otomatis 3x dengan exponential backoff** saat terjadi gagal jaringan ketika kirim `attempts`, dan menampilkan **state pengiriman secara eksplisit** (`Terkirim`, `Sedang mengirim...`, atau `Gagal terkirim - klik coba lagi`).
- **Aturan `create-only` ber-`attemptNo` (`attempts/{uid}_{quizId}_{attemptNo}`):**
  - Setiap dokumen `attempts/{uid}_{quizId}_{attemptNo}` (mis. `attempts/u123_quiz45_1`) bersifat **create-only** (`update` dan `delete` oleh siswa ditolak sepenuhnya).
  - Pembuatan attempt baru (mis. `attemptNo = 2` -> `attempts/u123_quiz45_2`, atau pembuatan ulang percobaan apabila sesi awal belum mengirim jawaban) **diizinkan selama dokumen `attempts/{uid}_{quizId}_{attemptNo}` untuk nomor `attemptNo` tersebut belum ada (`!exists`), nilai `attemptNo <= maxAttempts` kuis, serta `request.time` masih berada di dalam jendela waktu (`request.time <= startedAt + durasi + 90s && request.time <= closeAt`)**.
  - `results/{uid}_{quizId}_{attemptNo}` bersifat **create-only** oleh admin (re-grading / revisi nilai tidak boleh menimpa dokumen lama secara diam-diam, melainkan melalui field `revision` atau dokumen versi baru `results/{uid}_{quizId}_{attemptNo}_v2`).
- **Aturan Batch Penilaian & Batas Access-Call Security Rules:**
  - Firestore membatasi `writeBatch` maksimal **500 write per batch** DAN membatasi evaluasi Security Rules maksimal **10 access-call (`get`/`exists`/`getAfter`) untuk single-document request** serta **20 access-call untuk multi-document request, transaksi, dan `writeBatch`**.
  - **Catatan teknis penting:** Pemanggilan `get()` atau `exists()` ke dokumen admin yang **SAMA** (mis. `admins/{uid}`) di dalam satu `writeBatch` berisi 300 dokumen `results` di-cache per request oleh Firestore, sehingga **hanya dihitung 1 access-call** (bukan 300 access-call). Risiko menembus batas 20 access-call **hanya terjadi jika Rules `results` memanggil `get()` ke dokumen yang BERBEDA untuk setiap write** (misalnya memanggil `get(starts/{uid}_{quizId}_{attemptNo})` per siswa saat menulis `results`).
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
> **Premis Beban & Model Ujian Sinkron:** Kohort **1.000 akun siswa unik**, beban ujian **6 mapel/hari x 300 siswa/mapel = 1.800 sesi ujian/hari (~1,8 sesi/siswa)**, puncak **900 concurrent** (3 mapel bersamaan). Ujian memakai model **ujian sinkron**: semua siswa wajib mulai dalam `[openAt, openAt + toleransiMulai]`, timer per-siswa = `startedAt + durasi + 90s`, dan jendela global `closeAt = openAt + toleransiMulai + durasi + 90s` (baca soal diizinkan selama `[openAt, closeAt]`; tulis `attempts/{uid}_{quizId}_{attemptNo}` diizinkan selama `startedAt + durasi + 90s` DAN `<= closeAt`).

### 13.1 Tabel Hitung Ulang Transparan Harian (Ujian + Browsing + Latihan)

Asumsi eksplisit yang disertakan dalam perhitungan (seluruh angka di tabel diturunkan langsung dari 7 poin ini):
1. **Rule-get muat soal:** setiap baca `quizzes/{id}` memicu 1 `get(starts/{uid}_{quizId}_1)` di Security Rules (= 1 dok + 1 rule-get = 2 read/sesi; `1.800 x 2 = 3.600 read`).
2. **Rule-get tulis `attempts`:** saat siswa menulis `attempts/{uid}_{quizId}_{attemptNo}`, Rules memvalidasi waktu mulai dan durasi (`request.time <= startedAt + durasi + 90s && request.time <= closeAt`). Karena `duration` sudah di-snapshot di `starts/{uid}_{quizId}_{attemptNo}`, Rules cukup membaca 1 dokumen `starts` (= `1.800 read`). Pada kondisi *worst-case* ketika Rules juga membaca `quizzes/{id}` (dan `get()` lintas dokumen tidak ter-cache), angkanya menjadi 2 read/sesi (= `3.600 read`).
3. **Penilaian massal & rule-get baca `attempts`:** admin membaca 1.800 `attempts` (query per `quizId` = 300 dok x 6 mapel) + 6 `quizKeys` (= `1.806 read`). Di Rules, pengecekan `admins/{uid}` untuk query per mapel hanya memicu 1 rule-get per request (= `6 read`, total `1.812 read`), tetapi pada kondisi *worst-case* jika Rules memanggil `get(starts/{uid}_{quizId}_{attemptNo})` per dokumen `attempts`, muncul tambahan `1.800 read` (total `3.606 read`). Saat menulis `results`, `writeBatch` 300 siswa tetap dihitung **300 write** (bukan 1 write), total **1.800 write**. Hindari `FieldValue.serverTimestamp()` di dalam batch karena *field transform* dapat menambah operasi tertagih; untuk `results` yang bersifat *create-only*, `serverTimestamp` tidak diperlukan sehingga dihindari.
4. **Rebuild & baca leaderboard:** admin memperbarui `leaderboard/{quizId}` (6 write) atau `leaderboard/current` sekali setelah semua mapel selesai dinilai (1 write). Jika dibangun di memori saat proses grading = `0 read` tambahan; jika re-baca seluruh `results` = `+1.800 read`. Siswa membaca leaderboard 1x/sesi = `1.800 read` (total `1.800 - 3.600 read`).
5. **Baca & tulis `progress/{uid}`:** dibaca 1x per sesi/kunjungan (`1.800` sesi ujian + `1.000 - 2.000` sesi belajar/latihan = `2.800 - 3.800 read`). Tulis selesai modul (`1.000 write`) + XP kuis latihan 1 write/sesi (`1.000 - 2.000 write`) = `2.000 - 3.000 write`.
6. **Write `users/{uid}`, `classes`, dan `certificates/{id}` (di luar hari ujian):** pembuatan `users` + gabung `classes` (`1.000 write` untuk 1.000 akun siswa) dilakukan pada masa onboarding H-7 s.d. H-2, sedangkan penerbitan `certificates/{id}` dilakukan setelah periode ujian selesai dengan volume **1.000 - 1.800 write** (asumsi: **1.000 write** jika diterbitkan 1 sertifikat per siswa unik/kursus, atau **1.800 write** jika diterbitkan 1 sertifikat per sesi mapel dari 6 mapel x 300 siswa = 1.800 sesi mapel, karena siswa dapat mengikuti >1 mapel). Pada hari ujian aktif, komponen ini bernilai **0 read dan 0 write**; pada kolom simulasi ekstrem jika onboarding (`1.000 write`) dan sertifikat per sesi mapel (`1.800 write`) digabung di hari yang sama, totalnya adalah **`2.800 write`** (dan **`0 read`** pada kedua skenario).
7. **Browsing harian (1.000 akun unik):**
   - **Skenario 1 - Cache-On (`localStorage` + cek `version`):** `1.000 akun x 3 buka x 1 read` cek versi/metadata = `3.000 read` (hingga `4.000 read` bila ada muat ulang sebagian kursus) + `0 - 2.000 read` kuis latihan bila belum ter-cache = **`3.000 - 6.000 read`**.
   - **Skenario 2 - Cache-Off (tanpa cache / cache invalid serentak):** `1.000 akun x 3 buka x 8 read` = **`24.000 read`** (konstanta tunggal sesuai asumsi).

| Komponen Operasi (1.000 Akun Unik, 1.800 Sesi Ujian) | Read (Skenario 1: Cache-On) | Read (Skenario 2: Cache-Off) | Write (Hari Ujian Aktif) | Write (Jika +Onboarding & Sertifikat di Hari Sama) |
| --- | --- | --- | --- | --- |
| 1. Tulis `starts` + `attempts` (1.800 x 2) | 0 | 0 | 3.600 | 3.600 |
| 2. Muat soal `quizzes` + rule-get `starts` (1.800 x 2) | 3.600 | 3.600 | 0 | 0 |
| 3. Rule-get saat tulis `attempts` (baca `starts` [1.800] s.d. `starts+quizzes` [3.600]) | 1.800 - 3.600 | 1.800 - 3.600 | 0 | 0 |
| 4. Penilaian massal: baca `attempts` (1.800) + `quizKeys` (6) + rule-get (`admins` [6] s.d. `starts` [1.800]); tulis `results` | 1.812 - 3.606 | 1.812 - 3.606 | 1.800 | 1.800 |
| 5. Rebuild leaderboard (di memori [0] s.d. re-baca `results` [1.800]) + siswa baca leaderboard | 1.800 - 3.600 | 1.800 - 3.600 | 1 - 6 | 1 - 6 |
| 6. Baca & tulis `progress/{uid}` (modul selesai + XP 1 write/sesi) | 2.800 - 3.800 | 2.800 - 3.800 | 2.000 - 3.000 | 3.000 |
| 7. Browsing kursus/modul + kuis latihan (1.000 akun unik) | 3.000 - 6.000 | 24.000 | 0 | 0 |
| 8. Registrasi `users` (1.000) + `certificates` (1.800) *(jadwal di luar hari ujian)* | 0 | 0 | 0 *(di luar hari H)* | 2.800 |
| **TOTAL ESTIMASI (Rentang Teroptimasi s.d. Worst-Case Rules)** | **14.812 - 24.206 (30% - 48%)** | **35.812 - 42.206 (72% - 84%)** | **7.401 - 8.406 (37% - 42%)** | **11.201 - 11.206 (56%)** |
| **TOTAL KHUSUS JALUR UJIAN + PROGRESS (Baris 1-6, Tanpa Browsing Modul)** | **11.812 - 18.206 (24% - 36%)** | **11.812 - 18.206 (24% - 36%)** | **7.401 - 8.406 (37% - 42%)** | **11.201 - 11.206 (56%)** |

**Catatan Analisis Tabel & Penyelarasan Gate Rilis:**
- **Mengapa Skenario 2 (Cache-Off) tidak dijadikan Gate Rilis `<= 30.000 read`:** Pada skenario Cache-Off, konstanta browsing tanpa cache saja adalah **24.000 read** (baris 7), dan jika ditambah minimum jalur ujian + progress (**11.812 read**, baris 1-6) menghasilkan **35.812 - 42.206 read (72% - 84% dari 50.000)**. Artinya, tanpa cache browsing, pemakaian read secara matematis selalu `> 30.000 read` (meskipun masih di bawah batas keras 50.000 read Spark).
- **Definisi Gate Rilis yang Jujur dan Konsisten (Selaraskan dengan Seksi 17):** Uji beban hari ujian penuh dilakukan dengan **CACHE AKTIF (browsing cache-on)**, sedangkan **jalur ujian** (baca soal, tulis `attempts`/`results`, leaderboard) diuji hingga **kondisi *worst-case*** (`get()` pada Security Rules tidak di-cache lintas dokumen yang berbeda). Dalam kondisi ini, total pemakaian berada pada **14.812 - 24.206 read (30% - 48%)** dan **7.401 - 11.206 write (37% - 56%)**, yang terbukti lulus di bawah batas rilis **`<= 60% read (<= 30.000)`** dan **`<= 60% write (<= 12.000)`**.
- **Empat optimasi wajib untuk menjaga pemakaian di batas bawah Cache-On (~14.812 read / 30%):**
  1. Gunakan snapshot `duration` di `starts` agar tulis `attempts` tidak perlu `get(quizzes/{id})` (hemat 1.800 read pada baris 3).
  2. Gunakan pengecekan `admins/{uid}` saja saat admin membaca `attempts` dan menulis `results` (hemat 1.800 read pada baris 4).
  3. Bangun agregat leaderboard langsung di memori admin saat menghitung `results` (hemat 1.800 read pada baris 5).
  4. Bekukan revisi `courses` selama hari ujian (pre-warm cache pada H-1) agar seluruh klien tetap berada pada Skenario 1 (Cache-On).

### 13.2 Aturan Hemat Kuota (WAJIB)

1. **Cache konten statis (`courses`, latihan) di `localStorage` + `version`:** potong read browsing harian dari 24.000 menjadi 3.000 - 6.000 read. Pre-warm perubahan konten pada H-1 sebelum hari ujian.
2. **Soal ujian = 1 dokumen (`quizzes/{id}.questions[]`):** bukan subcollection per-soal.
3. **XP = 1 write per sesi:** digabung ke `progress/{uid}` di akhir sesi latihan, bukan per jawaban.
4. **Leaderboard = dokumen agregat (`leaderboard/{quizId}` atau `leaderboard/current`):** dibangun di memori saat grading, bukan query `results` oleh siswa.
5. **Nol realtime listener:** wajib pakai `getDoc`/`getDocs` sekali, **bukan `onSnapshot`**.
6. **Grading batch sadar kuota:** baca `attempts` per `quizId`, hitung di memori, tulis `results` dengan `writeBatch` (ingat: `writeBatch` berisi N dokumen tetap dihitung N write, bukan 1 write; untuk `results` create-only, hindari `FieldValue.serverTimestamp()` karena *field transform* dapat menambah operasi tertagih dan tidak diperlukan).
7. **`progress` dibaca sekali/sesi:** simpan di memori selama sesi berlangsung.
8. **Snapshot `duration` di `starts` & rule admin sederhana:** agar evaluasi Security Rules tidak memicu `get()` berantai.

### 13.3 Waktu Reset Kuota Harian (Mengikuti DST)

Jika kuota habis, Spark berhenti merespons (`RESOURCE_EXHAUSTED`) sampai reset harian dan tidak menagih biaya.
- Reset kuota harian Firestore berlangsung pada tengah malam waktu Pasifik (`00:00 America/Los_Angeles`), yang bergeser mengikuti **Daylight Saving Time (DST)**: **14:00 WIB** (saat PDT / UTC-7) atau **15:00 WIB** (saat PST / UTC-8), yakni pada rentang **14:00-15:00 WIB**.
- **Aturan Penjadwalan Wajib:** Tidak boleh ada sesi ujian yang dijadwalkan mulai **> 60 menit sebelum waktu reset** (dilarang memulai sesi yang melintasi jendela 13:00-15:00 WIB) agar kuota tidak ter-reset atau habis tepat di tengah pengerjaan ujian.

### 13.4 Batas Firebase Auth (Spark) dan Rencana Pembuatan Akun

Selain kuota Firestore, layanan **Firebase Authentication pada paket Spark** memiliki batas kuota yang wajib dikelola sebelum hari ujian.

> **Catatan Sumber & Tanggal Akses:** Angka batas di bawah ini (khususnya reset sandi 150/hari, verifikasi email 1.000/hari, dan email-link 5/hari) mengacu pada halaman dokumentasi **Firebase Authentication Limits** per **tanggal akses 16 November 2026** dan **dapat berubah sewaktu-waktu** sesuai kebijakan Google/Firebase (batas pembuatan akun sisi-klien 100 akun/jam/IP terkonfirmasi akurat).

| Jenis Operasi Firebase Auth (Spark) | Batas Kuota Gratis | Sumber (Akses 16 Nov 2026) | Dampak Operasional & Solusi pada 1.000 Siswa |
| --- | --- | --- | --- |
| **Reset sandi (*Password reset emails*)** | **150 email / hari** | Firebase Authentication Limits (per 16 Nov 2026; dapat berubah sewaktu-waktu) | Reset massal pada hari ujian akan tertahan setelah email ke-150; mitigasi dengan uji login H-2 atau reset sandi via Admin SDK. |
| **Verifikasi alamat email (*Address verification*)** | **1.000 email / hari** | Firebase Authentication Limits (per 16 Nov 2026; dapat berubah sewaktu-waktu) | Pas-pasan untuk 1.000 siswa; jangan wajibkan verifikasi email pada pagi hari ujian. |
| **Login tautan email (*Email-link sign-in*)** | **5 email / hari** | Firebase Authentication Limits (per 16 Nov 2026; dapat berubah sewaktu-waktu) | **Tidak bisa dipakai** untuk siswa (hanya 5/hari); gunakan Email/Password atau Google Sign-In. |
| **Pembuatan akun baru (*Account signup*)** | **100 akun / jam / IP** *(khusus sisi-klien)* | Firebase Authentication Limits (per 16 Nov 2026; terkonfirmasi akurat) | Kuota ini **hanya berlaku untuk signup sisi-klien (*client-side*)**. Jika 1.000 siswa daftar mandiri serentak dari 1 IP WiFi sekolah tanpa mitigasi, akun ke-101+ ditolak (`TOO_MANY_ATTEMPTS_TRY_LATER`). **Solusi agar tidak perlu 10 jam:** (a) naikkan kuota sementara via Firebase Console (gratis), atau (b) buat 1.000 akun via **Firebase Admin SDK / server-side** yang **bebas dari kuota per-IP**. |
| **Pengguna aktif harian (*Tier 1 DAU*)** | **3.000 DAU / hari** | Firebase Authentication Limits (per 16 Nov 2026; dapat berubah sewaktu-waktu) | Aman untuk 1.000 siswa + guru/admin, namun tetap dipantau di Console. |

**Rencana Pembuatan Akun & Mitigasi Operasional (WAJIB):**
1. **Gunakan Admin SDK atau naikkan kuota signup Console (tanpa menunggu 10 jam):** Karena kuota `100 akun/jam/IP` hanya membatasi pendaftaran dari sisi-klien (*client-side*), admin sekolah dapat:
   - **(a) Menaikkan kuota signup per-IP sementara secara gratis** melalui Firebase Console (*Authentication -> Settings -> Sign-up quota*) saat sesi onboarding berlangsung, ATAU
   - **(b) Membuat 1.000 akun siswa secara terpusat memakai skrip Firebase Admin SDK (server-side/lokal admin)** dari CSV data siswa pada H-7 s.d. H-2, yang **sepenuhnya bebas dari batas kuota per-IP**, ATAU
   - **(c) Membagi pendaftaran mandiri bertahap** per gelombang kelas / dari jaringan seluler rumah masing-masing.
2. **Gunakan Google Sign-In atau Email/Password tanpa wajib verifikasi email saat ujian:** Jangan aktifkan *email-link sign-in* (limit 5/hari) dan jangan paksa verifikasi email di pagi hari ujian.
3. **Manajemen lupa sandi:** Karena email reset sandi dibatasi 150/hari, lakukan uji login serentak pada H-2 ujian (atau bantu reset sandi langsung melalui Admin SDK) agar masalah lupa sandi terselesaikan sebelum hari H.

## 14. UX dan UI

- Mobile first, tombol besar, navigasi sederhana.
- Halaman: beranda, daftar kursus, halaman modul, kuis/ujian, hasil, profil, sertifikat, admin.
- Panduan gaya: [logo, warna utama, font, tone bahasa].
- Wireframe: [tautan atau lampirkan].
- **UX Ketahanan Ujian (Wajib):**
  - Jendela mulai ujian sinkron (`[openAt, openAt + toleransiMulai]`) dan timer pengerjaan per-siswa (`startedAt + duration`) ditampilkan dengan jelas.
  - Setiap perubahan jawaban ujian langsung disimpan sebagai **draft di `localStorage`** perangkat siswa.
  - Saat tombol kirim ditekan, tampilkan **status pengiriman yang eksplisit** (`Sedang mengirim...` -> `Jawaban Berhasil Terkirim` dengan waktu terima, atau `Gagal Terkirim - Mencoba ulang (1/3)...`).
  - Klien melakukan **retry otomatis 3x dengan exponential backoff** jika pengiriman terkendala jaringan di dalam jendela toleransi 90 detik (`startedAt + durasi + 90s <= closeAt`).

## 15. Analitik dan pemantauan

- Pantau penggunaan kuota read, write, dan delete Firestore serta kuota Auth di Firebase Console setiap hari saat pekan ujian.
- Pasang alarm operasional manual: jika penggunaan read/write mendekati 70% sebelum sesi siang, tunda gelombang ujian non-kritis atau nonaktifkan fitur browsing tambahan.
- Metrik produk: siswa aktif, penyelesaian modul, rata-rata skor, rasio error sesi ujian (`starts` tanpa `attempts` valid).
- Log kesalahan klien (opsional, mis. pencatatan gagal muat soal / gagal kirim jawaban).

## 16. Rilis dan roadmap

| Fase | Isi | Target |
| --- | --- | --- |
| 1. Fondasi & Akun | Project Firebase, Auth, koleksi `classes/{code}`, deploy GitHub Pages (`base: '/nama-repo/'` + `404.html`), provisioning 1.000 akun via Admin SDK / penaikan kuota Console / bertahap | [tanggal] |
| 2. Konten & Cache | Kursus, video, progress modul (`dbApp` dengan `persistentLocalCache`), cache `localStorage` + `version`, penyiapan bank soal 6 mapel x 50 soal (`optionId` stabil) | [tanggal] |
| 3. Ujian Sinkron Aman | Instance `dbExam` (tanpa persist), alur `starts/{uid}_{quizId}_{attemptNo}` (mulai dalam `[openAt, openAt + toleransiMulai]`, snapshot + PRNG shuffle) -> `attempts/{uid}_{quizId}_{attemptNo}` (create-only per `attemptNo` + draft + retry 3x), Security Rules `closeAt = openAt + toleransiMulai + durasi + 90s`, TTL `expireAt`, uji Emulator | [tanggal] |
| 4. Admin & Grading | Penilaian massal (`writeBatch` <= 500 write & <= 20 access-call, `results/{uid}_{quizId}_{attemptNo}` create-only tanpa `serverTimestamp`), rekap per kelas/kuis, ekspor CSV, update `leaderboard/{quizId}` atau `leaderboard/current` | [tanggal] |
| 5. Pengayaan (Tahap 2) | Sertifikat PDF (jsPDF), XP, badge, streak, halaman leaderboard siswa | [tanggal] |
| Pilot | 20-30 siswa, lalu simulasi beban eskalasi 30 -> 900 concurrent di Emulator | [tanggal] |
| Peluncuran | 1.000 siswa, ujian sinkron bergelombang per kelas di luar jendela reset DST 14:00-15:00 WIB | [tanggal] |

## 17. Pengujian dan kriteria penerimaan

- **Uji Firebase Emulator (Security Rules & Kuota):**
  - Siswa tidak bisa membaca `quizKeys`.
  - **Ujian sinkron - mulai ujian (`starts/{uid}_{quizId}_{attemptNo}`):** siswa hanya bisa membuat dokumen `starts` jika `request.time` berada di dalam `[openAt, openAt + toleransiMulai]`.
  - **Ujian sinkron - baca soal (`quizzes/{id}`):** siswa hanya bisa membaca `quizzes` jika `request.time in [openAt, closeAt]` dengan rumus **`closeAt = openAt + toleransiMulai + durasi + 90s`** **DAN** dokumen `starts/{uid}_{quizId}_1` ada.
  - Siswa tidak bisa mengedit/menimpa `quizKeys` atau `quizzes` setelah ada `starts`.
  - **Ujian sinkron - tulis jawaban (`attempts/{uid}_{quizId}_{attemptNo}`):** dokumen bersifat `create-only` per nomor `attemptNo` (tidak bisa `update`/`delete`); pembuatan attempt baru diizinkan selama dokumen dengan `attemptNo` tersebut belum ada (`!exists`), `attemptNo <= maxAttempts`, dan waktu pengiriman memenuhi **`request.time <= startedAt + durasi + 90s` DAN `request.time <= closeAt`** (karena `closeAt = openAt + toleransiMulai + durasi + 90s`, write-block per-siswa tidak pernah melewati `closeAt`).
  - Siswa tidak bisa menulis `results` atau `leaderboard`; admin menulis `results/{uid}_{quizId}_{attemptNo}` secara `create-only` dalam batch yang mematuhi batas `<= 500 write` dan `<= 20 access-call` per batch.
- **Uji Randomisasi & Grading:** jawaban disimpan dan dinilai dengan `optionId` stabil (bukan huruf posisi); urutan soal/opsi dari PRNG `seed = hash(uid + quizId + quizVersion)` konsisten saat halaman di-refresh.
- **Uji Dua Instance Firestore & Resiliensi UI:** pastikan `dbExam` tidak memakai offline persistence, draft jawaban tersimpan di `localStorage`, dan retry backoff 3x berjalan saat jaringan diputus sementara.
- **Uji XP & Leaderboard:** XP tercatat 1 write/sesi; leaderboard hanya membaca dokumen agregat dari `results` resmi (bukan query `results` dan bukan dari XP).
- **Uji Cache:** saat `version` diubah -> konten termuat ulang; saat `version` tetap -> 0 read untuk dokumen isi konten (maksimal 1 read pengecekan versi/metadata).
- **Uji Perangkat:** HP Android dan iOS (lebar layar >= 360 px), Chrome, Safari, Firefox.
- **Kriteria Rilis (Wajib Lulus):**
  1. Semua fitur Wajib lulus uji fungsional dan Security Rules di Firebase Emulator.
  2. **Kriteria kuota dengan CACHE AKTIF:** Uji beban hari ujian penuh dengan CACHE AKTIF (browsing cache-on); jalur ujian (baca soal, tulis attempts/results, leaderboard) dalam kondisi worst-case (get() rules tidak di-cache lintas dokumen). Batas: <=60% read (<=30.000) dan <=60% write (<=12.000). Target lulus mengacu pada Skenario 1 (Cache-On) di Tabel Seksi 13.1, yakni **14.812 - 24.206 read (30% - 48% dari 50.000)** dan **7.401 - 11.206 write (37% - 56% dari 20.000)**.
  3. **Kriteria reliabilitas ujian (definisi error terukur):** Rasio **error sesi ujian = (jumlah sesi yang gagal memuat soal atau gagal mengirim jawaban) / (total sesi ujian yang dimulai) < 1%** pada uji pilot.

## 18. Asumsi, dependensi, dan risiko

**Asumsi**

- Semua siswa punya perangkat dan koneksi internet saat ujian.
- Guru bersedia menjalankan penilaian massal setelah sesi ujian selesai.
- Pembuatan akun siswa dilakukan sebelum hari ujian (via Admin SDK, penaikan kuota Console, atau pendaftaran bertahap).
- Sertifikat diterbitkan sejumlah **1.000 - 1.800 dokumen** (1.000 jika 1 sertifikat per siswa unik/kursus, atau 1.800 jika 1 sertifikat per sesi mapel karena siswa dapat mengikuti >1 mapel).

**Dependensi**

- Firebase Spark (Authentication & Firestore), GitHub Pages + GitHub Actions, YouTube.

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Kuota Firestore harian habis | Layanan berhenti sementara (`RESOURCE_EXHAUSTED`) | Wajib aktifkan cache konten statis (`localStorage` + `version`), pre-warm H-1, soal 1 dokumen, snapshot `duration` di `starts`, pantau kuota harian (menjaga beban di 14.812 - 24.206 read / 30% - 48%) |
| Batas Auth Spark: signup sisi-klien 100/jam/IP & reset sandi 150/hari (per 16 Nov 2026) | Siswa gagal daftar mandiri serentak dari 1 IP WiFi sekolah atau gagal reset sandi massal di hari H | Kuota 100/jam/IP hanya untuk sisi-klien: (a) naikkan kuota sementara via Firebase Console (gratis), atau (b) buat 1.000 akun via Firebase Admin SDK (bebas kuota per-IP), atau (c) daftar bertahap H-7 s.d. H-2; uji login H-2; jangan pakai email-link (limit 5/hari) |
| App Check melewati kuota gratis (10.000 assessments/bulan) | reCAPTCHA v3/Enterprise berhenti membedakan bot atau butuh billing | Jalankan App Check hanya dalam mode monitor/opsional; pertahanan utama wajib di Firestore Rules + Auth |
| Offline persistence menunda write `attempts` melewati deadline | Jawaban ditolak Rules dan hilang diam-diam | Wajib 2 instance Firestore (`dbApp` persist, `dbExam` memory cache tanpa persist) + retry backoff 3x + draft `localStorage` |
| Deadline baca soal vs tulis jawaban tidak sinkron | Siswa yang masuk terlambat terkena read-block saat timer masih jalan | Terapkan model **ujian sinkron**: wajib mulai dalam `[openAt, openAt + toleransiMulai]`, timer per-siswa `startedAt + durasi + 90s`, dan `closeAt = openAt + toleransiMulai + durasi + 90s`; baca soal dalam `[openAt, closeAt]`, tulis `attempts` selama `startedAt + durasi + 90s` DAN `<= closeAt` |
| ID dokumen `attempts` bertabrakan saat percobaan ulang | Field `attemptNo` tidak terpakai dan attempt kedua ditolak | Gunakan ID dokumen ber-`attemptNo`: `attempts/{uid}_{quizId}_{attemptNo}` (serta `starts` dan `results` yang selaras); boleh buat attempt baru selama `attemptNo` belum ada, `<= maxAttempts`, dan masih dalam jendela waktu |
| Soal/kunci diedit saat ujian sedang berjalan | Nilai 300 siswa salah atau tidak konsisten | Larang edit `quizKeys` setelah ada `starts`; simpan snapshot `quizVersion` + `duration` + `keyVersion` di `starts`; koreksi wajib buat `quizzes/{id}_v2` |
| Acak opsi mengacaukan kunci huruf (A/B/C/D) | Penilaian salah sistematis | Simpan jawaban di `attempts` dan kunci di `quizKeys` sebagai `optionId` stabil; shuffle pakai PRNG `seed = hash(uid + quizId + quizVersion)` disimpan di `starts` |
| Batch penilaian ditolak Rules (> 20 access-call) atau boros operasi | Penilaian massal gagal terbit atau menambah operasi tertagih | Rules `results` hanya cek `admins/{uid}` (1 access-call ter-cache per batch), jangan panggil `get()` dokumen per-siswa; pecah batch <= 500 write; hindari `serverTimestamp()` pada `results` create-only karena *field transform* dapat menambah operasi tertagih dan tidak diperlukan |
| `leaderboard/current` tertimpa (*last-write-wins*) atau tercemar XP | Skor mapel sebelumnya hilang atau dimanipulasi dari klien | Gunakan `leaderboard/{quizId}` per mapel ATAU tulis `leaderboard/current` sekali setelah semua mapel dinilai; hanya agregasi `results` resmi |
| Storage 1 GiB penuh oleh data ujian lama | Penulisan dokumen baru gagal setelah beberapa bulan | Pasang field `expireAt` + Firestore TTL policy pada `starts` dan `attempts` (gratis di Spark, pantau agar delete TTL <= 20.000/hari) |
| Reset kuota mengikuti DST (14:00-15:00 WIB) | Ujian siang/sore terputus saat pergantian hari kuota | Larang penjadwalan sesi ujian yang mulai > 60 menit sebelum jendela reset 14:00-15:00 WIB |
| Deploy GitHub Pages gagal / rute SPA 404 | Halaman ujian tidak bisa dibuka lewat tautan langsung | Set Vite `base: '/nama-repo/'`, sediakan `public/404.html` fallback, patuhi build timeout 10 menit (catatan: *soft limit* 10 build/jam tidak berlaku untuk build via *custom GitHub Actions*) |

## 19. Pertanyaan terbuka

- Metode mana yang dipilih sekolah untuk pembuatan 1.000 akun siswa pada H-7 s.d. H-2: provisioning terpusat via skrip Firebase Admin SDK (bebas kuota 100/jam/IP), penaikan kuota sementara di Firebase Console, atau pendaftaran mandiri bertahap per kelas?
- Apakah seluruh siswa memiliki akun Google sekolah (direkomendasikan untuk menghindari limit email verifikasi 1.000/hari dan reset sandi 150/hari)?
- Berapa nilai parameter `toleransiMulai` standar untuk ujian sinkron (mis. 15 menit atau 30 menit sejak `openAt`) dan apakah `maxAttempts` selalu disetel `1` untuk ujian resmi?
- ~~Berapa durasi dan jumlah soal ujian tipikal?~~ -> **Asumsi tetap: 50 soal/mapel, ~90 menit/mapel** (1 dokumen `quizzes/{id}`).
- Apakah sertifikat diterbitkan **1 per kelulusan kursus/siswa unik (1.000 sertifikat)** atau **1 per sesi mata pelajaran (1.800 sertifikat)**, dan apakah `leaderboard/{quizId}` dibuat per mapel atau gabungan `leaderboard/current`?
- Berapa lama masa simpan (`expireAt` TTL) dokumen `starts` dan `attempts` setelah nilai resmi (`results`) diterbitkan (mis. 30 hari atau 90 hari)?
- Kebijakan persetujuan orang tua untuk siswa di bawah umur: [isi sesuai kebijakan lembaga].

## 20. Lampiran

- Spesifikasi teknis lengkap dan Security Rules (`spec tech.md`)
- Daftar kebutuhan sistem (`requirements.md`)
- Wireframe dan panduan gaya
- Contoh format CSV rekap nilai (dengan filter `classCode` dan `quizId`)
- Template sertifikat
