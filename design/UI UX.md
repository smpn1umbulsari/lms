# UI UX.md — LMS Interaktif SMPN 1 Umbulsari

Spesifikasi kebutuhan UI/UX kanonik untuk LMS (Firebase Spark + GitHub Pages, $0).
Dokumen ini **menggantikan** `design/ui-spec.md` (v0.8 dark-teal) sebagai sumber kebenaran visual.

Kode aplikasi: `docs/index.html` (Siswa) · `docs/admin.html` (Guru) · `docs/404.html`
Mockup referensi (versi redesign ini): `D:/Program/hermes/cache/scratch/lms-redesign/index.html`

---

## 1. Prinsip

1. **Satu aksi utama per layar.** Setiap layar punya satu tombol paling terang; sisanya ghost/outline.
2. **Hirarki lewat garis, bukan kotak.** Pemisahan pakai hairline 1px + spasi; `box-shadow` hanya untuk
   dialog/overlay. Kartu tanpa border hanya bila sudah dipisah garis.
3. **Ruang vertikal itu mahal.** Di layar 1366×768 viewport efektif ~550px. Tidak boleh ada blok
   filter/header yang makan >100px vertikal. Stats bukan 4 kartu, tapi **1 baris strip**.
4. **Angka rata.** Semua angka (nilai, jam, tanggal, count) pakai `font-variant-numeric: tabular-nums`
   supaya kolom lurus saat diaudit sekilas.
5. **Anti-panik.** Tidak ada `alert()`/`confirm()` bawaan browser, tidak ada spinner di layar putih
   kosong, tidak ada merah menyala di atas sel kosong. Guru senior harus selalu tahu "apakah sistemnya
   hang atau memang sedang memuat".
6. **Aksesibilitas dasar bukan opsional.** Semua elemen interaktif punya `:focus-visible`, kontras teks
   minimal 4.5:1, input punya `<label>`, animasi hormati `prefers-reduced-motion`.
7. **Satu komponen, dua viewport.** Tidak ada markup ganda (tabel desktop + kartu mobile) yang
   bergantung pada framework CSS yang mungkin tidak termuat.

---

## 2. Design Tokens

Semua warna, font, radius, dan spacing **wajib** lewat token di `:root`. Dilarang literal warna di luar
blok token.

### 2.1 Light (kanonik — light editorial minimal)

| Token | Nilai | Pakai |
|---|---|---|
| `--paper` | `#fbfbfa` | background app |
| `--surface` | `#ffffff` | kartu, input, baris |
| `--line` | `#e7e5e0` | border 1px, hairline pemisah |
| `--line-soft` | `#f0eeea` | pemisah baris dalam list |
| `--ink` | `#14161a` | judul, angka, tombol primary |
| `--ink-2` | `#5b6169` | label, meta |
| `--ink-3` | `#8d939b` | placeholder, keterangan |
| `--accent` | `#0f6b5c` | aksi primer, state aktif, progres |
| `--accent-soft` | `#e9f1ef` | badge aktif, chip terpilih |
| `--ok` | `#1f7a5c` | benar, tersimpan |
| `--warn` | `#a4672a` | tenggat, peringatan |
| `--danger` | `#b3261e` | hapus, gagal |

### 2.2 Dark (variabel, nilai saja yang ditukar)

| Token | Nilai |
|---|---|
| `--paper` | `#0d1117` |
| `--surface` | `#151b23` |
| `--line` | `#252d38` |
| `--line-soft` | `#1e252f` |
| `--ink` | `#f2f5f7` |
| `--ink-2` | `#a3adba` |
| `--ink-3` | `#6f7b8a` |
| `--accent` | `#4ec8b0` |
| `--accent-soft` | `#14312c` |

Semua komponen **wajib** dibangun dari token, bukan warna, agar dark mode = ganti `:root` saja.

### 2.3 Tipografi

- Family: `Inter` → fallback `-apple-system, "Segoe UI", Roboto, sans-serif`. Maksimal 2 family.
- Base 14px desktop / 14px mobile. `line-height: 1.45`.
- Skala: h1 26 (weight 600, `letter-spacing:-.03em`) · h2 13 (weight 600, heading panel) · h3 16 ·
  body 13.5 · label 12.5 · meta 12 · badge 11.
