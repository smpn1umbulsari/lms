# PRD LMS Interaktif

Versi 0.5 (patched) - 16 November 2026 - Pemilik produk: [isi nama]

> **Changelog v0.4 -> v0.5 (16 November 2026) — hasil audit kritis:**
> Perbaikan menutup 9 temuan KRITIS (K1–K9) + temuan SEDANG terpilih dari audit independen. Ringkas:
> 1. **K1 — Validasi snapshot `starts` (lubang keamanan terbesar):** `starts` kini WAJIB memuat `startedAt`, `duration`, `closeAt`, `maxAttempts`, `quizVersion`, `keyVersion`, dan Security Rules WAJIB memvalidasi tiap field terhadap `quizzes/{id}`/`quizKeys/{id}` (bukan hanya membaca). Ditambah `request.resource.data.startedAt == request.time` sehingga timer/snapshot tidak bisa dipalsukan siswa.
> 2. **K2 — Snapshot `closeAt` + `maxAttempts` di `starts`:** agar gerbang tulis `attempts` cukup 1 rule-get (baris 3 tabel kembali sah di 1.800 read).
> 3. **K3 — Pisah rentang write:** kolom hari-H (`7.401–8.406`, 37%–42%) dipisah dari kolom ekstrem (onboarding+sertifikat+ujian) yang **DILARANG** dijadwalkan bersamaan.
> 4. **K4 — Onboarding = 2.000 write:** `1.000 users` + `1.000 arrayUnion classes.anggota[]`. Jika digabung hari ujian, total write `12.206` (61%) **melampaui gate 12.000** → karena itu onboarding & sertifikat WAJIB di hari terpisah.
> 5. **K5 — `quizLocks/{quizId}` untuk immutability:** Firestore Rules tidak bisa query koleksi, jadi "quizKeys tak boleh diedit setelah ada `starts`" diekspresikan lewat dokumen lock yang ditulis admin saat ujian dibuka.
> 6. **K6 — Hapus hardcode `_1`:** semua referensi `starts/{uid}_{quizId}_1` diganti `starts/{uid}_{quizId}_{attemptNo}` (dengan `maxAttempts=1` untuk ujian resmi).
> 7. **K7 — Satu dokumen `attempts` dengan map `answers`:** jawaban disimpan sebagai `answers{questionId: optionId}` dalam SATU dokumen per attempt (bukan dokumen per-`questionId`), konsisten dengan tabel (1.800 write). Aturan diubah menjadi **create + update terbatas** (hanya `answers`/`updatedAt`/`submitSeq` di dalam jendela waktu) agar retry idempoten (memperbaiki create-only yang mematikan retry).
> 8. **K8 — `maxAttempts=1` untuk ujian resmi:** menghapus janji `attemptNo>1` yang mustahil (jendela `starts` sudah tutup).
> 9. **K9 — Ikat `attemptNo` di ID ke field:** Rules menolak ID yang tidak sama dengan `uid_quizId_attemptNo` (cegah attempt liar `_A/_B/_C`).
> 10. **Koreksi tabel 13.1 + transparansi (S2, S5, S8, S9, S13):** baris 4 max diperbaiki `3.606 -> 3.612`; ditambah baris read operasional (login, join kelas, baca-balik `starts`, pembahasan) dan baris storage/egress; total Cache-On & Cache-Off dihitung ulang secara jujur.
> 11. **Perbaikan SEDANG lain:** DST `107 menit` (S1), `results` create-only dengan revisi hanya via `_v2` (S4), skema kunci latihan & pembahasan (S6/S7), klaim "naikkan kuota Console" dilunakkan (S10), metode uji Emulator dikoreksi — Emulator hanya mengukur jumlah operasi, penegakan kuota diuji di project nyata (S11), rumus tautologi di F-08/§11/§14 diperbaiki (S16), gate rilis diperluas mencakup delete/storage (S13).
>
> **Changelog v0.3 -> v0.4 (16 November 2026):** (dipertahankan) Penyelarasan gate rilis & tabel kuota (Seksi 13,17); koreksi dua angka tabel tanpa asal; penyeragaman model "ujian sinkron" (`closeAt = openAt + toleransiMulai + durasi + 90s`); pengaktifan `attemptNo` pada ID dokumen; solusi kuota signup 100/jam/IP; pelunakan framing `serverTimestamp()`; sumber & tanggal akses batas Auth.
>
> **Changelog v0.2 -> v0.3:** (dipertahankan) `classes/{code}`; `quizId`+`attemptNo`; snapshot `quizVersion`+`duration`+`keyVersion`; `optionId` stabil; PRNG deterministik `seed = hash(uid + quizId + quizVersion)`; deadline & ketahanan kirim; dua instance Firestore; immutability; batch grading & access-call; leaderboard bebas konflik; transparansi kuota/DST/TTL; App Check mode monitor; GitHub Pages; kriteria uji.
>
> **Changelog v0.1 -> v0.2:** (dipertahankan) kuota per-hari (1.800 sesi, 900 concurrent) + browsing; cache konten; `leaderboard/current`; toleransi 90 detik; larangan offline persistence untuk `attempts`; field `version`; 404.html + App Check; kriteria uji.

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
- Ujian resmi sinkron: mulai dalam `[openAt, openAt + toleransiMulai]` (`starts/{uid}_{quizId}_{attemptNo}` dengan snapshot versi, durasi, `closeAt`, `maxAttempts`), kerjakan (acak PRNG ber-seed), kirim (**satu** dokumen `attempts/{uid}_{quizId}_{attemptNo}` berisi map `answers{questionId: optionId}`), dinilai guru (`results/{uid}_{quizId}_{attemptNo}`)
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

- Sebagai admin, saya ingin mengatur siapa yang menjadi guru, mengelola dokumen kelas (`classes/{code}`), dan menyiapkan pembuatan 1.000 akun siswa dengan lancar (via Firebase Admin SDK, penaikan kuota Console bila tersedia, atau pendaftaran terjadwal).

## 8. Kebutuhan fungsional

