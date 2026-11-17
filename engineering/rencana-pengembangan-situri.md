# Rencana Pengembangan Berdampak Tinggi — SITURI (LMS SMPN 1 Umbulsari)

Dokumen ini merinci perencanaan arsitektur, desain interaksi, pemodelan data, tahapan eksekusi, dan mitigasi risiko untuk 7 fitur berdampak tinggi pada platform SITURI.

---

## 1. Latar Belakang & Sasaran Strategis

1. **Karakteristik Pengguna Utama:** Siswa SMP kelas 7–9 dengan perangkat smartphone berspesifikasi heterogen (layar 360–420px, RAM 2–4 GB) dan konektivitas seluler/WiFi sekolah yang fluktuatif.
2. **Efisiensi Infrastruktur (Spark Tier $0):** Kuota Firestore gratis dibatasi 50.000 read dan 20.000 write per hari. Setiap fitur harus dirancang dengan pendekatan *zero redundant read* dan *debounced batch write*.
3. **Kepatuhan Standar Rekayasa:** Seluruh kode baru wajib mematuhi batasan modularitas pada `engineering/coding-standards.md` (CSS ≤ 300 baris, JS ≤ 400 baris).

---

## 2. Rincian Teknis 7 Fitur Berdampak Tinggi

### Fitur 1: UI Kartu Tap-to-Pair untuk Soal Menjodohkan (`MATCH`)

- **Masalah Saat Ini:**
  Di `docs/js/siswa/exam-runner.js`, butir soal tipe menjodohkan dirender dengan elemen `<select>` dropdown. Pada layar smartphone, dropdown picker sistem operasi menutupi 50% layar, teks opsi yang panjang terpotong, dan siswa kesulitan melihat pasangan yang sudah terbentuk secara komprehensif.
- **Konsep Interaksi (*Tap-to-Pair*):**
  1. Area soal menampilkan dua kolom kartu sejajar:
     - **Kolom A (Premis/Kiri):** Kartu berlabel `A1`, `A2`, `A3`, dst.
     - **Kolom B (Pilihan Jawaban/Kanan):** Kartu berlabel `B1`, `B2`, `B3`, dst. (diacak menggunakan PRNG Mulberry32).
  2. Siswa mengetuk salah satu kartu di Kolom A (status kartu berubah aktif dengan outline accent tebal).
  3. Siswa kemudian mengetuk kartu pasangan di Kolom B.
  4. Seketika kedua kartu ditandai dengan warna badge pasangan yang serasi (misal: A1 & B3 mendapatkan chip warna bernomor sama).
  5. Untuk membatalkan pasangan (*unpair*), siswa cukup mengetuk kembali kartu yang sudah terpasang atau tombol silang kecil (✕) pada chip pasangan.
- **Struktur Data Jawaban:**
  Tetap mempertahankan dictionary objek `{ [premisKey]: responValue }` sehingga 100% kompatibel ke belakang (*backward compatible*) dengan struktur `quizKeys` dan logika penilaian di `docs/js/admin/koreksi.js`.
- **Berkas Terdampak:**
  - `docs/js/siswa/exam-runner.js` (refactor fungsi render `q.tipe === "match"` dan state handler pasangan).
  - `docs/css/pages/siswa.css` (tambah kelas `.match-tap-grid`, `.match-card-item`, `.is-selected`, `.is-paired`).

---

### Fitur 2: Cache Materi Terversi di `localStorage` (Zero-Read Architecture)

- **Masalah Saat Ini:**
  Fungsi `loadMateri()` di `docs/js/siswa/materi.js` menggunakan kunci cache statis `lms_mat_${userProfile.kelas}` tanpa mekanisme pengecekan versi atau kedaluwarsa. Akibatnya, saat guru memperbarui atau menambahkan materi baru, siswa tidak dapat melihat modul terbaru kecuali menghapus data browser.