- **Tidak ada** label kapital/tracked, tidak ada eyebrow, tidak ada meta string yang dirangkai
  dengan titik tengah. Label memakai body face satu langkah lebih kecil.
- **Tidak pernah** satu kata miring di dalam judul roman.

### 2.4 Radius, spacing, ikon

- Radius: kartu 12 · input/button 9 · chip/badge 6 · pill 999.
- Spacing scale: 4 · 8 · 10 · 12 · 14 · 16 · 20 · 26 · 34.
- Ikon: SVG inline stroke 1.6px, 18px (desktop rail) / 20px (mobile nav). Tanpa emoji sebagai ikon.
- `overflow-x: clip` pada `html` dan `body` (bukan `hidden`, bukan `100vw`).
- Track yang memuat gambar: `minmax(0, 1fr)`.

---

## 3. Cangkang Layout

### 3.1 Desktop (≥ 992px)

```
┌──────┬─────────────────────────────────────────────┐
│ rail │  header: h1 + sub (kiri) · ghost + primary   │
│ 64px │  strip stats 1 baris (4 kolom, hairline)     │
│      │  konten: 2 kolom (1.45fr / 1fr)              │
└──────┴─────────────────────────────────────────────┘
```

- **Rail 64px, ikon saja**: mark (32px, radius 9) → 6 ikon (Beranda, Materi, Asesmen, Penilaian,
  Kelas, Pengaturan) → spacer → avatar 32px. Aktif = ikon accent + bg `--accent-soft`, radius 10.
  Tidak ada teks di rail (hemat lebar, appeared "modern").
- **Main**: padding 34px 44px 30px, `max-width: 1040px`, rata kiri (bukan center) — halaman konten
  tidak boleh ter-center di layar lebar.
- **Header**: h1 + satu baris sub (`. ·` sebagai pemisah meta boleh di subjudul, bukan di label
  dalam chip). Aksi kanan: 1 ghost + 1 primary (primary = `--ink` solid, teks putih).
- **Strip stats**: 1 baris, 4 kolom, dipisah `border-top`/`border-bottom` 1px + `border-left` antar
  kolom. Isi: label (12.5, ink-3) / nilai (29, weight 600, tabular) / keterangan (12, ink-2).
  **Dilarang** 4 kartu grid tinggi di atas tabel.
- **Panel**: judul 13px + hairline bawah; isi=list row (padding 12px 0, hairline `--line-soft`).
  Tidak ada border card, tidak ada shadow.

### 3.2 Mobile (≤ 768px)

```
┌──────────────────────────────┐
│ sapaan + nama        avatar   │  sticky header
│ kartu CTA (1 aksi utama)     │
│ strip stats 3 kolom          │
│ list section                 │
├──────────────────────────────┤
│ Beranda │ Materi │ Ulangan │ Nilai │  bottom nav 4 tab
└──────────────────────────────┘
```

- Rail disembunyikan, navigasi jadi **bottom nav 4 tab** (ikon + label 10.5px, aktif = accent).
  Empat item evenly, ikon 20px + label 10.5px, aktif = accent, justify space-around.
- Greeting block: "Selamat pagi" (12.5, ink-3) di atas nama (19, weight 600).
- **Kartu CTA utama**: kartu hari ini dengan badge pill (accent-soft) → judul → meta (waktu, durasi,
  kelas) → tombol full-width hitam (12px pad). Hanya SATU kartu bertipe ini per layar.
- Strip stats 3 kolom tanpa kartu, dipisah hairline.
- Body padding 0 20px; semua container `width:100%; max-width:100%; box-sizing:border-box`.
- **Nol horizontal scroll**: `overflow-x: clip` + `minmax(0,1fr)` + hide-scrollbars.

---

## 4. Pola Komponen