| ID | Kebutuhan | Prioritas |
| --- | --- | --- |
| F-01 | Registrasi dan login (email/password atau Google), reset sandi (mengikuti batas kuota Auth Spark) | Wajib |
| F-02 | Bergabung ke kelas dengan kode kelas (`classes/{code}`) | Wajib |
| F-03 | Daftar kursus dan modul, modul terkunci berurutan | Wajib |
| F-04 | Tampilkan video YouTube dan bacaan per modul | Wajib |
| F-05 | Tombol "selesai" modul dan progress bar | Wajib |
| F-06 | Kuis latihan dengan skor instan (XP ditulis **sekali per sesi**); kunci latihan disimpan di koleksi terpisah `quizKeysLatihan/{quizId}` yang boleh dibaca siswa **hanya setelah** submit (lihat §11) | Wajib |
| F-07 | Ujian resmi (model **ujian sinkron**): siswa wajib mulai dalam `[openAt, openAt + toleransiMulai]`; catat waktu mulai di server (`starts/{uid}_{quizId}_{attemptNo}`) dengan snapshot **`startedAt`, `duration`, `closeAt`, `maxAttempts`, `quizVersion`, `keyVersion`**; jadwal tutup global **`closeAt = openAt + toleransiMulai + duration + 90s`** | Wajib |
| F-08 | Kirim jawaban ujian ke **satu** dokumen `attempts/{uid}_{quizId}_{attemptNo}` berisi map **`answers{questionId: optionId}`** + `updatedAt` + `submitSeq`; aturan **create + update terbatas** (hanya field `answers`/`updatedAt`/`submitSeq`) selama `request.time <= closeAt` DAN `request.time <= startedAt + duration + 90s`; `maxAttempts=1` untuk ujian resmi | Wajib |
| F-09 | Acak urutan soal dan pilihan per siswa di klien (**gratis kuota**) memakai **PRNG deterministik** `seed = hash(uid + quizId + quizVersion)`, hasil shuffle disimpan di `starts` | Penting |
| F-10 | Admin: buat kuis dan atur jadwal (`openAt`, `toleransiMulai`, `duration`, `closeAt`); setelah ujian dibuka, tulis `quizLocks/{quizId}` sehingga `quizzes/{id}` & `quizKeys/{id}` terkunci (koreksi wajib buat versi baru `quizzes/{id}_v2`) | Wajib |
| F-11 | Admin: penilaian massal (`results/{uid}_{quizId}_{attemptNo}` create-only) + update dokumen agregat `leaderboard/{quizId}` atau `leaderboard/current` sekali setelah semua mapel dinilai | Wajib |
| F-12 | Siswa melihat hasil dan pembahasan (pembahasan dibaca dari `quizExplanations/{quizId}`, terpisah dari `quizKeys`, hanya setelah `results` siswa terbit) | Wajib |
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
| Storage & egress | Storage Spark 1 GiB, egress 10 GiB/bulan; **wajib** dijaga dengan TTL (lihat §11/§13.5). Tanpa Cloud Storage: **dilarang** menyisipkan gambar base64/berkas besar ke dokumen (soal hanya teks) |
| Routing & Hosting | GitHub Pages dengan Vite `base: '/nama-repo/'`, SPA fallback `public/404.html` (deep-link jalan), build timeout 10 menit (catatan: *soft limit* 10 build/jam tidak berlaku untuk build via *custom GitHub Actions* yang digunakan proyek ini) |

## 10. Alur pengguna utama

**Belajar (via instance `dbApp`)** Daftar/masuk -> masukkan kode kelas (`classes/{code}`) -> pilih kursus -> buka modul -> tonton video -> tandai selesai -> modul berikutnya terbuka.

**Ujian resmi sinkron (via instance `dbExam`)** Siswa klik mulai di dalam jendela `[openAt, openAt + toleransiMulai]` (dokumen `starts/{uid}_{quizId}_{attemptNo}` ditulis dengan `startedAt == request.time` + snapshot `duration`, `closeAt`, `maxAttempts`, `quizVersion`, `keyVersion` + hasil shuffle dari PRNG deterministik `seed = hash(uid + quizId + quizVersion)`) -> klien **membaca-balik** `starts` untuk mendapatkan `startedAt` server dan menjalankan timer `startedAt + duration + 90s` -> soal dimuat selama `request.time in [openAt, closeAt]` dan dokumen `starts` ada -> selama pengerjaan, draft jawaban disimpan di `localStorage` -> siswa kirim jawaban ke **satu** dokumen `attempts/{uid}_{quizId}_{attemptNo}` berisi map `answers{questionId: optionId}` (create pertama, lalu update terbatas untuk melengkapi/retry selama `request.time <= startedAt + duration + 90s` DAN `request.time <= closeAt`, dengan retry backoff 3x dan indikator status terkirim eksplisit) -> guru klik "Nilai semua" per mapel -> hasil (`results/{uid}_{quizId}_{attemptNo}`, create-only) terbit + `leaderboard/{quizId}` (atau `leaderboard/current` setelah semua mapel dinilai) diperbarui -> siswa lihat nilai, pembahasan (`quizExplanations`), dan unduh sertifikat.

**Kuis latihan (via instance `dbApp`)** Buka kuis -> jawab di browser -> setelah submit, ambil kunci dari `quizKeysLatihan/{quizId}` -> skor instan dihitung lokal -> XP ditulis sekali di akhir sesi ke `progress/{uid}`.

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
- `classes/{code}`: `nama` (nama kelas), `mapel` (daftar mata pelajaran), `anggota[]` (array UID siswa anggota kelas). Gabung kelas memakai `arrayUnion` (1 write); keluar memakai `arrayRemove` (1 write)
- `courses/{id}`: judul dan daftar modul (1 dokumen) + **field `version`** (cache invalidation)
- `quizzes/{id}`: soal tanpa kunci (`questions[]` dalam 1 dokumen, 50 soal; tiap soal `questionId` + tiap opsi `optionId` stabil), `duration` (menit), `toleransiMulai` (menit), `maxAttempts` (default `1`), jadwal `openAt` dan `closeAt` (**`closeAt = openAt + toleransiMulai + duration + 90s`**), serta **field `version`**
- `quizKeys/{id}`: kunci ujian per `questionId` menyimpan **`optionId` stabil** (BUKAN huruf posisi; **hanya admin**) + **field `keyVersion`**
- `quizKeysLatihan/{quizId}` (Tahap kuis latihan): kunci jawaban kuis latihan yang **boleh dibaca siswa** hanya untuk menghitung skor lokal setelah submit (tidak dipakai untuk nilai resmi/leaderboard)
- `quizExplanations/{quizId}`: pembahasan tiap `questionId` untuk fitur F-12; dibaca siswa hanya setelah `results` miliknya terbit (aman dibocorkan setelah dinilai)
- `quizLocks/{quizId}`: **dokumen lock** (`lockedAt`) yang ditulis admin saat ujian dibuka. Keberadaannya membuat `quizzes/{id}` & `quizKeys/{id}` terkunci (immutability) — karena Firestore Rules tidak bisa query koleksi `starts`
- `starts/{uid}_{quizId}_{attemptNo}` (mis. `starts/u123_quiz45_1`): `startedAt` (= `request.time`), `quizId`, `attemptNo`, snapshot **`duration`, `closeAt`, `maxAttempts`, `quizVersion`, `keyVersion`**, susunan hasil shuffle dari **PRNG deterministik `seed = hash(uid + quizId + quizVersion)`**, serta **`expireAt`** (TTL). Semua snapshot divalidasi Security Rules terhadap `quizzes`/`quizKeys` saat create (lihat §12)
- `attempts/{uid}_{quizId}_{attemptNo}` (mis. `attempts/u123_quiz45_1`): **SATU dokumen per attempt** berisi map **`answers{questionId: optionId}`** (bukan dokumen per-`questionId`), `updatedAt`, `submitSeq`, ditambah `quizId`, `attemptNo`, dan `expireAt` (TTL). **Create + update terbatas** (hanya `answers`/`updatedAt`/`submitSeq`) selama jendela waktu — agar retry idempoten. `delete` ditolak
- `results/{uid}_{quizId}_{attemptNo}` (mis. `results/u123_quiz45_1`): skor resmi (ditulis admin, **create-only**, tanpa `serverTimestamp()` karena *field transform* dapat menambah operasi tertagih), ditambah `quizId`, `attemptNo`. Re-grading **hanya** via dokumen versi baru `results/{uid}_{quizId}_{attemptNo}_v2` (tidak ada `update` — create-only mutlak)
- `progress/{uid}`: modul selesai, XP, badge, streak (1 dokumen)
- `leaderboard/{quizId}` atau `leaderboard/current`: **dokumen agregat skor resmi** (ditulis admin, dibaca user login). Gunakan `leaderboard/{quizId}` per mapel ATAU tulis `leaderboard/current` **sekali** setelah seluruh mapel selesai dinilai (hindari *last-write-wins*). Hanya agregasi `results` resmi, **bukan** XP/badge
- `certificates/{id}`: nomor verifikasi, `uid`, `courseId` (atau `quizId`). Volume **1.000–1.800 dokumen** (1.000 bila 1 per siswa unik/kursus; 1.800 bila 1 per sesi mapel dari 6×300)

