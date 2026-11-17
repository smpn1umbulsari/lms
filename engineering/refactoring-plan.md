# Rencana Refactoring — Pemecahan File Monolit

## 1. Kondisi Saat Ini

Aplikasi adalah static site (Firebase Hosting, folder `docs/`) tanpa build step. Dua file memuat semuanya (CSS, HTML, JS inline):

| File | Baris | CSS | HTML | JS (`<script type="module">`) |
|---|---|---|---|---|
| `docs/admin.html` | 3037 | L12–1107 (~1100) | L1111–1970 (~860) | L1973–3178 (~1200) |
| `docs/index.html` | 1672 | L12–823 (~810) | L825–1092 (~270) | L1095–1763 (~670) |

Masalah: sulit direview, konflik merge tinggi, fungsi duplikat di kedua file (`applyTheme`, `escAttr`, `mediaEmbed`, `urlsOf`, `embedsHTML`, toast), CSS duplikat (token tema, sidebar, tombol, kartu), tidak bisa di-cache terpisah.

## 2. Target Struktur

Tetap tanpa bundler: gunakan ES Modules native dan `<link rel="stylesheet">`. Tidak perlu mengubah `firebase.json`.

```
docs/
  index.html                # shell siswa (<= 150 baris)
  admin.html                # shell guru (<= 150 baris)
  firebase-config.js
  css/
    base/        tokens.css, reset.css, typography.css, themes.css
    components/  button.css, card.css, form.css, table.css, modal.css, toast.css, tabs.css
    layout/      sidebar.css, topbar.css, bottom-nav.css, grid.css
    pages/       admin-ringkasan.css, admin-materi.css, admin-tugas.css,
                 admin-asesmen.css, admin-koreksi.css, siswa-*.css
  js/
    core/        firebase.js, theme.js, toast.js, dom.js (escAttr), media.js, auth.js, router.js
    shared/      quiz-utils.js (fnv1a, mulberry32, shuffle), format.js
    admin/       main.js, ringkasan.js, materi.js, tugas.js, asesmen.js,
                 qbuilder.js, koreksi.js, export-csv.js
    siswa/       main.js, materi.js, tugas.js, asesmen.js, exam-runner.js, nilai.js
  partials/      (opsional) fragmen HTML per section, dimuat via fetch / template
```

## 3. Tahapan (tiap fase = 1 PR/commit, aplikasi tetap berjalan)

| Fase | Pekerjaan | Risiko | Verifikasi |
|---|---|---|---|
| 0 | Baseline: catat screenshot desktop/mobile semua tab, jalankan `loadtest` & `rules.test.mjs`. Buat branch `refactor/split-monolith`. | Rendah | Screenshot disimpan di `engineering/baseline/` |
| 1 | **Ekstrak CSS** dari kedua file ke `css/`. Mulai dari token/tema (`:root`, dark mode), lalu komponen bersama, lalu per-halaman. Hapus duplikasi. | Rendah | Diff visual vs baseline |
| 2 | **Ekstrak util murni** ke `js/core` & `js/shared` (`applyTheme`, `escAttr`, `mediaEmbed`, `urlsOf`, `embedsHTML`, `showToast`, `fnv1a`, `mulberry32`, `shuffle`). Kedua halaman mengimpor modul yang sama. | Rendah | Tes manual tema/toast/embed |
| 3 | **Ekstrak inisialisasi Firebase & auth** ke `js/core/firebase.js`, `auth.js`. Satu sumber `db`, `auth`, helper `getDoc/...`. | Sedang | Login/logout, rules test |
| 4 | **Pecah JS siswa** per tab: `materi`, `tugas`, `asesmen`, `exam-runner`, `nilai`. `main.js` hanya merangkai & routing tab (`activateStudentTab`). | Sedang | Alur ujian end-to-end (mulai, autosave, submit) |
| 5 | **Pecah JS admin** per section: `ringkasan`, `materi`, `tugas`, `asesmen`, `qbuilder`, `koreksi`, `export-csv`. `switchAdminTab` pindah ke `core/router.js`. | Sedang | CRUD tiap section, ekspor CSV, koreksi |
| 6 | **Pecah HTML** (opsional): section admin besar dipindah ke `partials/*.html` atau di-render dari template literal di modul section. Pertimbangkan hanya jika shell masih >300 baris. | Sedang | Render semua tab |
| 7 | Bersihkan: hapus kode mati, `<style>` inline (mis. `index.html` L1298), inline `onclick` → `addEventListener`. Pasang pengecek ukuran file (lihat aturan). | Rendah | Lint lulus |

Urutan sengaja dari paling aman (CSS, util murni) ke paling berisiko (state & Firestore).

## 4. Anggaran Ukuran Hasil Akhir (estimasi)

- Shell HTML: ≤ 150 baris masing-masing
- Tiap modul JS: 80–300 baris
- Tiap file CSS: 30–250 baris
- Tidak ada file kode > 400 baris

## 5. Strategi Teknis

- **Modul ES native**: `<script type="module" src="js/admin/main.js">`; impor relatif dengan ekstensi `.js`.
- **Dependensi antar-modul satu arah**: `pages → features → shared → core`. Dilarang impor melingkar.
- **State bersama** (user, role, daftar kelas) disimpan di `core/state.js`, bukan variabel global/`window`.
- **Handler inline** (`onclick="..."`) yang memerlukan global diganti event delegation berdasarkan `data-action`.
- **Cache busting**: tambahkan `?v=<hash>` pada `<link>`/`import` saat deploy, atau atur header cache di `firebase.json`.
- **Jangan ubah perilaku** selama refactor; perbaikan bug/desain dilakukan di PR terpisah.

## 6. Status Eksekusi

- [x] Ekstrak CSS ke modul terpisah (`docs/css/base/`, `components/`, `layout/`, `pages/`)
- [x] Perbaikan sidebar desktop: teks menu (`.nav-label`) tampil jelas dengan width 240px
- [x] Ekstrak fungsi util bersama (`theme.js`, `toast.js`, `dom.js`, `media.js`, `quiz-utils.js`)
- [x] Ekstrak inisialisasi Firebase & Auth (`docs/js/core/firebase.js`)
- [x] Pecah modul JS siswa (`docs/js/siswa/`: `materi`, `tugas`, `asesmen`, `exam-runner`, `nilai`, `main`)
- [x] Pecah modul JS admin (`docs/js/admin/`: `ringkasan`, `materi`, `tugas`, `asesmen`, `qbuilder`, `koreksi`, `export-csv`, `main`)
- [x] Bersihkan `docs/admin.html` (dari 3.037 baris turun menjadi 855 baris — berkurang 72%)
- [x] Bersihkan `docs/index.html` (dari 1.672 baris turun menjadi 277 baris — berkurang 83%)
- [x] Tidak ada file modul JS yang melebihi batas 400 baris
- [x] Tidak ada file CSS yang melebihi batas 300 baris
- [x] Skrip penegak batas ukuran file aktif di `engineering/scripts/check-file-size.ps1`


## 7. Catatan Terkait

`design/stitch/screens/*.html` (hingga 617 baris) adalah artefak desain hasil generate, bukan kode produksi; dikecualikan dari batas ukuran.