| Komponen | Spesifikasi |
|---|---|
| **Primary button** | bg `--ink`, teks putih, radius 9, pad 9px 16px (mobile 12px, width 100%). 1 per layar. |
| **Ghost button** | border 1px `--line`, bg `--surface`, teks `--ink-2`, radius 9. |
| **Danger button** | teks `--danger`, dipisah ≥32px dari primary. |
| **Input / Select / Textarea** | bg `--surface`, border 1px `--line`, radius 9, pad 10px 12px, `font-size:16px` di mobile (anti auto-zoom iOS). Label selalu ada di atas (12.5, ink-2), `for` = `id`. |
| **Search + filter** | 1 baris: input search + 1 select kelas + chip filter status. Tidak dibungkus kartu filter tebal. |
| **Stat strip** | Lihat §3.1/§3.2. Label + nilai + keterangan, tanpa kartu. |
| **List row** | judul (13.5, weight 500) / meta (12.5, ink-3) / aksi kanan (ghost icon). Pemisah hairline `--line-soft`, padding 12px 0. |
| **Badge tipe soal** | `PG` accent · `BS` ok · `MATCH` warn · `ESSAY` danger. Kapsul, `flex-shrink:0`. |
| **Badge status** | `Tenggat` warn · `Tersimpan` ok · `Ujian` accent · `Draft` ink-3. |
| **Progress bar** | tinggi 3px, radius 2, track `--line`, isi accent. Label persen di atas (12.5). |
| **Table (desktop)** | pad 6px 10px, font 0.78rem, kolom nama sticky kiri, zebra **hanya** di light mode (`html:not([data-theme=dark])`), `tr:focus-within` = highlight accent 12%. |
| **Kartu mobile** | replacing tabel: no, nama (ellipsis 1 baris), badge identitas, aksi cepat. Tinggi ~52–62px. |
| **Dialog** | Desktop: modal center, max 560px, header/footer tinggi tetap, body scroll. Mobile: **bottom sheet** (rounded top, drag handle), aksi destructive di bawah jangkauan mudah. |
| **Toast** | pill melayang, radius 30px, blur, auto-dismiss 3s, untuk aksi rutin (simpan, update, validasi). |
| **Callout** | bg `--surface`, garis aksen kiri 4px, untuk info kontekstual dalam kartu. |
| **SweetAlert2** | HANYA untuk aksi fatal (hapus data, reset, publish massal, logout, hapus semester). Modal blocking + deskripsi dampak. |
| **Skeleton shimmer** | saat load data: shimmer halus 1.5s, ganti spinner. |
| **Empty state** | satu kalimat + 1 aksi ("Belum ada materi. Buat materi pertama."). Bukan gambar besar. |
| **Error state** | kalimat manusiawi + aksi ulang: "Gagal memuat data. Periksa koneksi lalu coba lagi." |

---

## 5. Spesifikasi Layar

### 5.1 Guru (`admin.html`)

Navigasi: rail ikon (desktop) → drawer (mobile). Section: `#sec-auth`, `#sec-ringkasan`, `#sec-materi`,
`#sec-tugas`, `#sec-asesmen`, `#sec-grading`.

**Login** — 1 kolom max 360px, kartu logo + judul "Login Guru" + email + password + tombol Masuk +
link "Lupa sandi?". Error: callout warn di atas field, bukan alert.

**Ringkasan (dashboard)** — sesuai §3.1: h1 "Ringkasan" + sub "Semester ganjil · 2026/2027 · 6 kelas
aktif"; aksi `Ekspor nilai` (ghost) + `Buat ujian` (primary). Strip stats 4 kolom: Materi / Menunggu
Dinilai / Ulangan terjadwal / Kehadiran. 2 kolom: "Aktivitas terbaru" (list row, dot status kiri) +
"Jadwal hari ini" (list row jam di kiri) dengan blok "Progres penilaian" (bar + persen) di bawahnya.
Mobile: kartu hari ini (jadwal/tes terdekat) → strip stats 3 kolom → list aktivitas.

**Materi** (`#sec-materi`) — toolbar: search `#materi-search` + select `#materi-kelas` + tombol
`+ Tambah Materi`. List materi: judul, meta (kelas · tanggal · jumlah tautan), badge tipe
(Teks/Link/Video), aksi `Lihat` `Edit` `Hapus`. Panel form `#mat-form-panel` (buka overlay, bukan
memperpanjang halaman): Judul, Chip multi-kelas `#materi-kelas-chips`, Isi ringkasan (textarea),
Link tambahan + preview embed, tombol Batal/Simpan Materi.