**Aturan Randomisasi, Kunci Jawaban, dan Immutability Soal:**
- **Jawaban dan kunci memakai `optionId` stabil:** Huruf A/B/C/D di layar hanya label urutan tampilan. Baik `attempts` (di dalam map `answers`) maupun `quizKeys` wajib menyimpan ID opsi yang stabil (mis. `opt_a`, `opt_b`).
- **PRNG deterministik:** Pengacakan urutan soal dan opsi di klien wajib memakai PRNG ber-seed deterministik (mis. mulberry32) dengan `seed = hash(uid + quizId + quizVersion)`, bukan `Math.random()`. Hasil urutan shuffle disimpan di `starts` saat ujian dimulai agar konsisten bila halaman dimuat ulang dan dapat diverifikasi.
- **Larangan edit soal/kunci saat ujian berlangsung (via `quizLocks`):** Saat admin membuka ujian, tulis `quizLocks/{quizId}`. Security Rules menolak `update` pada `quizzes/{id}` & `quizKeys/{id}` selama `exists(/quizLocks/$(quizId))`. Koreksi soal/kunci wajib menerbitkan versi baru (`quizzes/{id}_v2`, `quizKeys/{id}_v2`). Snapshot `quizVersion`, `duration`, `keyVersion` di `starts` menjamin siswa dinilai sesuai versi saat mulai.

**Cache Konten Statis & Retensi Data (Firestore TTL):**
- **Cache konten statis (WAJIB):** `courses` dan kuis latihan bersifat immutable setelah publish; simpan di `localStorage` beserta `version` dan muat ulang isi dokumen hanya jika `version` berubah. Untuk soal ujian resmi (`quizzes`), cache hanya di memori/sesi aktif selama ujian berlangsung agar bank soal tidak tersimpan permanen di perangkat siswa (catatan: karena 1 dokumen bank soal dipakai bersama, acak urutan di klien mencegah salin nomor urut, bukan anti-nyontek sebangku penuh).
- **Retensi penyimpanan 1 GiB (Firestore TTL):** Batas storage Spark **1 GiB**. `starts` dan `attempts` wajib menyertakan `expireAt` dan didaftarkan pada **Firestore TTL policy** (gratis di Spark tanpa Cloud Functions). Penghapusan TTL **tetap memotong kuota delete (20.000/hari)**. **Masa simpan wajib ≤ 30 hari** (bukan 90) karena `starts`+`attempts` = 3.600 dok/hari × 30 ≈ 108.000 dokumen (~200–350 MB) — dengan 90 hari mencapai ~324.000 dokumen (~650 MB–1 GB) yang berisiko menembus 1 GiB (lihat §13.5). TTL hanya untuk `starts`/`attempts`, bukan `results`/`users`/`certificates`. Aktifkan single-field index exemption pada field teks panjang di `quizzes`.

## 12. Keamanan dan privasi

- **Security Rules dan Firebase Auth sebagai garis pertahanan utama:** siswa hanya dapat membaca/menulis data miliknya sendiri, `quizKeys` hanya admin (`admins/{uid}`), dan validasi waktu dijaga di server melalui `request.time`.

- **Validasi snapshot `starts` (WAJIB — menutup lubang K1):** Security Rules pada create `starts/{uid}_{quizId}_{attemptNo}` **wajib** menegakkan SEMUA berikut, bukan sekadar membaca snapshot:
  - `request.auth.uid` == uid di ID dokumen, dan `request.resource.id == uid + '_' + quizId + '_' + string(attemptNo)` (cegah ID liar, lihat K9).
  - `request.resource.data.startedAt == request.time` (tidak bisa memundurkan/memajukan timer).
  - `request.time >= openAt && request.time <= openAt + toleransiMulai` (jendela mulai).
  - `request.resource.data.duration == get(/quizzes/$(quizId)).data.duration`.
  - `request.resource.data.closeAt == openAt + toleransiMulai + duration + 90s` (dihitung dari `quizzes`, bukan dari field bebas siswa).
  - `request.resource.data.maxAttempts == get(/quizzes/$(quizId)).data.maxAttempts`.
  - `request.resource.data.quizVersion == get(/quizzes/$(quizId)).data.version` dan `request.resource.data.keyVersion == get(/quizKeys/$(quizId)).data.keyVersion`.
  - Test Emulator wajib: siswa menulis `duration: 600` / `startedAt` dimundurkan / `closeAt` palsu → **DENIED**.