- **Arsitektur Cache Terversi (*Versioned Cache*):**
  1. Pada dokumen `classes/{kelas}` (yang sudah dibaca oleh aplikasi siswa saat autentikasi), ditambahkan field integer `materialsVersion: 1` atau timestamp `materialsUpdatedAt`.
  2. Kunci cache siswa menggunakan format: `lms_mat_${kelas}_v${materialsVersion}`.
  3. Alur Logika `loadMateri()`:
     ```mermaid
     flowchart TD
       Start([Siswa Buka Tab Materi]) --> CheckVersion{Cek materialsVersion dari Kelas}
       CheckVersion --> CheckStorage{Cache lms_mat_kelas_vX Ada?}
       CheckStorage -- Ya --> RenderCache[Render Instan dari LocalStorage: 0 Firestore Read]
       CheckStorage -- Tidak / Versi Berubah --> FetchDB[Query Firestore: collection materials]
       FetchDB --> SaveStorage[Simpan ke LocalStorage & Hapus Cache Versi Lama]
       SaveStorage --> RenderCache
     ```
  4. Saat guru membuat/mengedit/menghapus modul materi di `docs/js/admin/materi.js`, sistem secara otomatis melakukan `updateDoc(doc(db, "classes", kelas), { materialsVersion: increment(1) })`.
- **Keuntungan:**
  - Kunjungan harian siswa ke tab materi menghasilkan **0 kali baca (read)** ke koleksi `materials`.
  - Pembaruan dari guru terpropagasi seketika saat nomor versi berubah.
- **Berkas Terdampak:**
  - `docs/js/siswa/materi.js`
  - `docs/js/admin/materi.js`

---

### Fitur 3: Cadangan Jawaban Lokal (`sessionStorage`) saat Sinyal Putus

- **Masalah Saat Ini:**
  Auto-save jawaban CBT di `docs/js/siswa/exam-runner.js` bergantung pada fungsi *debounce* 800ms ke Firestore `attempts`. Jika koneksi seluler siswa tiba-tiba hilang (sinyal Edge/blank spot di sekolah) lalu halaman ter-refresh atau browser HP menutup tab karena kehabisan RAM, input terakhir yang belum sempat terkirim akan hilang.
- **Solusi Dua Lapis Penyimpanan (*Two-Tier Resilience*):**
  1. **Lapis 1 (Sinkron & Seketika):** Setiap kali siswa memilih opsi (PG/BS/Match) atau mengetik satu karakter pada Essay, jawaban langsung ditulis sinkron ke:
     `sessionStorage.setItem("lms_attempt_" + startId, JSON.stringify(examState.answers))`.
  2. **Lapis 2 (Asinkron & Debounce):** Timer 800ms tetap mengirim payload ke Firestore bila online.
  3. **Pemulihan Otomatis (*Auto Recovery*):**
     Saat `startQuiz()` dijalankan, state jawaban dibangun dengan menggabungkan:
     `savedAnswers = { ...(firestoreData.answers || {}), ...(sessionStorageAnswers || {}) }`.
  4. **Indikator Status Jaringan Real-Time:**
     Menambahkan event listener `window.addEventListener('online')` dan `offline`. Bila offline, status pill menampilkan badge kuning: `Mode Offline: Jawaban aman di HP`.
- **Berkas Terdampak:**
  - `docs/js/siswa/exam-runner.js`
  - `docs/css/pages/siswa.css`

---

### Fitur 4: Analisis Butir Soal & Tingkat Kesulitan di Halaman Koreksi

- **Masalah Saat Ini:**
  Di `docs/js/admin/koreksi.js`, guru hanya melihat kartu per siswa dan nilai total. Guru tidak memiliki gambaran butir soal mana yang paling banyak salah dijawab siswa untuk menentukan materi remedial.
- **Formula & Desain Analitik:**
  1. **Indeks Tingkat Kesulitan Butir ($P$):**
     $$P = \frac{\sum \text{Siswa Menjawab Benar}}{\text{Total Lembar Jawaban}}$$
  2. **Kategori Diagnostik:**
     - **Mudah ($P \ge 0.75$):** Mayoritas siswa menguasai kompetensi dasar ini.
     - **Sedang ($0.30 \le P < 0.75$):** Daya serap materi cukup baik.
     - **Sukar / Perlu Remedial ($P < 0.30$):** Indikator materi belum tuntas atau redaksi soal ambigu.
  3. **Tampilan UI:**
     Bento Strip ringkas di atas daftar koreksi siswa yang memuat:
     - Rangkuman tabel: No. Soal, Tipe, Rata-rata Skor, Status Kesulitan.
     - Callout rekomendasi cerdas: *"32 dari 36 siswa salah pada Soal No. 4 (Hukum Pascal) — disarankan materi ini diulang pada sesi penguatan kelas."*