**Tugas** (`#sec-tugas`) — toolbar: search `#tug-search` + select `#tug-kelas` + `+ Buat Tugas Baru`.
Form `#tug-form-panel`: Judul, Chip kelas, Tenggat (`datetime-local` → tampil "23 Nov 2026, 15.00"
dalam format Indonesia, angka tabular), Instruksi, Link. Daftar kiriman `#tug-sub-panel`: tabel
desktop (nama, kelas, waktu submit, status, nilai) / kartu mobile; aksi `Lihat Kiriman` `Edit` `Hapus`;
tombol `Unduh Rekap Nilai Tugas` di toolbar (bukan di dalam kartu).

**Asesmen / Builder** (`#sec-asesmen`) — form `#as-code` `#as-kelas` `#as-mode` (Latihan|Ujian)
`#as-judul` `#as-durasi` `#as-tol` `#as-open` `#as-close`. Panel "Tulis Soal": 4 tipe soal
(PG, Benar/Salah, Mencocokkan, Essay) masing-masing dengan editor + badge warna; `+ Tambah Soal`
menggantung di bawah. Simpan: `Simpan & Terbitkan Asesmen` (primary). Pengaturan asesmen: toggle
acak soal, tampilkan kunci, timer per siswa. Daftar asesmen terbit: status + jumlah soal +
jumlah pengumpulan.

**Koreksi / Penilaian** (`#sec-grading`) — kode asesmen `#gr-code` → muat lembar jawaban. Panel
`#gr-eval-panel`: satu baris per butir soal; PG/BS/MATCH **auto-check** (benar/salah) — nilai
terhitung otomatis; Essay dinilai manual (input nilai + catatan). Navigasi antar-siswa dengan
`‹ ›` (bukan dropdown) supaya cepat. `Simpan Nilai` primary, `Publikasikan Nilai Batch ke Siswa`
terpisah (aksinya irreversible → SweetAlert2). Ekspor `Unduh Rekap CSV`.

### 5.2 Siswa (`index.html`)

Navigasi: 4 tab `Materi` `Tugas` `Asesmen & Ujian` `Nilai Saya` + bottom nav mobile. Section:
`#sec-login`, `#sec-dashboard`, `#tab-materi`, `#tab-tugas`, `#tab-asesmen`, `#sec-nilai`, `#sec-exam`,
`#sec-result`.

**Login** — kartu tunggal, "Masuk Siswa", email + password, error `#login-err` sebagai callout warn.

**Beranda (`#sec-dashboard`)** — sesuai §3.2: greeting, kartu CTA (ulangan hari ini / tugas terdekat
— hanya satu), strip stats 3 (Materi / Tugas aktif / Rata nilai), list "Lanjut belajar" dengan
progress bar per materi. Kartu materi thumbnail 44px + judul + meta (kelas · durasi baca).

**Materi** — grid/list materi relevan dengan kelas siswa (`users/{uid}.kelas`). Klik → panel baca:
judul, isi teks, tombol "Buka Tautan Materi", embed YouTube responsif 16:9. Badge "Telah dibaca".

**Tugas** — kartu tugas: judul, instruksi ringkas, tenggat (badge warn + tanggal Indonesia),
status (Belum dikumpulkan / Terkumpul + waktu). `#sub-modal`: textarea `#sub-teks` + input URL
`#sub-link` + tombol Kirim; setelah kirim tampilkan badge "Tersimpan" + waktu, dan tombol Ubah
(rather than duplicate submit).

**Asesmen & Ujian** — daftar asesmen aktif (jenis soal, jumlah soal, durasi, status bayar).
Masuk ujian → `#sec-exam`: satu soal per layar dengan progres "Soal 3 dari 12", navigasi
sebelum/selesai, dan timer pill mm:ss (dimulai saat soal pertama dibuka). Jawaban tersimpan lokal
per soal (localStorage) agar refresh tidak menghapus isian. `#sec-result`: skor, benar/salah,
daftar soal + kunci (jika diizinkan), tombol "Kembali ke beranda".

**Nilai Saya** — 2 tabel rekap (tugas & ujian): kolom nilai, rata-rata dengan 1 desimal
(coma desimal Indonesia), badge predikat. Mobile: kartu ringkas per asesmen (nilai + tanggal).
Kosong → empty state "Belum ada nilai masuk."