- **Model "Ujian Sinkron" dan Penyeragaman Deadline:**
  1. **Jendela mulai:** semua siswa WAJIB memulai di `[openAt, openAt + toleransiMulai]`. Pembuatan `starts` di luar jendela ditolak Rules. **Catatan latensi (S17):** klien sebaiknya mengunci tombol mulai pada `openAt + toleransiMulai - 10s` untuk memberi ruang latensi jaringan agar klik sah tidak ditolak server.
  2. **Timer per-siswa:** `startedAt + duration + 90s` (sudah termasuk toleransi jaringan 90 detik). Klien memperoleh `startedAt` dengan **membaca-balik** `starts` setelah create.
  3. **Rumus `closeAt` global:** `closeAt = openAt + toleransiMulai + duration + 90s`. Karena dihitung dari batas akhir `openAt + toleransiMulai`, jendela ini sudah memperhitungkan siswa paling telat, sehingga `startedAt + duration + 90s` tidak pernah melewati `closeAt`.
  4. **Gerbang baca soal (`quizzes/{id}`):** diizinkan selama `request.time >= openAt && request.time <= closeAt` **DAN** dokumen `starts/{uid}_{quizId}_{attemptNo}` (untuk `attemptNo` yang berlaku) sudah ada.
  5. **Gerbang tulis jawaban (`attempts`):** create **atau** update terbatas diizinkan selama **`request.time <= startedAt + duration + 90s` DAN `request.time <= closeAt`**.

- **Ketahanan pengiriman di klien (UI) & larangan offline persistence ujian:**
  - Alur ujian wajib memakai instance `dbExam` (memory cache, tanpa `persistentLocalCache`) agar tidak ada write tertahan di antrean offline.
  - Selama ujian, klien wajib menyimpan **draft jawaban di `localStorage`**, **retry otomatis 3x dengan exponential backoff**, dan menampilkan **state pengiriman eksplisit** (`Terkirim`, `Sedang mengirim...`, `Gagal terkirim - klik coba lagi`).

- **Aturan `attempts` (satu dokumen, create + update terbatas — menutup K7/K8):**
  - `attempts/{uid}_{quizId}_{attemptNo}` berisi map `answers{questionId: optionId}`. `delete` oleh siswa **ditolak**.
  - **Create** diizinkan bila dokumen belum ada (`!exists`), `request.auth.uid` == uid di ID, `request.resource.id == uid + '_' + quizId + '_' + string(attemptNo)`, `attemptNo == 1` (`maxAttempts=1` untuk ujian resmi), dan `request.time <= startedAt + duration + 90s && request.time <= closeAt`.
  - **Update** diizinkan **hanya** untuk field `answers`/`updatedAt`/`submitSeq` (`request.resource.data.diff(resource.data).affectedKeys().hasOnly(['answers','updatedAt','submitSeq'])`), `answers.size() <= 50`, dan masih dalam jendela waktu yang sama. Ini membuat retry idempoten: retry menimpa `answers` yang sama, bukan gagal `ALREADY_EXISTS`.
  - **`maxAttempts=1` permanen untuk ujian resmi** (menutup K8: attempt ke-2 mustahil karena jendela `starts` sudah tutup).

- **`results` create-only + revisi hanya via `_v2` (menutup S4):** `results/{uid}_{quizId}_{attemptNo}` bersifat **create-only mutlak** oleh admin (tidak ada `update`). Re-grading/revisi **hanya** lewat dokumen baru `results/{uid}_{quizId}_{attemptNo}_v2`. Agregasi leaderboard wajib **dedupe** per `uid_quizId` memilih `_v2` bila ada.

- **Aturan Batch Penilaian & Batas Access-Call:**
  - Firestore membatasi `writeBatch` maks **500 write/batch** DAN evaluasi Security Rules maks **10 access-call untuk single-document** serta **20 access-call untuk multi-document/transaksi/writeBatch**.
  - `get()`/`exists()` ke dokumen admin yang **SAMA** (`admins/{uid}`) di dalam satu `writeBatch` di-cache per request → **1 access-call** (bukan 300). Risiko menembus batas hanya bila Rules `results` memanggil `get()` ke dokumen BERBEDA per write (mis. `get(starts/{uid}_{quizId}_{attemptNo})` per siswa).
  - Rules `results` **hanya** memeriksa `exists(/admins/$(request.auth.uid))` (1 access-call per batch), tidak memanggil `get()` per-siswa.

- **App Check (reCAPTCHA v3 / Enterprise) mode monitor/opsional:** baik reCAPTCHA v3 (Essentials) maupun Enterprise hanya memberi **10.000 assessments/bulan** gratis. Untuk ~60.000/bulan akan terlampaui. **Kebijakan:** App Check mode monitor/opsional, keamanan utama sepenuhnya bersandar pada Firestore Rules + Firebase Auth. **Pertahanan tambahan terhadap penyalahgunaan kuota (S14):** batasi signup (verifikasi email untuk akun baru di luar sesi onboarding), pantau kuota harian, dan sediakan kill-switch operasional (nonaktifkan pendaftaran mandiri saat pekan ujian).

- **Leaderboard dan Gamifikasi:** `leaderboard/{quizId}`/`leaderboard/current` hanya ditulis admin dan **hanya** mengagregasi skor resmi `results`. XP/kuis latihan dapat dimanipulasi klien sehingga **tidak pernah** dipakai untuk nilai resmi/leaderboard.

- **Privasi dan Retensi Data:** data pribadi minimal (nama, kelas, email); `starts`/`attempts` dibersihkan via TTL `expireAt` (≤30 hari); penghapusan akun mengikuti kebijakan sekolah; persetujuan orang tua untuk siswa di bawah umur: [isi]; pengelolaan `admins/{uid}` (F-18) dilakukan admin via halaman admin (yang menulis ke `admins`), bukan hanya Firebase Console — **catatan S18: Rules `admins` wajib membatasi penulisan hanya oleh admin yang sudah ada (bootstrap admin pertama via Console)**.

## 13. Anggaran kuota (Spark)

Batas gratis harian Firestore Spark: **50.000 read**, **20.000 write**, **20.000 delete**, **1 GiB storage**, **10 GiB egress/bulan**.

> **Label Penting:** seluruh angka adalah **estimasi**. **Metode uji (dikoreksi — S11):** Firebase Emulator **hanya mengukur jumlah operasi** (read/write/delete per alur) dan validasi Rules — Emulator **tidak menegakkan** batas kuota Spark (50k/20k) maupun mensimulasikan 900 koneksi nyata. Penegakan kuota dan uji 900 concurrent **wajib** dilakukan di **project Firebase nyata** (dengan pemantauan Console) sebelum rilis; Emulator dipakai untuk menghitung operasi & menguji Rules.
> **Premis Beban & Model Ujian Sinkron:** kohort **1.000 akun unik**, beban ujian **6 mapel × 300 = 1.800 sesi/hari (~1,8 sesi/siswa)**, puncak **900 concurrent**. Model **ujian sinkron**: mulai di `[openAt, openAt + toleransiMulai]`, timer per-siswa `startedAt + duration + 90s`, `closeAt = openAt + toleransiMulai + duration + 90s`.

