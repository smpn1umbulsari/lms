# PRD LMS Interaktif

Versi 0.7 (patched) - 16 November 2026 - Pemilik produk: [isi nama]

> **Changelog v0.6 -> v0.7 (16 November 2026) — hasil audit independen agy ronda-2 (`audit-v06-agy.out`, vonis REJECT; semua temuan divalidasi & benar):**
> 1. **K-BARU-09 — Aritmetika waktu CEL diperbaiki:** `Timestamp + int` **tidak valid** (Firestore Rules hanya kenal `Timestamp + Duration`). Semua `openAt + toleransiMulai*60` / `startedAt + duration*60` diganti `+ duration.value(n,'m')` + `duration.value(90,'s')`.
> 2. **K-BARU-10 — `attempts` update baca field hantu diperbaiki:** jendela waktu `update` kini dibaca dari `get(.../starts/$(attemptId)).data` (**bukan** `resource.data.closeAt/startedAt/duration` yang tak ada di dokumen `attempts`) → retry idempoten benar-benar jalan.
> 3. **K-BARU-11 — Akses admin ditambahkan:** `isAdmin()` diberi guard `request.auth != null`; `|| isAdmin()` ditambahkan di `allow read` `starts/attempts/results/quizzes/users` → guru bisa grading & ekspor CSV.
> 4. **K-BARU-12 — Blok `match /progress/{uid}` & `match /admins/{uid}` ditambahkan** (sebelumnya hilang → progress/XP/gamifikasi mati).
> 5. **K-BARU-13 — Deadlock metadata dihapus:** metadata jadwal ringkas (`quizId, openAt, toleransiMulai, duration, closeAt, version`) ditulis ke `classes/{code}.quizzes` (readable, tanpa soal) → siswa menyusun `starts` tanpa membaca `quizzes` lebih dulu.
> 6. **S-BARU-08 — `kelas` immutable oleh siswa:** `users` update hanya `nama/updatedAt`; ubah `kelas` hanya admin → cegah siswa ikut 6 mapel.
> 7. **S-BARU-09 — `expireAt` divalidasi** = `closeAt + duration.value(30,'d')` di `starts` & `attempts` (TTL 30 hari ditegakkan server).
> 8. **K-BARU-03 sisa ditutup:** `results` kini `create+update` admin (revisi in-place via `revisionNo`/`updatedAt`), menghapus mekanisme `_v2` (tak ada baca ganda `_1`+`_1_v2`).
> 9. **Aritmetika §13.1 dikoreksi:** READ **18.210–20.010 (36,4%–40,0%)** (worst 21.810), WRITE **7.586–8.586 (37,9%–42,9%)**, ekstrem write **12.386 (61,9%)** — sudah termasuk rule-get `admins` (6 mapel) & margin retry 10%.
>
> **Changelog v0.5 -> v0.6 (16 November 2026) — hasil audit independen agy (Gemini 4 Argon High):**
> Perbaikan menutup 8 temuan KRITIS baru (K-BARU-01..08) + 7 SEDANG (S-BARU-01..07) yang membuat v0.5 **tidak layak implementasi**. Ringkas:
> 1. **K-BARU-01 — Sintaks Security Rules diperbaiki (v0.5 gagal compile):** `request.resource.id` **tidak ada** di Firestore Rules (objek `Resource` hanya punya `.data` dan `.__name__`); diganti variabel wildcard `match /starts/{startId}` + `match /attempts/{attemptId}` dan binding `startId == request.auth.uid + '_' + request.resource.data.quizId + '_1'`. Wildcard **satu segmen penuh** (bukan `{uid}_{quizId}_{attemptNo}` yang mustahil). Semua `get()`/`exists()` memakai path penuh `/databases/$(database)/documents/...`.
> 2. **K-BARU-02 — Hidden read ditutup, kuota read diaudit ulang:** hapus `get(quizKeys)` dari validasi `starts` (kunci immutable, tak perlu); cukup **1 rule-get `quizzes`** (dipakai ganda → tetap 1 access-call karena di-cache dalam 1 evaluasi). Browsing **dipindah ke bundle statis** (lihat #4) sehingga **0 read Firestore**.
> 3. **K-BARU-03 — Baca `results` & `quizExplanations` dianggarkan tanpa rule-get:** `quizExplanations/{quizId}` menyimpan field `closeAt` sendiri → gerbang baca `request.time > resource.data.closeAt` (0 access-call, bukan `exists(results)` per siswa). Baca `results` siswa dianggarkan eksplisit.
> 4. **K-BARU-04 — Deadlock `quizKeysLatihan` dihapus:** kuis latihan (beserta kuncinya) adalah **konten statis** di bundle GitHub Pages — bukan koleksi Firestore, tak bernilai resmi, jadi tak ada "tak boleh baca sebelum submit" yang mustahil. `quizKeysLatihan` **dihapus** dari skema.
> 5. **K-BARU-05 — Idempotensi retry `attempts` diperbaiki:** `expireAt` **deterministik** (`closeAt + 30 hari`, dihitung klien identik tiap retry); validasi `hasOnly` + `answers.size() <= 50` diterapkan pada **create DAN update**; retry pakai `setDoc(..., {merge:true})` dengan `expireAt` sama → tak masuk `affectedKeys` → idempoten.
> 6. **K-BARU-06 — `quizLocks` dihapus, ganti native `openAt`:** `quizzes` menolak `update`/`delete` bila `request.time >= resource.data.openAt` (0 access-call, tanpa race); `quizKeys` menolak bila `request.time >= get(quizzes).openAt`. Dokumen lock manual dihapus.
> 7. **K-BARU-07 — `attemptNo` jujur:** `maxAttempts = 1` **permanen** untuk ujian resmi, jadi `attemptNo` selalu `1` → gerbang `quizzes` memakai `exists(starts/{uid}_{quizId}_1)`; klaim "attemptNo variabel" yang menyesatkan dihapus.
> 8. **K-BARU-08 — `serverTimestamp()` dirangkul:** `startedAt: serverTimestamp()` **wajib** (agar `startedAt == request.time` benar) dan **tidak menambah write** (M-BARU-04); hapus langkah "baca-balik `starts`" (hemat 1.800 read) — timer klien jalan dari jam lokal setelah `setDoc` resolve (akurasi ~1 dtk, toleransi 90 dtk).
> 9. **S-BARU-01 — Keamanan keanggotaan & sertifikat:** keanggotaan kelas dipindah ke field `users/{uid}.kelas` (ditulis admin/self-set saat signup, divalidasi `get(classes).exists`); `classes/{code}` **admin-only write** (hapus `arrayUnion`/`arrayRemove` yang bisa disabotase). `certificates/{id}` **admin-only write**; halaman verifikasi publik read-only.
> 10. **Aritmetika §13.1 dihitung ulang jujur:** READ hari ujian **18.012–19.812 (36%–40%)** (browsing = 0 read karena statis); WRITE hari-H **7.406–8.406 (37%–42%)**; ekstrem **12.206 (61%)** — masih < batas keras 20.000, jadi onboarding/sertifikat **boleh** hari sama (margin), tapi tetap disarankan terpisah.
> 11. **S-BARU-03 DST, S-BARU-06 alarm, S-BARU-07 uji beban** dikoreksi (lihat §13.3, §15, §17).
>
> **Changelog v0.4 -> v0.5 (16 November 2026):** (dipertahankan) K1–K9 + S terpilih.
> **Changelog v0.3 -> v0.4 (16 November 2026):** (dipertahankan) gate rilis & tabel kuota; model ujian sinkron.
> **Changelog v0.2 -> v0.3 / v0.1 -> v0.2:** (dipertahankan) lihat v0.5.

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

- Login dan pendaftaran dengan kode kelas (`classes/{code}`); keanggotaan disimpan di `users/{uid}.kelas`
- Halaman kursus, modul berurutan, video YouTube (konten dari **bundle statis**, lihat §11)
- Progress per modul
- Kuis latihan instan (konten + kunci dari **bundle statis**; skor lokal; XP 1 write/sesi)
- Ujian resmi sinkron: mulai dalam `[openAt, openAt + toleransiMulai]` (`starts/{uid}_{quizId}_1` dengan snapshot versi, durasi, `closeAt`, `maxAttempts=1`), kerjakan (acak PRNG ber-seed), kirim (**satu** dokumen `attempts/{uid}_{quizId}_1` berisi map `answers{questionId: optionId}`), dinilai guru (`results/{uid}_{quizId}_1`)
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
| F-02 | Bergabung ke kelas dengan kode kelas; keanggotaan ditulis ke `users/{uid}.kelas` (validasi `classes/{code}` ada) | Wajib |
| F-03 | Daftar kursus dan modul, modul terkunci berurutan (konten dari bundle statis) | Wajib |
| F-04 | Tampilkan video YouTube dan bacaan per modul | Wajib |
| F-05 | Tombol "selesai" modul dan progress bar | Wajib |
| F-06 | Kuis latihan dengan skor instan (konten + kunci di bundle statis; XP ditulis **sekali per sesi**) | Wajib |
| F-07 | Ujian resmi (model **ujian sinkron**): siswa wajib mulai dalam `[openAt, openAt + toleransiMulai]`; catat waktu mulai di server (`starts/{uid}_{quizId}_1`) dengan `startedAt: serverTimestamp()` + snapshot **`duration`, `closeAt`, `maxAttempts`, `quizVersion`, `keyVersion`**; jadwal tutup global **`closeAt = openAt + toleransiMulai + duration + 90s`** | Wajib |
| F-08 | Kirim jawaban ujian ke **satu** dokumen `attempts/{uid}_{quizId}_1` berisi map **`answers{questionId: optionId}`** + `updatedAt` + `submitSeq` + `expireAt` (deterministik); aturan **create + update terbatas** (hanya `answers`/`updatedAt`/`submitSeq`) selama `request.time <= closeAt` DAN `request.time <= startedAt + duration + 90s`; `maxAttempts=1` | Wajib |
| F-09 | Acak urutan soal dan pilihan per siswa di klien (**gratis kuota**) memakai **PRNG deterministik** `seed = hash(uid + quizId + quizVersion)`; urutan **diregenerasi dari seed**, TIDAK disimpan di `starts` | Penting |
| F-10 | Admin: buat kuis dan atur jadwal (`openAt`, `toleransiMulai`, `duration`, `closeAt`). Setelah `openAt`, `quizzes`/`quizKeys` otomatis terkunci via Rules (`request.time >= openAt`); koreksi wajib terbitkan versi baru `quizzes/{id}_v2` | Wajib |
| F-11 | Admin: penilaian massal (`results/{uid}_{quizId}_1` create+update admin) + update dokumen agregat `leaderboard/{quizId}` atau `leaderboard/current` sekali setelah semua mapel dinilai | Wajib |
| F-12 | Siswa melihat hasil dan pembahasan (pembahasan dibaca dari `quizExplanations/{quizId}`, terpisah dari `quizKeys`, hanya terbuka setelah `request.time > closeAt`) | Wajib |
| F-13 | Ekspor rekap nilai ke CSV (dapat difilter per kelas dan `quizId`) | Wajib |
| F-14 | XP, badge, streak (XP = 1 write/sesi) | Penting |
| F-15 | Leaderboard dibaca dari dokumen agregat (`leaderboard/{quizId}` atau `leaderboard/current`), **bukan** query `results`, dan **hanya** mengagregasi `results` resmi (bukan XP/badge) | Opsional |
| F-16 | Sertifikat PDF (jsPDF) dengan nomor verifikasi | Penting |
| F-17 | Halaman verifikasi sertifikat publik (read-only) | Penting |
| F-18 | Pengelolaan peran admin/guru (`admins/{uid}`) | Wajib |
| F-19 | Admin: buat dan kelola dokumen kelas (`classes/{code}` berisi nama, mapel, roster; **admin-only write**) | Wajib |

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

**Belajar (via instance `dbApp`)** Daftar/masuk -> masukkan kode kelas (validasi `classes/{code}` ada, lalu tulis `users/{uid}.kelas`) -> pilih kursus -> buka modul -> tonton video -> tandai selesai -> modul berikutnya terbuka. **Konten kursus/modul/kuis-latihan dimuat dari bundle statis GitHub Pages** (0 read Firestore).

**Ujian resmi sinkron (via instance `dbExam`)** Siswa klik mulai di dalam jendela `[openAt, openAt + toleransiMulai]` -> klien `setDoc(starts/{uid}_{quizId}_1)` dengan `startedAt: serverTimestamp()` + snapshot `duration`, `closeAt`, `maxAttempts`, `quizVersion`, `keyVersion`; Rules memvalidasi tiap field terhadap `quizzes`/`quizKeys` dan memaksa `startedAt == request.time`; metadata `duration`/`closeAt`/`version` dibaca dari `classes/{code}.quizzes` (di-cache `dbApp`, bukan dari `quizzes`) - menutup deadlock K-BARU-13 -> **timer klien dijalankan dari jam lokal saat `setDoc` resolve** (`startedAt_local + duration + 90s`; tak ada baca-balik `starts`) -> urutan soal diregenerasi dari PRNG `seed = hash(uid + quizId + quizVersion)` -> soal (`quizzes/{id}`) dimuat selama `request.time in [openAt, closeAt]` DAN `starts` ada -> draft jawaban di `localStorage` -> kirim ke **satu** dokumen `attempts/{uid}_{quizId}_1` berisi map `answers{questionId: optionId}` (create pertama; retry via `setDoc(...,{merge:true})` dengan `expireAt` deterministik = `closeAt + 30 hari`, selama `request.time <= startedAt + duration + 90s` DAN `<= closeAt`, backoff 3x) -> guru klik "Nilai semua" per mapel -> `results/{uid}_{quizId}_1` (create+update admin) terbit + `leaderboard/{quizId}` (atau `leaderboard/current`) diperbarui -> siswa lihat nilai (`results`), pembahasan (`quizExplanations`, terbuka setelah `request.time > closeAt`), dan unduh sertifikat.

**Kuis latihan (via instance `dbApp`)** Buka kuis (konten + kunci dari bundle statis) -> jawab di browser -> skor instan dihitung lokal dari kunci statis -> XP ditulis sekali di akhir sesi ke `progress/{uid}`. Tidak ada koleksi `quizKeysLatihan` di Firestore.

## 11. Arsitektur dan data

| Lapisan | Teknologi |
| --- | --- |
| Frontend | Vite + JavaScript (atau React), Firebase SDK modular |
| Hosting | GitHub Pages (`base: '/nama-repo/'`, `public/404.html` SPA fallback; build timeout 10 menit; catatan: *soft limit* 10 build/jam tidak berlaku untuk build via *custom GitHub Actions*) + GitHub Actions |
| Konten statis | Bundle JSON di `public/data/` (courses, modules, kuis latihan + kunci) — **0 read Firestore** |
| Auth | Firebase Authentication (Email/Password dan Google Sign-In) |
| Database | Firestore (2 instance terpisah: `dbApp` dan `dbExam`) |
| Video | YouTube unlisted |
| Sertifikat | jsPDF di browser |

**Wajib Dua Instance Firestore (`dbApp` dan `dbExam`):**
Karena pengaturan offline persistence (`persistentLocalCache` / IndexedDB) bersifat **global per instance Firestore**, aplikasi wajib menginisialisasi dua instance terpisah:
1. **`dbApp` (`persistentLocalCache` aktif):** dipakai untuk pembacaan dan penulisan profil (`users`), kelas (`classes`), dan `progress`.
2. **`dbExam` (memory cache / tanpa offline persistence):** dipakai khusus untuk alur ujian resmi (`starts`, `quizzes` ujian, `quizKeys`, `quizExplanations`, `attempts`, `results`, `leaderboard`). Hal ini mencegah write `attempts` tertahan di antrean offline lokal dan baru dikirim setelah batas waktu berakhir (yang akan ditolak oleh Security Rules).

**Konten statis (bundle GitHub Pages) — menutup pembengkakan read browsing (K-BARU/S-BARU-05):**
Kursus (`courses`), modul, video, dan kuis latihan (beserta kuncinya) adalah konten **immutable setelah publish**. Semua disimpan sebagai JSON di `public/data/` yang ikut build. Cache-busting memakai hash build (nama file ber-hash) atau `version` di manifest JSON. **Tidak ada read Firestore untuk browsing** — ini menghapus baris browsing `24.000 read` cache-off pada v0.5. Kuis latihan tak bernilai resmi (tanpa leaderboard/`results`), jadi kunci jawaban boleh ada di bundle.

**Koleksi Firestore (hanya data dinamis)**

- `users/{uid}`: `nama`, `kelas` (kode kelas; keanggotaan), `createdAt`. **Ditulis pemilik** (self-signup memvalidasi `classes/{code}` ada via `get()`); `kelas` hanya boleh diubah saat onboarding (lihat §12). Dibaca 1×/sesi (login).
- `admins/{uid}`: penanda admin/guru (bootstrap admin pertama via Console).
- `classes/{code}`: `nama`, `mapel`, `roster[]` (opsional), **`quizzes{}` = metadata jadwal ringkas per mapel** (`quizId`, `openAt`, `toleransiMulai`, `duration`, `closeAt`, `version`) agar siswa menyusun `starts` **tanpa** membaca `quizzes` lebih dulu (menutup deadlock K-BARU-13). **Admin-only write** (F-19). Keanggotaan siswa TIDAK ditulis di sini.
- `quizzes/{id}`: soal ujian tanpa kunci (`questions[]` dalam 1 dokumen, 50 soal; tiap soal `questionId` + tiap opsi `optionId` stabil), `duration` (menit), `toleransiMulai` (menit), `maxAttempts` (`1`), `openAt`, `closeAt` (**`closeAt = openAt + toleransiMulai + duration + 90s`**), `classes[]` (kelas yang berhak), `version`. **Terkunci setelah `openAt`** via Rules.
- `quizKeys/{id}`: kunci ujian per `questionId` menyimpan **`optionId` stabil** (**hanya admin**), `keyVersion`, `openAt`. **Terkunci setelah `openAt`** via Rules.
- `quizExplanations/{quizId}`: pembahasan tiap `questionId` (F-12) + field **`closeAt`** (agar gerbang baca `request.time > resource.data.closeAt` = 0 access-call). Ditulis admin saat publish.
- `starts/{uid}_{quizId}_1` (mis. `starts/u123_quiz45_1`): `uid`, `quizId`, `attemptNo` (=`1`), `startedAt` (= `request.time`, via `serverTimestamp()`), snapshot **`duration`, `closeAt`, `maxAttempts`, `quizVersion`, `keyVersion`**, `expireAt` (TTL). **ID = `uid + '_' + quizId + '_1'` divalidasi Rules.** Tidak menyimpan array shuffle (diregenerasi dari seed).
- `attempts/{uid}_{quizId}_1` (mis. `attempts/u123_quiz45_1`): **SATU dokumen per attempt** berisi map **`answers{questionId: optionId}`**, `updatedAt`, `submitSeq`, `uid`, `quizId`, `attemptNo`, `expireAt` (**deterministik = `closeAt + 30 hari`**). **Create + update terbatas** (hanya `answers`/`updatedAt`/`submitSeq`) selama jendela waktu. `delete` ditolak.
- `results/{uid}_{quizId}_1` (mis. `results/u123_quiz45_1`): skor resmi (**admin write, create+update in-place**), `quizId`, `attemptNo`, `revisionNo`, `updatedAt`. Re-grading via `update` dokumen yang sama (`revisionNo` naik).
- `progress/{uid}`: modul selesai, XP, badge, streak (1 dokumen).
- `leaderboard/{quizId}` atau `leaderboard/current`: **dokumen agregat skor resmi** (admin write, user login read). Hanya agregasi `results` resmi, **bukan** XP/badge.
- `certificates/{id}`: nomor verifikasi, `uid`, `courseId`/`quizId`. **Admin-only write** (S-BARU-01); halaman verifikasi publik read-only.

**Aturan Randomisasi, Kunci Jawaban, dan Immutability Soal:**
- **Jawaban dan kunci memakai `optionId` stabil:** Huruf A/B/C/D di layar hanya label urutan tampilan. `attempts` (di dalam map `answers`) dan `quizKeys` menyimpan ID opsi stabil (mis. `opt_a`).
- **PRNG deterministik:** Pengacakan urutan soal dan opsi di klien memakai PRNG ber-seed deterministik (mis. mulberry32) dengan `seed = hash(uid + quizId + quizVersion)`, bukan `Math.random()`. Urutan **diregenerasi** dari seed saat halaman dimuat ulang (tidak disimpan di `starts` → hemat storage & tutup celah siswa menyuntik array shuffle palsu).
- **Immutability soal/kunci via `openAt` (native, tanpa dokumen lock):** Rules `quizzes/{id}` menolak `update`/`delete` bila `request.time >= resource.data.openAt` (0 access-call, tanpa race). Rules `quizKeys/{id}` menolak `update`/`delete` bila `request.time >= get(/databases/$(database)/documents/quizzes/$(quizId)).data.openAt` (1 access-call, admin saja, jarang). Koreksi soal/kunci wajib menerbitkan versi baru (`quizzes/{id}_v2`, `quizKeys/{id}_v2`). Snapshot `quizVersion`/`duration`/`keyVersion` di `starts` menjamin siswa dinilai sesuai versi saat mulai.

**Cache Konten & Retensi Data (Firestore TTL):**
- **Konten statis:** kursus/modul/kuis-latihan dari bundle (nama file ber-hash / `version`). Soal ujian resmi (`quizzes`) hanya di memori selama sesi (tidak dicache permanen). Acak urutan di klien mencegah salin nomor urut, bukan anti-nyontek sebangku penuh.
- **Retensi penyimpanan 1 GiB (TTL):** `starts` dan `attempts` menyertakan `expireAt` + **Firestore TTL policy** (gratis di Spark tanpa Cloud Functions). Penghapusan TTL **tetap memotong kuota delete (20.000/hari)**. **Masa simpan wajib ≤ 30 hari** (bukan 90) karena `starts`+`attempts` = 3.600 dok/hari × 30 ≈ 108.000 dokumen (~200–350 MB). TTL hanya untuk `starts`/`attempts`. Aktifkan single-field index exemption pada field teks panjang di `quizzes`.

## 12. Keamanan dan privasi

- **Security Rules dan Firebase Auth sebagai garis pertahanan utama:** siswa hanya dapat membaca/menulis data miliknya sendiri, `quizKeys` hanya admin (`admins/{uid}`), dan validasi waktu dijaga di server melalui `request.time`.
- **Path `get()`/`exists()` WAJIB penuh:** `/databases/$(database)/documents/<koleksi>/<id>`. `get()` ke dokumen yang sama dalam 1 evaluasi di-cache → 1 access-call (boleh dipakai berulang dalam satu kondisi).

- **Binding ID (menutup K-BARU-01/K9):** Rules memakai variabel wildcard segmen penuh, bukan `request.resource.id` (properti ini tidak ada di Firestore Rules). Contoh nyata:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null
        && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    // get() ke path sama di-cache per evaluasi = 1 access-call walau dipanggil berulang
    function q(qid) { return get(/databases/$(database)/documents/quizzes/$(qid)).data; }
    function st(sid) { return get(/databases/$(database)/documents/starts/$(sid)).data; }

    // ---- starts: create divalidasi penuh, immutable setelah dibuat ----
    match /starts/{startId} {
      allow read: if request.auth != null && (request.auth.uid == resource.data.uid || isAdmin());
      allow create: if request.auth != null
        && startId == request.auth.uid + '_' + request.resource.data.quizId + '_1'
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.attemptNo == 1
        && request.resource.data.startedAt == request.time
        && request.resource.data.keys().hasOnly(['uid','quizId','attemptNo','startedAt','duration','closeAt','maxAttempts','quizVersion','keyVersion','expireAt'])
        && request.resource.data.duration == q(request.resource.data.quizId).duration
        && request.resource.data.maxAttempts == 1
        && request.resource.data.quizVersion == q(request.resource.data.quizId).version
        && request.resource.data.closeAt == q(request.resource.data.quizId).closeAt
        && request.resource.data.expireAt == request.resource.data.closeAt + duration.value(30, 'd')
        && request.time >= q(request.resource.data.quizId).openAt
        && request.time <= q(request.resource.data.quizId).openAt + duration.value(q(request.resource.data.quizId).toleransiMulai, 'm')
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.kelas in q(request.resource.data.quizId).classes;
      allow update, delete: if false;
    }

    // ---- quizzes: admin bebas; siswa baca setelah mulai & dalam jendela; kunci setelah openAt ----
    match /quizzes/{quizId} {
      allow read: if request.auth != null && (
        (request.time >= resource.data.openAt && request.time <= resource.data.closeAt
            && exists(/databases/$(database)/documents/starts/$(request.auth.uid + '_' + quizId + '_1')))
        || isAdmin());
      allow create: if isAdmin();
      allow update, delete: if isAdmin() && request.time < resource.data.openAt;
    }

    // ---- quizKeys: admin-only; terkunci setelah openAt ----
    match /quizKeys/{quizId} {
      allow read: if isAdmin();
      allow create: if isAdmin();
      allow update, delete: if isAdmin() && request.time < q(quizId).openAt;
    }

    // ---- attempts: create+update terbatas, idempoten, jendela dari starts ----
    match /attempts/{attemptId} {
      allow read: if request.auth != null && (request.auth.uid == resource.data.uid || isAdmin());
      allow create: if request.auth != null
        && attemptId == request.auth.uid + '_' + request.resource.data.quizId + '_1'
        && request.resource.data.uid == request.auth.uid
        && request.resource.data.attemptNo == 1
        && request.resource.data.keys().hasOnly(['answers','updatedAt','submitSeq','uid','quizId','attemptNo','expireAt'])
        && request.resource.data.answers.size() <= 50
        && request.resource.data.expireAt == st(attemptId).closeAt + duration.value(30, 'd')
        && request.time <= st(attemptId).closeAt
        && request.time <= st(attemptId).startedAt + duration.value(st(attemptId).duration, 'm') + duration.value(90, 's');
      allow update: if request.auth != null
        && request.auth.uid == resource.data.uid
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['answers','updatedAt','submitSeq'])
        && request.resource.data.answers.size() <= 50
        && request.time <= st(attemptId).closeAt
        && request.time <= st(attemptId).startedAt + duration.value(st(attemptId).duration, 'm') + duration.value(90, 's');
      allow delete: if false;
    }

    // ---- results: admin create+update (revisi in-place), siswa baca sendiri ----
    match /results/{resultId} {
      allow read: if request.auth != null && (request.auth.uid == resource.data.uid || isAdmin());
      allow create, update: if isAdmin();
      allow delete: if false;
    }

    // ---- quizExplanations: terbuka setelah closeAt (0 access-call) ----
    match /quizExplanations/{quizId} {
      allow read: if request.auth != null && request.time > resource.data.closeAt;
      allow write: if isAdmin();
    }

    // ---- users: pemilik (kelas immutable oleh siswa) atau admin ----
    match /users/{uid} {
      allow read: if request.auth != null && (request.auth.uid == uid || isAdmin());
      allow create: if request.auth != null && request.auth.uid == uid
        && exists(/databases/$(database)/documents/classes/$(request.resource.data.kelas));
      allow update: if request.auth != null && (
        (request.auth.uid == uid && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['nama','updatedAt']))
        || isAdmin());
    }

    // ---- progress: pemilik tulis/baca, admin baca ----
    match /progress/{uid} {
      allow read: if request.auth != null && (request.auth.uid == uid || isAdmin());
      allow write: if request.auth != null && request.auth.uid == uid;
    }

    // ---- admins: hanya admin (bootstrap pertama via Console) ----
    match /admins/{uid} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }

    // ---- classes: admin-only write; dibaca semua login (berisi metadata jadwal) ----
    match /classes/{code} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }

    // ---- certificates: admin write, publik read (verifikasi) ----
    match /certificates/{id} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // ---- leaderboard: admin write, login read ----
    match /leaderboard/{doc} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }
  }
}
```
  > Catatan: semua aritmetika waktu memakai `duration.value(n, 'm'|'d'|'s')` — `Timestamp` hanya bisa ditambah `Duration`, **bukan** `int` (K-BARU-09). `q()`/`st()` = `get()` yang di-cache per evaluasi = 1 access-call walau dipanggil berulang. `attempts` `update` membaca jendela dari `get(starts)` (**bukan** `resource.data` — K-BARU-10). `expireAt` divalidasi `closeAt + duration.value(30,'d')` (S-BARU-09). Revisi nilai in-place (`results` `update` admin + field `revisionNo`/`updatedAt`) menggantikan `_v2` (K-BARU-03). `classes/{code}.quizzes` memuat metadata jadwal agar siswa menyusun `starts` tanpa membaca `quizzes` lebih dulu (K-BARU-13).

- **Validasi snapshot `starts` (menutup K1/K-BARU-01):** create `starts` **wajib** menegakkan SEMUA berikut (lihat Rules di atas): `startId` cocok pola, `startedAt == request.time`, `duration/closeAt/maxAttempts/quizVersion` == `quizzes`, `request.time` di `[openAt, openAt + toleransiMulai]`, dan `users/{uid}.kelas in quizzes.classes`. **Uji negatif Emulator:** `duration:600`, `startedAt` dimundurkan, `closeAt` palsu, `attemptNo` di ID tak cocok, kelas tak berhak → **DENIED**.

- **Model "Ujian Sinkron" dan Penyeragaman Deadline:**
  1. **Jendela mulai:** semua siswa WAJIB memulai di `[openAt, openAt + toleransiMulai]`. Di luar jendela → ditolak Rules. Klien mengunci tombol mulai pada `openAt + toleransiMulai - 10s` untuk latensi (S17).
  2. **Timer per-siswa:** `startedAt + duration + 90s`. `startedAt` diperoleh dari `serverTimestamp()` saat `setDoc` — klien memakai jam lokal setelah promise resolve (akurasi ~1 dtk; toleransi jaringan 90 dtk menyerap selisih). **Tidak ada baca-balik `starts`** (hemat 1.800 read).
  3. **Rumus `closeAt` global:** `closeAt = openAt + toleransiMulai + duration + 90s` (disimpan di `quizzes`, divalidasi saat create `starts`).
  4. **Gerbang baca soal (`quizzes/{id}`):** `request.time in [openAt, closeAt]` **DAN** `starts/{uid}_{quizId}_1` ada.
  5. **Gerbang tulis jawaban (`attempts`):** create **atau** update terbatas selama `request.time <= startedAt + duration + 90s` **DAN** `<= closeAt`.

- **Ketahanan pengiriman di klien (UI) & larangan offline persistence ujian:**
  - Alur ujian wajib memakai instance `dbExam` (memory cache) agar tidak ada write tertahan di antrean offline.
  - Selama ujian, klien menyimpan **draft jawaban di `localStorage`**, **retry otomatis 3x dengan exponential backoff**, dan menampilkan **state pengiriman eksplisit** (`Terkirim`, `Sedang mengirim...`, `Gagal terkirim - klik coba lagi`).

- **Aturan `attempts` (satu dokumen, create + update terbatas, idempoten — menutup K-BARU-05):**
  - `delete` oleh siswa **ditolak**. `attemptNo == 1`.
  - **Create:** `!exists`, `attemptId == uid_quizId_1`, `keys().hasOnly([...])`, `answers.size() <= 50`, dalam jendela waktu. `expireAt` deterministik (`closeAt + 30 hari`).
  - **Update:** hanya `answers`/`updatedAt`/`submitSeq` (`affectedKeys().hasOnly`), `answers.size() <= 50`, dalam jendela waktu. Retry `setDoc(merge)` dengan `expireAt` sama → tak masuk `affectedKeys` → **idempoten** (tidak `PERMISSION_DENIED`/`NOT_FOUND`).

- **`results` create+update admin (revisi in-place):** admin boleh `create` dan `update` (tak ada `delete`); re-grading menimpa dokumen yang sama dan menaikkan `revisionNo`/`updatedAt`. Agregasi leaderboard membaca dokumen terbaru (satu dokumen, tanpa `_v2`).

- **Aturan Batch Penilaian & Batas Access-Call:**
  - `writeBatch` maks **500 write/batch**; evaluasi Rules maks **10 access-call (single-doc)** dan **20 access-call (multi-doc/transaksi/writeBatch)**.
  - Rules `results` **hanya** memeriksa `exists(/databases/$(database)/documents/admins/$(request.auth.uid))` (1 access-call per batch, di-cache), **tidak** `get()` per-siswa. Jadi skenario grading `1.812 read` (attempts+quizKeys+admins) sah tanpa menembus 20 access-call.

- **Keamanan keanggotaan & sertifikat (menutup S-BARU-01):** keanggotaan kelas di `users/{uid}.kelas` (bukan `arrayUnion` di `classes`) sehingga tak bisa disabotase; `classes/{code}` **admin-only write**. `certificates/{id}` **admin-only write** (tak bisa dipalsukan siswa); verifikasi publik read-only. Sertifikat tidak boleh diturunkan dari `progress` yang ditulis bebas siswa.

- **App Check (reCAPTCHA v3) mode monitor/opsional:** kuota gratis 10.000 assessments/bulan. **Kebijakan:** mode monitor/opsional; keamanan utama sepenuhnya di Firestore Rules + Auth. **Pertahanan kuota (S14):** batasi signup (verifikasi email di luar onboarding), pantau kuota harian, kill-switch (nonaktifkan pendaftaran mandiri saat pekan ujian).

- **Leaderboard dan Gamifikasi:** `leaderboard/{quizId}`/`leaderboard/current` hanya ditulis admin dan **hanya** mengagregasi skor resmi `results`. XP/kuis latihan bisa dimanipulasi klien → **tidak pernah** dipakai untuk nilai resmi/leaderboard.

- **Privasi dan Retensi Data:** data pribadi minimal (nama, kelas, email); `starts`/`attempts` dibersihkan via TTL `expireAt` (≤30 hari); penghapusan akun mengikuti kebijakan sekolah; persetujuan orang tua untuk siswa di bawah umur: [isi]; `admins/{uid}` (F-18) dikelola admin (bootstrap admin pertama via Console) — Rules `admins` membatasi penulisan hanya oleh admin yang sudah ada.

## 13. Anggaran kuota (Spark)

Batas gratis harian Firestore Spark: **50.000 read**, **20.000 write**, **20.000 delete**, **1 GiB storage**, **10 GiB egress/bulan**.

> **Label Penting:** seluruh angka adalah **estimasi**. **Metode uji (S11):** Firebase Emulator **hanya mengukur jumlah operasi** dan validasi Rules — **tidak** menegakkan batas kuota Spark (50k/20k) maupun mensimulasikan 900 koneksi nyata. Penegakan kuota dan uji 900 concurrent **wajib** di **project Firebase nyata** (dengan pemantauan Console), **terpisah dari project produksi (staging)** agar tidak menghabiskan kuota harian produksi.
> **Premis Beban & Model Ujian Sinkron:** kohort **1.000 akun unik**, beban ujian **6 mapel × 300 = 1.800 sesi/hari (~1,8 sesi/siswa)**, puncak **900 concurrent**. Model **ujian sinkron**: mulai di `[openAt, openAt + toleransiMulai]`, timer per-siswa `startedAt + duration + 90s`, `closeAt = openAt + toleransiMulai + duration + 90s`.

### 13.1 Tabel Hitung Ulang Transparan Harian (Ujian + Operasional; browsing = 0 karena statis)

Asumsi eksplisit (per 1.800 sesi ujian/hari, kecuali disebut lain):
1. **Create `starts` (validasi Rules):** rule-get `quizzes` (di-cache = 1 read) + rule-get `users` (keanggotaan) = **2 read/sesi = 3.600**. Write `starts` = 1.800.
2. **Muat soal `quizzes`:** baca dokumen (1 read) + rule-get `exists(starts)` (1 read) = **2 read/sesi = 3.600**.
3. **Create `attempts`:** rule-get `starts` (di-cache = 1 read) = **1.800**. Write = 1.800.
4. **Margin retry/update `attempts` 10%:** 180 update x (1 write + 1 rule-get `starts`) = **180 read + 180 write**.
5. **Grading:** baca `attempts` (1.800) + `quizKeys` (6) + rule-get `admins` (6 mapel x 3 evaluasi `isAdmin()` = 18) = **1.824 read**. Write `results` = 1.800.
6. **Baca `results` siswa:** **1.800 read** (+6 rule-get `admins` saat admin tulis `leaderboard`). Write `leaderboard` = 6.
7. **Baca `leaderboard` siswa:** **1.800 read**.
8. **Baca/tulis `progress`:** **1.800 read**. Write modul (1.000) + XP (1.000-2.000) = **2.000-3.000**.
9. **Login `users/{uid}`:** **1.800 read** (metadata jadwal dari `classes/{code}` di-cache `dbApp`; bila tak di-cache +1.800).
10. **Pembahasan `quizExplanations`:** **0-1.800 read** (gerbang `request.time > resource.data.closeAt` = 0 access-call).
11. **Browsing:** **0 read** (bundle statis).
12. **Onboarding & sertifikat:** write, dijadwalkan terpisah - lihat baris ekstrem.

| # | Komponen (1.000 akun, 1.800 sesi) | Read | Write |
| --- | --- | --- | --- |
| 1 | Create `starts` (rule-get `quizzes`+`users`) | 3.600 | 1.800 |
| 2 | Muat soal `quizzes` (doc + rule-get `exists starts`) | 3.600 | 0 |
| 3 | Create `attempts` (rule-get `starts`) | 1.800 | 1.800 |
| 3b | Margin retry/update `attempts` 10% | 180 | 180 |
| 4 | Grading (`attempts`+`quizKeys`+rule-get `admins`) | 1.824 | 1.800 |
| 5 | Baca `results` siswa + tulis `leaderboard` (+rule-get `admins`) | 1.806 | 6 |
| 6 | Baca `leaderboard` siswa | 1.800 | 0 |
| 7 | Baca/tulis `progress` (modul + XP) | 1.800 | 2.000-3.000 |
| 8 | Login `users/{uid}` | 1.800 | 0 |
| 9 | Pembahasan `quizExplanations` (opsional) | 0-1.800 | 0 |
| 10 | Browsing (statis) | 0 | 0 |
| - | **TOTAL HARI UJIAN** | **18.210-20.010 (36,4%-40,0%)** | **7.586-8.586 (37,9%-42,9%)** |
| - | **TOTAL EKSTREM** (onboarding + sertifikat hari sama) | **~22.010-25.610 (44%-51%)** | **12.386 (61,9%)** |

> **TOTAL READ hari ujian** = `3.600+3.600+1.800+180+1.824+1.806+1.800+1.800+1.800` = **18.210** (min); +1.800 pembahasan = **20.010** (max). Bila metadata jadwal tak di-cache: +1.800 -> s.d. **21.810** (43,6%). Semua **< 50.000**.
> **TOTAL WRITE hari ujian** = `1.800+1.800+180+1.800+6+(2.000..3.000)` = **7.586-8.586** (37,9%-42,9%).
> **TOTAL EKSTREM** = `8.586 + 2.000 (onboarding) + 1.800 (sertifikat)` = **12.386 (61,9%)** write; read ~ **22.010-25.610 (44%-51%)** - **masih < batas keras 50.000 read / 20.000 write**.

**Catatan Analisis & Gate Rilis:**
- Browsing **0 read** (konten statis) - penghapus 24.000 read cache-off v0.5.
- Read hari ujian **36%-40%** (worst 43,6%), write **38%-43%** -> headroom besar.
- Ekstrem write **61,9%** dan read **51%** -> onboarding/sertifikat disarankan hari terpisah untuk margin, tapi tak wajib.
- Angka di atas **sudah termasuk** rule-get `admins` per operasi admin (6 mapel) dan margin retry 10% (koreksi audit ronda-2).

### 13.2 Aturan Hemat Kuota (WAJIB)

1. **Konten statis di bundle GitHub Pages:** kursus, modul, kuis latihan + kunci → **0 read Firestore**. Cache-busting via hash build / `version` manifest.
2. **Soal ujian = 1 dokumen (`quizzes/{id}.questions[]`):** bukan subcollection per-soal.
3. **XP = 1 write per sesi:** digabung ke `progress/{uid}` di akhir sesi.
4. **Leaderboard = dokumen agregat:** dibangun di memori saat grading, bukan query `results` oleh siswa.
5. **Nol realtime listener:** `getDoc`/`getDocs` sekali, **bukan `onSnapshot`**.
6. **Grading batch sadar kuota:** baca `attempts` per `quizId`, hitung di memori, tulis `results` via `writeBatch` (N dok = N write).
7. **`progress` dibaca sekali/sesi.**
8. **Snapshot `duration`+`closeAt`+`maxAttempts` di `starts`:** gerbang tulis `attempts` cukup 1 rule-get `starts` (bukan `get()` berantai).
9. **`attempts` = 1 dokumen map `answers`:** hemat write & read grading drastis.
10. **Margin retry:** anggarkan **+10% write `attempts`** untuk retry jaringan (idempoten, tapi tetap tertagih write). Total write hari ujian tetap < batas.

### 13.3 Waktu Reset Kuota Harian (Mengikuti DST)

- Reset kuota harian Firestore = tengah malam Pasifik (`00:00 America/Los_Angeles`), bergeser mengikuti **DST**: **14:00 WIB** (PDT/UTC-7) atau **15:00 WIB** (PST/UTC-8), rentang **14:00–15:00 WIB**.
- **Aturan Penjadwalan (dikoreksi — S1/S-BARU-03):** satu sesi memakan `toleransiMulai + duration + 90s` (mis. 15 + 90 + 1,5 = **106,5 menit**) sampai `closeAt`; **ditambah** waktu grading & pembacaan hasil setelahnya (~15 menit). **Wajib:** tidak ada sesi yang **mulai dalam `< 120 menit`** sebelum jendela reset (≈ tidak ada start setelah **12:00 WIB**). Dengan begitu sesi + grading selesai sebelum reset 14:00. (Rumus "< 120 menit", bukan "≥ 107 menit" yang terbalik di v0.5.)

### 13.4 Batas Firebase Auth (Spark) dan Rencana Pembuatan Akun

> **Catatan Sumber & Tanggal Akses:** angka batas mengacu halaman **Firebase Authentication Limits** per **16 November 2026** dan **dapat berubah**. Klaim signup 100/jam/IP berlaku **khusus sisi-klien**.

| Jenis Operasi Firebase Auth (Spark) | Batas Kuota Gratis | Dampak & Solusi pada 1.000 Siswa |
| --- | --- | --- |
| Reset sandi | **150 email/hari** | Reset massal hari ujian tertahan ke-150; uji login H-2 atau reset via Admin SDK |
| Verifikasi email | **1.000 email/hari** | Pas-pasan; jangan wajibkan verifikasi pagi hari ujian |
| Login tautan email | **5 email/hari** | **Tidak bisa dipakai**; gunakan Email/Password atau Google Sign-In |
| Pembuatan akun (signup) | **100 akun/jam/IP** *(khusus sisi-klien)* | Signup mandiri 1.000 siswa dari 1 IP WiFi → akun ke-101+ ditolak. **Solusi:** (a) buat via **Firebase Admin SDK/server-side** (bebas kuota per-IP) — jalur utama & paling pasti; (b) bila Console menyediakan setelan kuota signup, naikkan sementara (perlu diverifikasi — **tidak semua project/plan punya setelan ini**); (c) daftar bertahap per kelas/jaringan seluler |
| Tier 1 DAU | **3.000/hari** | Aman untuk 1.000 siswa + guru/admin |

**Rencana Pembuatan Akun & Mitigasi (WAJIB):**
1. **Jalur utama = Firebase Admin SDK (server-side/lokal admin) dari CSV data siswa pada H-7 s.d. H-2** — bebas kuota per-IP. Prasyarat: service account key (dikelola admin, tidak di-deploy ke klien).
2. Bila Console menyediakan penaikan kuota signup, boleh sebagai pelengkap, **bukan andalan tunggal**.
3. **Jangan** aktifkan email-link sign-in (5/hari) dan jangan paksa verifikasi email pagi hari ujian.
4. **Manajemen lupa sandi:** uji login serentak H-2 atau reset via Admin SDK (email reset 150/hari).

## 14. UX dan UI

- Mobile first, tombol besar, navigasi sederhana.
- Halaman: beranda, daftar kursus, halaman modul, kuis/ujian, hasil, profil, sertifikat, admin.
- Panduan gaya: [logo, warna utama, font, tone bahasa]. Wireframe: [tautan/lampiran].
- **UX Ketahanan Ujian (Wajib):**
  - Tampilkan jendela mulai `[openAt, openAt + toleransiMulai]` dan timer per-siswa. Timer dihitung dari `startedAt` (jam lokal saat `setDoc` resolve) **+ duration + 90s** — **samakan makna dengan Rules**.
  - Setiap perubahan jawaban disimpan sebagai **draft di `localStorage`**.
  - Saat kirim: tampilkan status eksplisit (`Sedang mengirim...` → `Jawaban Berhasil Terkirim` + waktu, atau `Gagal Terkirim - Mencoba ulang (1/3)...`).
  - **Retry otomatis 3x exponential backoff** bila jaringan terganggu, selama `request.time <= startedAt + duration + 90s` DAN `<= closeAt`.
  - Tombol mulai dikunci 10s sebelum `openAt + toleransiMulai` untuk ruang latensi (S17).

## 15. Analitik dan pemantauan

- Pantau read/write/delete Firestore serta kuota Auth di Firebase Console **setiap hari** saat pekan ujian.
- **Alarm relatif (dikoreksi — S-BARU-06):** karena Cache-On kini **36%–40%** (browsing statis = 0), alarm statis "60%"/"70%" tidak lagi selalu menyala. Gunakan alarm pada **read > 35.000 (70%)** atau **write > 15.000 (75%)**. Tindakan: tunda gelombang non-kritis, nonaktifkan fitur opsional (leaderboard realtime bila ada). **Jangan** "paksa pre-warm cache" (tidak relevan lagi — browsing sudah statis, tak ada read Firestore).
- Metrik produk: siswa aktif, penyelesaian modul, rata-rata skor, rasio error sesi ujian (`starts` tanpa `attempts` valid).
- Log kesalahan klien (opsional: gagal muat soal / gagal kirim jawaban).

## 16. Rilis dan roadmap

| Fase | Isi | Target |
| --- | --- | --- |
| 1. Fondasi & Akun | Project Firebase, Auth, `classes/{code}` (admin-only), deploy GitHub Pages (`base:'/nama-repo/'`+`404.html`), provisioning 1.000 akun via Admin SDK (utama) | [tanggal] |
| 2. Konten & Cache | Bundle statis kursus/video/latihan, progress (`dbApp` persist), bank soal 6 mapel × 50 soal (`optionId` stabil) | [tanggal] |
| 3. Ujian Sinkron Aman | `dbExam` (tanpa persist), `starts` (snapshot **divalidasi**, `serverTimestamp()`), `attempts` **satu dokumen map `answers`** (create+update terbatas, draft+retry), kunci via `openAt`, TTL ≤30 hari, uji Rules di Emulator + operasi di project nyata (staging) | [tanggal] |
| 4. Admin & Grading | Penilaian massal (`writeBatch` ≤500 & ≤20 access-call, `results` create+update admin, revisi in-place), rekap per kelas/kuis, ekspor CSV, update `leaderboard` | [tanggal] |
| 5. Pengayaan (Tahap 2) | Sertifikat PDF (jsPDF, admin-only write), XP, badge, streak, halaman leaderboard siswa | [tanggal] |
| Pilot | 20–30 siswa, lalu simulasi beban 30→900 concurrent di **project staging nyata** (Emulator hanya untuk operasi/Rules) | [tanggal] |
| Peluncuran | 1.000 siswa, ujian bergelombang per kelas, tidak mulai `< 120 menit` sebelum reset 14:00 WIB | [tanggal] |

## 17. Pengujian dan kriteria penerimaan

- **Uji Firebase Emulator (Security Rules & jumlah operasi):**
  - **Mulai ujian (`starts`):** hanya create jika `request.time` di `[openAt, openAt + toleransiMulai]` **DAN** semua snapshot valid + `users.kelas in quizzes.classes`. **Uji negatif wajib:** `duration:600`, `startedAt` dimundurkan, `closeAt` palsu, `attemptNo` di ID tak cocok, kelas tak berhak, ID liar → **DENIED** (K1/K9).
  - **Baca soal (`quizzes`):** hanya jika `request.time in [openAt, closeAt]` DAN `starts/{uid}_{quizId}_1` ada.
  - **Tulis jawaban (`attempts`):** create + update terbatas (hanya `answers`/`updatedAt`/`submitSeq`); `delete`/`update` field lain **DENIED**; di luar `request.time <= startedAt + duration + 90s && <= closeAt` **DENIED**; `attemptNo==2` **DENIED**; ID `_B/_C` **DENIED**; retry `setDoc(merge)` dengan `expireAt` sama **ALLOWED** (idempoten).
  - **Immutability:** `update`/`delete` `quizzes` setelah `request.time >= openAt` **DENIED**; `quizKeys` setelah `openAt` **DENIED**.
  - **Keanggotaan & sertifikat:** siswa tak bisa `write` `classes`/`certificates`; keanggotaan via `users.kelas` saja.
  - Siswa tak bisa menulis `results`/`leaderboard`; admin menulis `results` create+update dalam batch ≤500 write & ≤20 access-call.
  - **Tipe waktu (K-BARU-09):** `starts`/`attempts` create/update dengan `duration.value(...,'m')` **ALLOWED**; regresi ke `Timestamp + int` ditolak Emulator.
  - **Admin read (K-BARU-11):** guru (`admins/{uid}`) bisa `read` `attempts`/`results`/`quizzes`; siswa lain **DENIED**.
  - **`progress`/`admins` (K-BARU-12):** siswa tulis `progress/{uid}` sendiri **ALLOWED**; tulis `progress/{uidLain}`/`admins/*` **DENIED**.
  - **`kelas` immutable (S-BARU-08):** siswa `update users` ubah `kelas` **DENIED**; ubah `nama` **ALLOWED**; admin ubah `kelas` **ALLOWED**.
  - **Deadlock metadata (K-BARU-13):** siswa baca `classes/{code}.quizzes` **ALLOWED** sebelum `starts`; baca `quizzes/{id}` sebelum `starts` **DENIED**.
  - **`expireAt` (S-BARU-09):** `expireAt != closeAt + 30d` **DENIED**. Revisi nilai: admin `update results` **ALLOWED**, siswa **DENIED**.
- **Uji Randomisasi & Grading:** jawaban & kunci pakai `optionId` stabil; urutan PRNG `seed = hash(uid + quizId + quizVersion)` konsisten saat refresh (diregenerasi, bukan dari `starts`).
- **Uji Dua Instance & Resiliensi UI:** `dbExam` tanpa offline persistence; draft di `localStorage`; retry backoff 3x saat jaringan diputus.
- **Uji XP & Leaderboard:** XP 1 write/sesi; leaderboard hanya dari dokumen agregat `results` resmi.
- **Uji Konten Statis:** bundle termuat dari GitHub Pages tanpa read Firestore; ganti `version`/hash → konten baru.
- **Uji Perangkat:** HP Android/iOS (≥360 px), Chrome, Safari, Firefox.
- **Uji kuota & 900 concurrent:** di **project staging nyata** dengan pemantauan Console (bukan Emulator) — S11/S-BARU-07.
- **Kriteria Rilis (Wajib Lulus):**
  1. Semua fitur Wajib lulus uji fungsional & Security Rules di Emulator.
  2. **Kuota read/write hari ujian:** uji beban hari ujian penuh. **Target lulus = TOTAL READ `18.210–20.010` (36,4%–40,0%) dan TOTAL WRITE `7.586–8.586` (37,9%–42,9%)**, ekstrem write `12.386` (61,9%), dengan **batas keras** ≤ 50.000 read / ≤ 20.000 write / ≤ 20.000 delete per hari.
  3. **Delete & storage:** delete harian (termasuk TTL) ≤ 20.000; storage total ≤ 1 GiB (`starts`+`attempts` TTL ≤30 hari).
  4. **Onboarding & sertifikat:** ekstrem `12.386` (61,9%) masih < 20.000; disarankan hari terpisah untuk margin.
  5. **Reliabilitas ujian:** rasio error sesi = (gagal muat soal atau gagal kirim) / total sesi dimulai **< 1%**, diukur pada uji **≥300 sesi** (S12).

## 18. Asumsi, dependensi, dan risiko

**Asumsi**
- Semua siswa punya perangkat & koneksi internet saat ujian.
- Guru bersedia menjalankan penilaian massal setelah sesi ujian selesai.
- Pembuatan akun dilakukan sebelum hari ujian (utama: Admin SDK).
- Sertifikat diterbitkan **1.000–1.800 dokumen** (1.000 per siswa/kursus; 1.800 per sesi mapel).
- Onboarding & sertifikat disarankan di luar hari ujian (margin), tapi boleh hari sama (61% < 20.000).

**Dependensi**
- Firebase Spark (Auth & Firestore), GitHub Pages + GitHub Actions, YouTube.

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Snapshot `starts` dipalsukan siswa | Timer/`closeAt` tak berlaku, curang | Rules memvalidasi `startedAt==request.time`, `duration/closeAt/maxAttempts/quizVersion` vs `quizzes`, keanggotaan kelas (K1/K-BARU-01) |
| Kuota Firestore harian habis | `RESOURCE_EXHAUSTED`, layanan berhenti | Konten statis (0 read browsing); read hari ujian 36%–40%; alarm 70%; margin retry |
| `request.resource.id` (sintaks salah) | Rules gagal compile | Pakai wildcard `match /{startId}` + binding string (K-BARU-01) |
| Hidden rule-get menjebol kuota | Read > 50.000 | 1 rule-get `quizzes` (di-cache) + `users`; hapus `get(quizKeys)`; angka jujur di tabel (K-BARU-02) |
| Deadlock `quizKeysLatihan` | Syarat "tak boleh baca sebelum submit" mustahil | Kuis latihan jadi konten statis; hapus koleksi `quizKeysLatihan` (K-BARU-04) |
| Retry `attempts` tak idempoten | `PERMISSION_DENIED`/`NOT_FOUND` | `expireAt` deterministik + `hasOnly` di create&update + `setDoc(merge)` (K-BARU-05) |
| `quizLocks` dihapus/race | Soal bisa diedit saat ujian | Kunci native via `openAt` di Rules `quizzes`/`quizKeys` (K-BARU-06) |
| Sabotase `classes.anggota[]` / sertifikat palsu | Data kelas rusak / sertifikat palsu | Keanggotaan via `users.kelas`; `classes`/`certificates` admin-only write (S-BARU-01) |
| Offline persistence menunda write `attempts` | Jawaban ditolak Rules, hilang | 2 instance (`dbApp` persist, `dbExam` memory) + retry + draft `localStorage` |
| Deadline baca vs tulis tak sinkron | Siswa terlambat kena read-block | Model ujian sinkron `closeAt = openAt+toleransiMulai+duration+90s`; baca `[openAt,closeAt]`, tulis `startedAt+duration+90s && <=closeAt` |
| Reset kuota DST | Ujian terputus saat pergantian hari | Tidak mulai `< 120 menit` sebelum reset 14:00 WIB (S-BARU-03) |
| Uji beban di project produksi | Kuota produksi habis | Wajib project staging terpisah (S-BARU-07) |
| Storage 1 GiB penuh | Penulisan baru gagal | TTL ≤30 hari; hitung storage (§13.5) |
| Egress 10 GiB/bulan / gambar base64 | Jebol kuota | Soal hanya teks, **dilarang** gambar base64 (S9) |
| Deploy GitHub Pages gagal / SPA 404 | Halaman ujian tak terbuka | Vite `base:'/nama-repo/'`, `404.html`, build ≤10 menit |
| `Timestamp + int` di Rules | Rules error, ujian gagal total | Semua aritmetika waktu pakai `duration.value(n,'m'/'d'/'s')` (K-BARU-09) |
| `attempts` update baca field hantu | Retry ditolak | Jendela dibaca dari `get(starts)`, bukan `resource.data` (K-BARU-10) |
| Admin tak bisa baca `attempts`/`results`/`quizzes` | Grading & CSV gagal | `|| isAdmin()` di setiap `allow read` (K-BARU-11) |
| `progress`/`admins` tanpa Rules | Fitur progress/admin mati | Blok `match /progress` & `match /admins` (K-BARU-12) |
| Deadlock metadata pra-mulai | Siswa tak bisa mulai | Metadata jadwal di `classes/{code}.quizzes` (K-BARU-13) |
| Siswa ganti `kelas` saat ujian | Ikut 6 mapel, sesi membengkak | `kelas` immutable oleh siswa; ubah hanya admin (S-BARU-08) |

### 13.5 Estimasi Storage & Egress

- **Storage:** `starts`+`attempts` = 3.600 dok/hari. TTL **30 hari** → ~108.000 dokumen (~200–350 MB) **aman**; TTL 90 hari → ~324.000 dokumen (~650 MB–1 GB) **berisiko**. **Keputusan: TTL ≤30 hari.** `results` tanpa TTL tumbuh ~324.000/tahun — pantau; bila perlu TTL panjang setelah arsip.
- **Egress:** 1.800 sesi × dokumen soal 50 soal (~40 KB teks) ≈ 72 MB/hari (~2 GB/bulan) — aman di 10 GiB. **Bila soal memuat gambar base64** (tanpa Cloud Storage), 100 KB × 50 × 1.800 = langsung jebol → **wajib soal teks saja** (S9).

## 19. Pertanyaan terbuka

- Metode pembuatan 1.000 akun: **Admin SDK (disarankan)** vs penaikan kuota Console (bila tersedia) vs pendaftaran bertahap?
- Apakah seluruh siswa punya akun Google sekolah (hindari limit verifikasi 1.000/hari & reset 150/hari)?
- Nilai `toleransiMulai` standar (15 atau 30 menit)? (`maxAttempts` sudah tetap `1` untuk ujian resmi.)
- Sertifikat 1 per kursus (1.000) atau 1 per sesi mapel (1.800)? `leaderboard` per mapel atau gabungan `leaderboard/current`?
- Masa simpan (`expireAt`) `starts`/`attempts` setelah `results` terbit (disarankan ≤30 hari untuk storage)?
- Kebijakan persetujuan orang tua untuk siswa di bawah umur: [isi].

## 20. Lampiran

- Spesifikasi teknis lengkap & Security Rules (`spec tech.md`) — **wajib menyertakan Rules §12 di atas** (binding wildcard, `startedAt==request.time`, `attempts` create+update idempoten, kunci via `openAt`, keanggotaan via `users.kelas`).
- Daftar kebutuhan sistem (`requirements.md`)
- Wireframe dan panduan gaya
- Contoh format CSV rekap nilai (filter `classCode` dan `quizId`)
- Template sertifikat