---

## 6. Aturan Responsif

1. Breakpoint: mobile ≤768px · tablet 769–991px · desktop ≥992px.
2. **Tabel lebar → kartu** pada ≤768px. Kalau markup ganda dipakai, `@media` wajib eksplisit di
   stylesheet (jangan andalkan `hidden-xs` dari framework yang mungkin tidak termuat).
3. Kolom sticky (desktop): `position: sticky; left: 0; z-index: 10` + `will-change: transform;
   transform: translateZ(0)` untuk scroll 60fps.
4. Input mobile: `font-size: 16px !important` (anti auto-zoom iOS), tinggi ≥40px, min target
   sentuh 44×44px.
5. Judul panjang di header mobile: `white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
   max-width:160px` + badge semester disembunyikan ≤640px.
6. Tab horizontal (bila >4 tab): `overflow-x:auto; scrollbar-width:none` + auto-center tab aktif
   via `scrollIntoView({inline:'center'})` setelah re-render.
7. Drawer/sidebar mobile: `transform: translateX(-100%)`, `.open { transform: translateX(0) !important }`
   — tanpa `!important` tombol hamburger tampak mati.
8. Semua breakpoint: `overflow-x: clip` global, tidak boleh ada elemen keluar viewport.

---

## 7. State & Feedback (WAJIB di setiap layar)

| State | Perlakuan |
|---|---|
| Loading | Skeleton shimmer, bukan spinner, bukan layar putih kosong. |
| Kosong | 1 kalimat + 1 aksi. |
| Error | Kalimat manusiawi + tombol "Coba lagi". |
| Sukses rutin | Toast pill 3s ("Materi tersimpan"). |
| Sukses kritis | SweetAlert2 dark/light. |
| Simpan otomatis | Input nilai tersimpan ke localStorage (debounce 300–600ms) + badge "Data aman tersimpan di laptop (HH:mm)". |
| Offline | Badge strip kecil di header: "Offline — perubahan disimpan lokal". |
| Keyboard | `Enter`/`ArrowDown` memindah fokus ke baris berikutnya di input nilai; `Tab` pindah kolom. |

---

## 8. Aksesibilitas

1. Semua elemen interaktif: `:focus-visible` outline 2px accent, offset 2px, muncul instan.
2. Rasio kontras teks minimal 4.5:1 (ink-3 di atas paper ≥ 4.6:1; ink-2 ≥ 7:1).
3. Semua input punya `<label for>`; ikon saja diberi `aria-label`.
4. Navigasi = elemen semantic (`nav`, `button`, `a`), bukan `div` + onclick.
5. `prefers-reduced-motion: reduce` → semua transisi/marker dimatikan; konten tetap terlihat tanpa JS.
6. Area sentuh minimal 44×44px di mobile; target keyboard tidak pernah hilang (`Tab` order mengikuti DOM).
7. Warna tidak pernah menjadi satu-satunya penanda status (chip selalu punya teks).

---

## 9. Micro-interaksi & Perilaku

1. Navigasi **persist**: rute/tab aktif disimpan di `localStorage`, pulih saat refresh (anti-reset).
2. Transisi: hanya `transform` & `opacity`, 150–250ms. Dilarang `transition: all`, dilarang animasi
   `width/height/top/left`.
3. Re-render tidak boleh mereset `scrollLeft` tab atau posisi scroll tabel → re-center tab aktif.
4. Autosave: nilai & isian soal tersimpan lokal; tombol "Simpan" hanya untuk aksi yang perlu backend.
5. Tidak ada navigasi ke halaman baru untuk aksi ringan — panel/overlay, agar konteks tidak hilang.

---

## 10. Batasan Teknis yang Mengikat UI

1. **Kuota Firebase Spark**: membaca daftar sekali per sesi, cache payload di `localStorage` per
   `version`;/list read harus lazy (hanya saat tab/filter dibuka).
2. **Tidak ada binary storage**: materi & tugas = teks + link eksternal. UI harus-btn disabled +
  jelaskan "Unggah berkas belum tersedia" bila user minta.