### 13.1 Tabel Hitung Ulang Transparan Harian (Ujian + Browsing + Operasional)

Asumsi eksplisit (seluruh angka diturunkan dari poin berikut):
1. **Rule-get muat soal:** baca `quizzes/{id}` memicu 1 `get(starts/{uid}_{quizId}_{attemptNo})` di Rules (= 2 read/sesi; `1.800 × 2 = 3.600`).
2. **Rule-get tulis `attempts`:** Rules memvalidasi waktu dari `starts` yang **sudah memuat `closeAt` + `maxAttempts`** (snapshot divalidasi saat create), jadi cukup 1 rule-get `starts` = `1.800 read` (min); *worst-case* bila Rules juga `get(quizzes/{id})` lintas dokumen = 2 read/sesi = `3.600`.
3. **Penilaian massal & rule-get baca `attempts`:** admin baca 1.800 `attempts` (query per `quizId`) + 6 `quizKeys` = `1.806 read`; rule-get `admins` = 6 → total `1.812 read` (min). *Worst-case* bila Rules `get(starts/...)` per dokumen = +1.800 → `3.612 read`. Tulis `results` = 300/batch × 6 = `1.800 write` (writeBatch N dok = N write). Hindari `serverTimestamp()` di batch `results`.
4. **Rebuild & baca leaderboard:** update `leaderboard/{quizId}` (6 write) atau `leaderboard/current` (1 write); dibangun di memori saat grading = 0 read tambahan, atau re-baca `results` = +1.800 read. Siswa baca 1×/sesi = `1.800 read` → total `1.800–3.600 read`.
5. **Baca & tulis `progress/{uid}`:** dibaca 1× per sesi/kunjungan (`1.800` sesi ujian + `1.000–2.000` sesi belajar = `2.800–3.800 read`). Tulis selesai modul (`1.000`) + XP kuis latihan (`1.000–2.000`) = `2.000–3.000 write`.
6. **Browsing harian (cache-on):** `1.000 akun × 3 buka × 1 read` cek versi = `3.000 read` (hingga `4.000` bila muat ulang) + `0–2.000` read kuis latihan = **`3.000–6.000 read`**.
7. **Browsing cache-off (cache invalid serentak):** `1.000 × 3 × 8` = **`24.000 read`** (konstanta tunggal; sama seperti v0.4).
8. **Onboarding `users` + gabung `classes` (LUAR hari ujian):** `1.000` create `users` + `1.000` `arrayUnion` `classes.anggota[]` = **`2.000 write`**, `0 read` (di hari ujian = 0).
9. **Sertifikat (LUAR hari ujian):** `1.000–1.800 write`, `0 read` (di hari ujian = 0).
10. **Baca operasional lain yang sebelumnya tak dianggarkan (S5):** login `users/{uid}` (`1.800`) + join `classes/{code}` (`1.000–1.800`) + **baca-balik `starts`** untuk timer (`1.800`) + halaman pembahasan `quizExplanations` (`0–1.800`, hanya bila dibuka) = **`4.600–7.200 read`** (di hari ujian sebagian tetap terjadi: login, join, baca-balik `starts`; pembahasan bisa 0 saat ujian).

| # | Komponen (1.000 akun, 1.800 sesi) | Read Cache-On | Read Cache-Off | Write Hari-H | Write Ekstrem* |
| --- | --- | --- | --- | --- | --- |
| 1 | Tulis `starts` + `attempts` (1.800×2) | 0 | 0 | 3.600 | 3.600 |
| 2 | Muat soal `quizzes` + rule-get `starts` (1.800×2) | 3.600 | 3.600 | 0 | 0 |
| 3 | Rule-get tulis `attempts` (`starts` [1.800] s.d. `starts+quizzes` [3.600]) | 1.800–3.600 | 1.800–3.600 | 0 | 0 |
| 4 | Grading: baca `attempts`(1.800)+`quizKeys`(6)+rule-get(`admins`[6] s.d. `starts`[1.800]); tulis `results` | 1.812–3.612 | 1.812–3.612 | 1.800 | 1.800 |
| 5 | Rebuild leaderboard (memori [0] s.d. re-baca `results` [1.800]) + siswa baca | 1.800–3.600 | 1.800–3.600 | 1–6 | 1–6 |
| 6 | Baca & tulis `progress/{uid}` (modul + XP 1 write/sesi) | 2.800–3.800 | 2.800–3.800 | 2.000–3.000 | 3.000 |
| 7 | Browsing kursus/modul + kuis latihan | 3.000–6.000 | 24.000 | 0 | 0 |
| 8 | Onboarding `users`+`classes` *(LUAR hari H)* | 0 | 0 | 0 *(luar H)* | 2.000 |
| 9 | Sertifikat *(LUAR hari H)* | 0 | 0 | 0 *(luar H)* | 1.800 |
| 10 | Baca operasional lain (login, join kelas, baca-balik `starts`, pembahasan) | 4.600–7.200 | 4.600–7.200 | 0 | 0 |
| — | **TOTAL READ** | **19.412–31.412 (39%–63%)** | **40.412–49.412 (81%–99%)** | — | — |
| — | **TOTAL WRITE** | — | — | **7.401–8.406 (37%–42%)** | **12.206 (61%)** |

> **TOTAL READ Cache-On** = `3.600 + 1.800 + 1.812 + 1.800 + 2.800 + 3.000 + 4.600 = 19.412` (min); `3.600 + 3.600 + 3.612 + 3.600 + 3.800 + 6.000 + 7.200 = 31.412` (max). Persen: `19.412/50.000 = 38,8%`; `31.412/50.000 = 62,8%`.
> **TOTAL READ Cache-Off** = hanya baris 7 berubah (3.000–6.000 → 24.000): min `19.412 − 3.000 + 24.000 = 40.412` (80,8%); max `31.412 − 6.000 + 24.000 = 49.412` (98,8%). **Cache-off worst-case hampir menyentuh batas keras 50.000** — ini alasan cache konten WAJIB dan pre-warm H-1.
> **TOTAL WRITE Hari-H** = `3.600 + 1.800 + (1..6) + (2.000..3.000) = 7.401–8.406` (37,0%–42,0%). **TOTAL WRITE Ekstrem\*** = hari-H max `8.406` + onboarding `2.000` + sertifikat `1.800` = `12.206` (61,0%).