- **Berkas Terdampak:**
  - `docs/js/admin/koreksi.js`
  - `docs/css/pages/admin.css`

---

### Fitur 5: Ekspor Rekap Nilai Ujian + Tugas Terpadu ke CSV

- **Masalah Saat Ini:**
  Guru saat ini harus mengunduh CSV rekap tugas dan CSV ujian secara terpisah (`exportTugasCSV` dan `exportUjianCSV`), kemudian menghabiskan waktu menggabungkan kolom-kolom tersebut secara manual di Microsoft Excel/Google Sheets untuk mengisi ledger nilai rapor.
- **Desain Format Ekspor Terpadu:**
  Satu berkas CSV komprehensif per kelas (`Rekap_Nilai_Terpadu_Kelas_{kelas}.csv`) dengan struktur kolom:
  ```csv
  UID,Nama Siswa,Kelas,Tugas_1,Tugas_2,Rata_Tugas,Ujian_1,Ujian_2,Rata_Ujian,Nilai_Akhir
  ```
- **Alur Kerja Pembuatan:**
  1. Mengambil seluruh user dengan `where("kelas", "==", targetKelas)`.
  2. Mengambil semua tugas dan kuis untuk kelas terkait.
  3. Mengambil koleksi `submissions` dan `results` siswa kelas tersebut.
  4. Mengagregasikan nilai tugas dan ujian menjadi satu baris per siswa dengan pembobotan nilai akhir (default: 40% Tugas + 60% Ujian, atau dapat disesuaikan).
- **Berkas Terdampak:**
  - `docs/js/admin/export-csv.js`
  - `docs/admin.html` (tambah tombol/modal opsi ekspor terpadu).

---

### Fitur 6: Pratinjau Interaktif Soal Sebelum Terbit di Quiz Builder (`qbuilder.js`)

- **Masalah Saat Ini:**
  Guru menyusun soal di `qbuilder.js` melalui formulir teks dan modal input, namun tidak bisa mencoba langsung simulasi tampilan soal (misalnya tata letak gambar, pembagian kolom soal menjodohkan, atau panjang opsi pilihan ganda) sebelum menekan tombol publikasi ke Firestore.
- **Solusi Fitur Preview:**
  1. Menambahkan tombol **"👁 Pratinjau Ujian"** pada panel builder kuis.
  2. Saat tombol diklik, modal pratinjau membuka canvas interaktif yang merender komponen siswa secara read-only (tanpa menulis ke database).
  3. Fitur di dalam Preview:
     - Toggle ukuran viewport: **Tampilan Smartphone (375px)** vs **Tampilan Desktop**.
     - Interaksi coba klik opsi PG, BS, dan kartu Tap-to-Pair MATCH untuk mengecek hasil acakan opsi.
- **Berkas Terdampak:**
  - `docs/js/admin/qbuilder.js`
  - `docs/css/components/modal.css`
  - `docs/admin.html`

---

### Fitur 7: PWA Ringan (*Progressive Web App* & Offline Fallback)

- **Masalah Saat Ini:**
  Aplikasi dibuka melalui browser mobile (Chrome/Safari) yang menampilkan bilah navigasi dan URL bar browser. Hal ini mengurangi ruang pandang layar siswa saat CBT dan berisiko siswa tidak sengaja menekan tombol *browser back*.
- **Komponen PWA:**
  1. **`docs/manifest.json`:**
     - `name`: "SITURI LMS — SMPN 1 Umbulsari"
     - `short_name`: "SITURI"
     - `display`: `standalone` (tampilan aplikasi penuh tanpa address bar browser).
     - `theme_color`: `#1d4ed8`
     - `background_color`: `#f8fafc`
     - Ikon aplikasi berukuran 192×192 dan 512×512 (SVG/PNG maskable).
  2. **`docs/sw.js` (Service Worker Ringan):**
     - **Cache Statis (Stale-While-Revalidate):** Menyimpan aset stylesheet (`css/*`), modul JavaScript (`js/*`), dan webfonts secara lokal di perangkat.
     - **Bypass Jaringan:** Seluruh panggilan ke domain Firebase (`firestore.googleapis.com`, `identitytoolkit.googleapis.com`) dilewatkan langsung (*Network Only*) agar tidak mengganggu integritas data kuis.
  3. **Pendaftaran Service Worker:**
     Ditambahkan pada `docs/index.html` dan `docs/admin.html`.