3. **1 submission per siswa per tugas**: ID dokumen deterministik `{uid}__{assignmentId}`; tombol
   "Kirim" berubah jadi "Perbarui" setelah terkirim — jangan tawarkan kirim kedua.
4. **Firestore rules**: UI tidak boleh menampilkan aksi yang pasti ditolak server (mis. "Hapus" pada
   submission orang lain).
5. **Anggaran DOM**: 1.000 siswa × 27 rombel — jangan render thousands of `<select>`; pakai popover
   on-demand atau virtualisasi sederhana.
6. **Gas/hosting**: file produksi tetap statis (`docs/`), tanpa dependensi build wajib.

---

## 11. Persona & Skenario Uji

- **Guru senior (Pak Awam, non-IT)**: login, buat tugas, koreksi essay, ekspor CSV. Ukuran font
  angka minimal 16px, target ≥44px, tidak ada tombol warna-warni yang mencolok, tidak ada modal yang
  menutupi data penting, tidak ada langkah yang tidak bisa dibalik.
- **Guru muda**: butuh cepat menyalin kelas & Menyusun soal tipe ganda. Butuh tombol duplikasi &
  bulk action.
- **Siswa SMP kelas VIII**: HP 360–420px, jaringan sering jelek, sering refresh. Wurung: nilai tugas
  tidak boleh hilang, harus jelas kapan tersimpan, dan "Kerjakan sekarang" harus reachable satu jempol.

Skenario uji minimal (3 putaran, wajib bukti nyata — bukan klaim):
1. Guru membuat tugas → siswa melihatnya di tab Tugas dengan tenggat benar → siswa submit →
   guru melihat kiriman + nilai.
2. Guru membuat asesmen 4 tipe soal → siswa mengerjakan 1 soal → timer jalan → skor & kunci benar.
3. Guru mengoreksi essay → publish batch → siswa melihat nilai di "Nilai Saya".
Tambahan: dump rate lambat/offline, zoom browser 200%, keyboard-only, dan layar 360px.

---

## 12. Checklist Selesai (DoD per layar)

- [ ] Token dipakai semua; nol literal warna di luar `:root`.
- [ ] Render 2 versi wajib: **Desktop 1150px** dan **Mobile 420px** (HTML asli + Chrome Headless,
      bukan gambar PIL bitmap).
- [ ] Nol horizontal scroll di 360/420px (dicek via `document.documentElement.scrollWidth`).
- [ ] Semua state ada: loading / kosong / error / sukses.
- [ ] Semua tombol punya `aria-label` bila ikon-saja; semua input punya `<label>`.
- [ ] Fokus terlihat; urutan Tab masuk akal; `prefers-reduced-motion` dihormati.
- [ ] Angka tabular; tidak ada label kapital/tracked; tidak ada emoji sebagai ikon.
- [ ] Tidak ada `alert()`/`confirm()`; tidak ada spinner di layar putih.
- [ ] Diuji 3 putaran dengan log/output riil (screenshot + dump console).

---

## 13. Peta ke Implementasi

| Area | Lokasi |
|---|---|
| Token & shell | `:root` + `.rail` / `.main` di `docs/admin.html` (Guru), `docs/index.html` (Siswa) — **satu set token dipakai kedua halaman** (file token bersama bila memungkinkan). |
| Rail & drawer | `admin.html` (ikon rail + `#sidebar-toggle` drawer mobile) |
| Strip stats | `#sec-ringkasan` (`#rk-materi`, `#rk-tugas`, `#rk-asesmen`, `#rk-kiriman`) |
| List & form | `#sec-materi`, `#sec-tugas`, `#sec-asesmen` |
| Koreksi | `#sec-grading` + `#gr-eval-panel` |
| Tabs siswa | `#tab-materi`, `#tab-tugas`, `#tab-asesmen`, `#sec-nilai` |
| Ujian | `#sec-exam`, `#sec-result` |
| Toast/callout | satu helper global, dipakai kedua halaman |

Dokumen terkait: `prd/PRD LMS Interaktif v0.8 - Materi Tugas Asesmen.md` (fitur & skema data),
`prd/requirements.md`, `firestore.rules` (batas UI yang boleh ditampilkan).