**Catatan Analisis Tabel & Gate Rilis:**
- **\*Kolom "Write Ekstrem" = onboarding + sertifikat + ujian pada hari yang sama → `12.206` (61%) MELAMPAUI gate 12.000. Karena itu onboarding & sertifikat WAJIB dijadwalkan di hari terpisah dari ujian (bukan sekadar "di luar hari H" di label — kolomnya kini konsisten: nilai hari ujian untuk baris 8/9 = 0).** Jika terpaksa digabung, kuota write harian jebol.
- **Koreksi aritmetika v0.4:** baris 4 max sebelumnya `3.606` (salah) → benar **`3.612`** (`1.812 + 1.800`); total max Cache-On v0.4 `24.206` → **`24.212`** (sebelum penambahan baris 10). Persentase `14.812/50.000 = 29,6%` (v0.4 menulis "30%" — pembulatan ke atas; kini angka eksplisit dipakai).
- **Transparansi (S5):** v0.4 tidak menganggarkan login `users`, join `classes`, baca-balik `starts`, dan pembahasan; v0.5 menambahkannya sebagai baris 10 (`4.600–7.200 read`), sehingga total jujur naik dari ~30% ke ~39% (min).
- **Empat optimasi wajib (menjaga Cache-On tetap di batas bawah ~19.412 / 39%):** (1) snapshot `duration`+`closeAt`+`maxAttempts` di `starts` agar tulis `attempts` cukup 1 rule-get; (2) cek `admins/{uid}` saja saat baca `attempts`/tulis `results`; (3) bangun leaderboard di memori saat grading; (4) bekukan revisi `courses` selama hari ujian (pre-warm H-1).

### 13.2 Aturan Hemat Kuota (WAJIB)

1. **Cache konten statis (`courses`, latihan) di `localStorage` + `version`:** potong read browsing dari 24.000 ke 3.000–6.000. Pre-warm perubahan konten pada H-1.
2. **Soal ujian = 1 dokumen (`quizzes/{id}.questions[]`):** bukan subcollection per-soal.
3. **XP = 1 write per sesi:** digabung ke `progress/{uid}` di akhir sesi.
4. **Leaderboard = dokumen agregat:** dibangun di memori saat grading, bukan query `results` oleh siswa.
5. **Nol realtime listener:** `getDoc`/`getDocs` sekali, **bukan `onSnapshot`**.
6. **Grading batch sadar kuota:** baca `attempts` per `quizId`, hitung di memori, tulis `results` via `writeBatch` (N dok = N write; hindari `serverTimestamp()`).
7. **`progress` dibaca sekali/sesi.**
8. **Snapshot `duration`+`closeAt`+`maxAttempts` di `starts` & rule admin sederhana:** agar Rules tidak `get()` berantai.
9. **`attempts` = 1 dokumen map `answers` (bukan per-soal):** hemat write & read grading drastis (vs 50 dok/sesi).

### 13.3 Waktu Reset Kuota Harian (Mengikuti DST)

- Reset kuota harian Firestore = tengah malam Pasifik (`00:00 America/Los_Angeles`), bergeser mengikuti **DST**: **14:00 WIB** (PDT/UTC-7) atau **15:00 WIB** (PST/UTC-8), rentang **14:00–15:00 WIB**.
- **Aturan Penjadwalan (dikoreksi — S1):** satu sesi memakan `toleransiMulai + duration + 90s` (mis. 15 + 90 + 1,5 ≈ **106,5 menit**). Larangan ">60 menit sebelum reset" pada v0.4 **salah**. **Wajib:** tidak ada sesi yang **mulai** dalam **≥ 107 menit** sebelum jendela reset (≈ tidak ada start setelah **12:13 WIB**; gunakan 120 menit untuk margin aman). Dengan begitu sesi terlama tidak melintasi reset 14:00.

### 13.4 Batas Firebase Auth (Spark) dan Rencana Pembuatan Akun

> **Catatan Sumber & Tanggal Akses:** angka batas di bawah mengacu halaman **Firebase Authentication Limits** per **16 November 2026** dan **dapat berubah sewaktu-waktu**. Klaim signup 100/jam/IP berlaku **khusus sisi-klien**.

| Jenis Operasi Firebase Auth (Spark) | Batas Kuota Gratis | Dampak & Solusi pada 1.000 Siswa |
| --- | --- | --- |
| Reset sandi | **150 email/hari** | Reset massal hari ujian tertahan ke-150; uji login H-2 atau reset via Admin SDK |
| Verifikasi email | **1.000 email/hari** | Pas-pasan; jangan wajibkan verifikasi pagi hari ujian |
| Login tautan email | **5 email/hari** | **Tidak bisa dipakai**; gunakan Email/Password atau Google Sign-In |
| Pembuatan akun (signup) | **100 akun/jam/IP** *(khusus sisi-klien)* | Signup mandiri 1.000 siswa dari 1 IP WiFi → akun ke-101+ ditolak. **Solusi:** (a) buat via **Firebase Admin SDK/server-side** (bebas kuota per-IP) — jalur utama & paling pasti; (b) bila Console menyediakan setelan kuota signup, naikkan sementara (perlu diverifikasi — **tidak semua project/plan punya setelan self-service ini**, jangan dijadikan satu-satunya andalan); (c) daftar bertahap per kelas/jaringan seluler |
| Tier 1 DAU | **3.000/hari** | Aman untuk 1.000 siswa + guru/admin |

**Rencana Pembuatan Akun & Mitigasi (WAJIB):**
1. **Jalur utama = Firebase Admin SDK (server-side/lokal admin) dari CSV data siswa pada H-7 s.d. H-2** — bebas kuota per-IP. Prasyarat: service account key (dikelola admin, tidak di-deploy ke klien).
2. Bila Console menyediakan penaikan kuota signup, boleh dipakai sebagai pelengkap, tetapi **bukan andalan tunggal** (ketersediaan setelan tidak dijamin).
3. **Jangan** aktifkan email-link sign-in (5/hari) dan jangan paksa verifikasi email pagi hari ujian.
4. **Manajemen lupa sandi:** uji login serentak H-2 atau reset via Admin SDK (email reset 150/hari).

## 14. UX dan UI