- **Berkas Terdampak:**
  - `docs/manifest.json` (baru)
  - `docs/sw.js` (baru)
  - `docs/index.html`
  - `docs/admin.html`

---

## 3. Matriks Dampak vs Kompleksitas

| Fitur | Dampak Pengguna | Kompleksitas Teknis | Efisiensi Kuota / Performa | Estimasi Ukuran Kode |
|---|---|---|---|---|
| **1. Tap-to-Pair MATCH** | Tinggi (Siswa CBT) | Sedang | Netral | ~90 baris JS, ~60 baris CSS |
| **2. Cache Materi Terversi** | Tinggi (Infrastruktur) | Rendah | Menghemat ribuan Firestore reads | ~40 baris JS |
| **3. Cadangan sessionStorage** | Sangat Tinggi (Reliabilitas) | Rendah | Mengurangi resiko kehilangan data | ~50 baris JS |
| **4. Analisis Butir Soal** | Tinggi (Pedagogis Guru) | Sedang | Netral (komputasi di sisi klien) | ~70 baris JS, ~40 baris CSS |
| **5. Ekspor Rekap Terpadu** | Tinggi (Administrasi Guru) | Sedang | Rendah (hanya saat klik ekspor) | ~90 baris JS |
| **6. Pratinjau Soal Builder** | Sedang (Kenyamanan Guru) | Sedang | Netral (komputasi di memory) | ~80 baris JS, ~30 baris CSS |
| **7. PWA Ringan** | Sangat Tinggi (Mobile Siswa) | Rendah | Mempercepat *First Contentful Paint* | 1 json, ~45 baris worker |

---

## 4. Urutan Fase Implementasi (Roadmap)

```mermaid
flowchart LR
  subgraph Fase 1: Keandalan & UX Siswa Mobile
    F1[1. Tap-to-Pair MATCH]
    F3[3. Cadangan sessionStorage]
    F7[7. PWA Ringan]
  end

  subgraph Fase 2: Efisiensi Biaya & Kuota
    F2[2. Cache Materi Terversi]
  end

  subgraph Fase 3: Analitik & Produktivitas Guru
    F6[6. Pratinjau Kuis Builder]
    F4[4. Analisis Butir Soal]
    F5[5. Ekspor Rekap Terpadu]
  end

  Fase 1 --> Fase 2 --> Fase 3
```

- **Tahap 1 (Fokus CBT Mobile):** Fitur 1 (Tap-to-Pair), Fitur 3 (sessionStorage Backup), dan Fitur 7 (PWA). Siswa langsung merasakan pengalaman ujian yang tahan banting dan ramah sentuhan.
- **Tahap 2 (Fokus Kuota Spark):** Fitur 2 (Cache Materi Terversi). Menjaga agar batas 50k reads harian Firebase tidak pernah terlampaui saat seluruh sekolah online bersamaan.
- **Tahap 3 (Fokus Guru & Rekap):** Fitur 6 (Preview Builder), Fitur 4 (Analisis Butir Soal), dan Fitur 5 (Ekspor Ledger Terpadu). Mempercepat pembuatan soal dan pengisian rapor semester.

---

## 5. Kriteria Keberhasilan (Definition of Done)

1. Siswa dapat menjodohkan seluruh butir MATCH di smartphone tanpa menggunakan elemen `<select>`.
2. Halaman materi dimuat dalam `< 300 ms` saat dibuka kembali tanpa menambah statistik reads Firestore Console.
3. Jawaban ujian tetap utuh setelah siswa mematikan WiFi/data seluler lalu memuat ulang (*refresh*) browser.
4. Guru dapat melihat persentase keberhasilan per nomor soal pada setiap kuis yang dikoreksi.
5. Satu file CSV terpadu berhasil dibuka di Microsoft Excel dengan data tugas dan ujian terisi lengkap per siswa.
6. Kuis dapat dipratinjau dalam resolusi mobile 375px sebelum diterbitkan ke kelas.
7. Aplikasi lolos audit PWA Lighthouse dengan status *Installable* (*Add to Home Screen* aktif).
8. Seluruh berkas JavaScript dan CSS tetap memenuhi aturan batas baris (`engineering/scripts/check-file-size.ps1` lulus 100%).