- Mobile first, tombol besar, navigasi sederhana.
- Halaman: beranda, daftar kursus, halaman modul, kuis/ujian, hasil, profil, sertifikat, admin.
- Panduan gaya: [logo, warna utama, font, tone bahasa]. Wireframe: [tautan/lampiran].
- **UX Ketahanan Ujian (Wajib):**
  - Tampilkan jendela mulai `[openAt, openAt + toleransiMulai]` dan timer per-siswa. Timer dihitung dari `startedAt` (server) **+ duration + 90s** — **samakan makna dengan Rules** (jangan hanya `startedAt + duration`).
  - Setiap perubahan jawaban disimpan sebagai **draft di `localStorage`**.
  - Saat kirim: tampilkan status eksplisit (`Sedang mengirim...` → `Jawaban Berhasil Terkirim` + waktu, atau `Gagal Terkirim - Mencoba ulang (1/3)...`).
  - **Retry otomatis 3x exponential backoff** bila jaringan terganggu, selama `request.time <= startedAt + duration + 90s` DAN `<= closeAt`.
  - Tombol mulai dikunci 10s sebelum `openAt + toleransiMulai` untuk ruang latensi (S17).

## 15. Analitik dan pemantauan

- Pantau read/write/delete Firestore serta kuota Auth di Firebase Console **setiap hari** saat pekan ujian.
- **Alarm relatif (dikoreksi — M9):** karena hari Cache-Off normal sudah ~81–99%, alarm statis "70%" akan selalu menyala. Gunakan alarm **berbasis Cache-On** (waspada bila Cache-On > 60% = 30.000 read, atau bila cache-off terdeteksi aktif) dan siapkan tindakan: paksa pre-warm cache, tunda gelombang non-kritis, nonaktifkan fitur browsing.
- Metrik produk: siswa aktif, penyelesaian modul, rata-rata skor, rasio error sesi ujian (`starts` tanpa `attempts` valid).
- Log kesalahan klien (opsional: gagal muat soal / gagal kirim jawaban).

## 16. Rilis dan roadmap

| Fase | Isi | Target |
| --- | --- | --- |
| 1. Fondasi & Akun | Project Firebase, Auth, `classes/{code}`, deploy GitHub Pages (`base:'/nama-repo/'`+`404.html`), provisioning 1.000 akun via Admin SDK (utama) | [tanggal] |
| 2. Konten & Cache | Kursus, video, progress (`dbApp` persist), cache `localStorage`+`version`, bank soal 6 mapel × 50 soal (`optionId` stabil) | [tanggal] |
| 3. Ujian Sinkron Aman | `dbExam` (tanpa persist), `starts` (mulai `[openAt,openAt+toleransiMulai]`, snapshot **divalidasi** `duration/closeAt/maxAttempts/quizVersion/keyVersion`, PRNG) -> `attempts` **satu dokumen map `answers`** (create+update terbatas, draft+retry), `quizLocks`, Rules `closeAt`, TTL ≤30 hari, uji Rules di Emulator + operasi di project nyata | [tanggal] |
| 4. Admin & Grading | Penilaian massal (`writeBatch` ≤500 & ≤20 access-call, `results` create-only tanpa `serverTimestamp`, revisi `_v2`), rekap per kelas/kuis, ekspor CSV, update `leaderboard` | [tanggal] |
| 5. Pengayaan (Tahap 2) | Sertifikat PDF (jsPDF), XP, badge, streak, halaman leaderboard siswa | [tanggal] |
| Pilot | 20–30 siswa, lalu simulasi beban 30→900 concurrent di **project nyata** (Emulator hanya untuk operasi/Rules) | [tanggal] |
| Peluncuran | 1.000 siswa, ujian bergelombang per kelas di luar jendela reset DST (tidak mulai ≥107 menit sebelum 14:00 WIB) | [tanggal] |

## 17. Pengujian dan kriteria penerimaan

- **Uji Firebase Emulator (Security Rules & jumlah operasi):**
  - Siswa tidak bisa membaca `quizKeys` maupun `quizKeysLatihan` sebelum submit.
  - **Mulai ujian (`starts`):** hanya bisa create jika `request.time` di `[openAt, openAt + toleransiMulai]` **DAN** semua snapshot valid. **Uji negatif wajib:** `duration:600`, `startedAt` dimundurkan, `closeAt` palsu, `attemptNo` di ID tak cocok field → **DENIED** (K1/K9).
  - **Baca soal (`quizzes`):** hanya jika `request.time in [openAt, closeAt]` (`closeAt = openAt + toleransiMulai + duration + 90s`) DAN `starts/{uid}_{quizId}_{attemptNo}` ada (untuk `attemptNo` berlaku).
  - **Tulis jawaban (`attempts`):** create + update terbatas (hanya `answers`/`updatedAt`/`submitSeq`); `delete`/`update` field lain **DENIED**; di luar `request.time <= startedAt + duration + 90s && <= closeAt` **DENIED**; `attemptNo==2` **DENIED**; ID `_B/_C` (tidak cocok field) **DENIED**.
  - **Immutability:** setelah `quizLocks/{quizId}` ada, `update` pada `quizzes`/`quizKeys` **DENIED**.
  - Siswa tidak bisa menulis `results`/`leaderboard`; admin menulis `results` create-only dalam batch ≤500 write & ≤20 access-call.
- **Uji Randomisasi & Grading:** jawaban & kunci pakai `optionId` stabil (bukan huruf posisi); urutan PRNG `seed = hash(uid + quizId + quizVersion)` konsisten saat refresh.
- **Uji Dua Instance & Resiliensi UI:** `dbExam` tanpa offline persistence; draft di `localStorage`; retry backoff 3x saat jaringan diputus.
- **Uji XP & Leaderboard:** XP 1 write/sesi; leaderboard hanya dari dokumen agregat `results` resmi.
- **Uji Cache:** `version` berubah → konten muat ulang; tetap → 0 read isi konten (maks 1 read cek versi).
- **Uji Perangkat:** HP Android/iOS (≥360 px), Chrome, Safari, Firefox.
- **Uji kuota & 900 concurrent:** di **project nyata** dengan pemantauan Console (bukan Emulator) — S11.
- **Kriteria Rilis (Wajib Lulus):**
  1. Semua fitur Wajib lulus uji fungsional & Security Rules di Emulator.
  2. **Kuota read/write (CACHE AKTIF):** uji beban hari ujian penuh dengan cache-on; jalur ujian diuji hingga worst-case. **Target lulus = TOTAL READ Cache-On `19.412–31.412` (39%–63%) dan TOTAL WRITE Hari-H `7.401–8.406` (37%–42%)**, dengan **batas keras** ≤ 50.000 read / ≤ 20.000 write per hari. **Cache-off worst-case (`40.412–49.412`, 81%–99%) adalah risiko yang diterima** hanya bila cache discipline & pre-warm H-1 terbukti; bila tidak, tunda rilis.
  3. **Delete & storage (S13):** delete harian (termasuk TTL) ≤ 20.000; storage total ≤ 1 GiB (diverifikasi dari hitungan `starts`+`attempts` TTL ≤30 hari).
  4. **Onboarding & sertifikat WAJIB di hari terpisah dari ujian** (kolom ekstrem 61% melampaui gate write 12.000).
  5. **Reliabilitas ujian:** rasio error sesi = (gagal muat soal atau gagal kirim) / total sesi dimulai **< 1%**, diukur pada uji **≥300 sesi** (bukan 20–30, karena 30 sesi tak bisa memvalidasi <1% — S12).

## 18. Asumsi, dependensi, dan risiko

**Asumsi**
- Semua siswa punya perangkat & koneksi internet saat ujian.
- Guru bersedia menjalankan penilaian massal setelah sesi ujian selesai.
- Pembuatan akun dilakukan sebelum hari ujian (utama: Admin SDK).
- Sertifikat diterbitkan **1.000–1.800 dokumen** (1.000 per siswa/kursus; 1.800 per sesi mapel).
- Onboarding & sertifikat dijadwalkan **di luar hari ujian**.

**Dependensi**
- Firebase Spark (Auth & Firestore), GitHub Pages + GitHub Actions, YouTube.

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Snapshot `starts` dipalsukan siswa | Timer/`closeAt` tak berlaku, curang | Rules memvalidasi `startedAt==request.time`, `duration/closeAt/maxAttempts/quizVersion/keyVersion` vs `quizzes`/`quizKeys` (K1) |
| Kuota Firestore harian habis | `RESOURCE_EXHAUSTED`, layanan berhenti | Cache konten WAJIB + pre-warm H-1; pantau Cache-On; cache-off worst-case ~99% → disiplin cache ketat |
| Cache-off worst-case (81–99% read) | Hampir menyentuh 50.000 | Pre-warm H-1, bekukan revisi `courses` selama ujian, alarm relatif |
| Onboarding+sertifikat+ujian di hari sama | Write 61% > gate 12.000 | Jadwalkan onboarding & sertifikat di hari terpisah (WAJIB) |
| Batas Auth: signup 100/jam/IP & reset 150/hari | Gagal daftar/reset massal | Utama: Admin SDK; jangan andalkan kuota Console; uji login H-2; tanpa email-link |
| App Check lewat kuota gratis (10.000/bln) | Bot tak terbedakan / butuh billing | Mode monitor/opsional; keamanan di Rules+Auth; batasi signup + kill-switch |
| Offline persistence menunda write `attempts` | Jawaban ditolak Rules, hilang | 2 instance (`dbApp` persist, `dbExam` memory) + retry + draft `localStorage` |
| Deadline baca vs tulis tak sinkron | Siswa terlambat kena read-block | Model ujian sinkron `closeAt = openAt+toleransiMulai+duration+90s`; baca `[openAt,closeAt]`, tulis `startedAt+duration+90s && <=closeAt` |
| `attempts` create-only mematikan retry | Retry kena `permission-denied`/`ALREADY_EXISTS` | Satu dokumen map `answers` + **create+update terbatas** (K7) |
| `attemptNo` tak terikat / attempt liar | Attempt tak terbatas, pilih nilai terbaik | `maxAttempts=1`; ID == `uid_quizId_attemptNo` di Rules (K8/K9) |
| "quizKeys tak boleh diedit setelah ada starts" tak bisa di Rules | Nilai tak konsisten | `quizLocks/{quizId}` (K5) |
| `results` create-only + field `revision` mustahil | Bingung revisi | Create-only mutlak; revisi hanya `_v2`; leaderboard dedupe (S4) |
| Storage 1 GiB penuh | Penulisan baru gagal | TTL ≤30 hari; hitung storage (lihat §13.5) |
| Egress 10 GiB/bulan / gambar base64 | Jebol kuota | Soal hanya teks, **dilarang** gambar base64 (S9) |
| Reset kuota DST | Ujian terputus saat pergantian hari | Tidak mulai ≥107 menit sebelum reset 14:00 WIB |
| Deploy GitHub Pages gagal / SPA 404 | Halaman ujian tak terbuka | Vite `base:'/nama-repo/'`, `404.html`, build ≤10 menit (soft limit 10/jam tidak berlaku utk custom Actions) |

### 13.5 Estimasi Storage & Egress (baru — S8/S9)

- **Storage:** `starts`+`attempts` = 3.600 dok/hari. TTL **30 hari** → ~108.000 dokumen (~200–350 MB) **aman**; TTL 90 hari → ~324.000 dokumen (~650 MB–1 GB) **berisiko menembus 1 GiB**. **Keputusan: TTL ≤30 hari.** `results` tanpa TTL tumbuh ~324.000/tahun — pantau; bila perlu terapkan TTL lebih panjang pada `results` setelah nilai difinalisasi/arsip.
- **Egress:** 1.800 sesi × dokumen soal 50 soal (~40 KB teks) ≈ 72 MB/hari (~2 GB/bulan) — aman di 10 GiB. **Bila soal memuat gambar base64** (karena tanpa Cloud Storage), satu gambar 100 KB × 50 soal × 1.800 sesi = langsung jebol → **wajib soal teks saja** (S9).

## 19. Pertanyaan terbuka

- Metode pembuatan 1.000 akun: **Admin SDK (disarankan)** vs penaikan kuota Console (bila tersedia) vs pendaftaran bertahap?
- Apakah seluruh siswa punya akun Google sekolah (hindari limit verifikasi 1.000/hari & reset 150/hari)?
- Nilai `toleransiMulai` standar (15 atau 30 menit)? `maxAttempts` selalu `1` untuk ujian resmi?
- ~~Durasi & jumlah soal tipikal?~~ → **Asumsi tetap: 50 soal/mapel, ~90 menit/mapel** (1 dokumen `quizzes`).
- Sertifikat 1 per kursus (1.000) atau 1 per sesi mapel (1.800)? `leaderboard` per mapel atau gabungan `leaderboard/current`?
- Masa simpan (`expireAt`) `starts`/`attempts` setelah `results` terbit (disarankan ≤30 hari untuk storage)?
- Skema pembahasan (`quizExplanations`) & kunci latihan (`quizKeysLatihan`): siapa yang menyusun & kapan dibuka ke siswa?
- Kebijakan persetujuan orang tua untuk siswa di bawah umur: [isi].

## 20. Lampiran

- Spesifikasi teknis lengkap & Security Rules (`spec tech.md`) — **wajib menyertakan rule validasi snapshot `starts` (K1), create+update terbatas `attempts` (K7), binding ID (K9), dan `quizLocks` (K5)**.
- Daftar kebutuhan sistem (`requirements.md`)
- Wireframe dan panduan gaya
- Contoh format CSV rekap nilai (filter `classCode` dan `quizId`)
- Template sertifikat
