# LMS SITURI — Figma-ready UI Spec (v0.8 fitur: Materi, Tugas, Asesmen 4-tipe)

Sumber visual: `guru_mock.html` / `siswa_mock.html` (render 1150 & 420). Spec ini untuk disusun ulang sebagai frame Figma dengan Auto Layout.

## 1. Design Tokens (pakai sebagai Figma Variables / Color Styles)
| Token | Hex | Pakai |
|---|---|---|
| bg | #090d16 | background app |
| panel | #111827 | kartu utama |
| panel-2 | #0f172a | kartu dalam / sidebar |
| line | #1f2937 | border 1px |
| text | #e5e7eb | teks utama |
| muted | #94a3b8 | label / meta |
| accent | #3b82f6 | aksi primer, aktif |
| ok | #22c55e | benar, tersimpan |
| warn | #f59e0b | tenggat |
| danger | #ef4444 | essay/manual |

Type: **Inter** (fallback -apple-system, Roboto). Base 14px.
Scale: h1 22 (guru) / 20 (siswa), body 13–14, label 12, meta 11.5, badge 10.5–11.
Radius: kartu 14, kartu-dalam 12, input/button 9–10, pill 999.
Spacing scale: 4 · 8 · 10 · 12 · 14 · 16 · 18 · 22 · 26.
Border: 1px solid `line`. Shadow: none (flat dark). Badge = kapsul `padding 3–4px 8–9px`.

## 2. Komponen (Figma Component / Variant)
- **Badge Tipe Soal** — variant: `PG`(biru #93c5fd bg rgba(59,130,246,.15)), `BS`(hijau #86efac), `MATCH`(amber #fcd34d), `ESSAY`(merah #fca5a5).
- **Badge Status** — `Tenggat`(warn), `Tersimpan`(ok), `Ujian/Latihan`(accent). `flex-shrink:0`.
- **Seg Toggle** (Latihan|Ujian) — track `bg #0b1220`, item aktif `accent`.
- **Timer Pill** — ⏱ + mm:ss, border accent, kapsul.
- **Nav Item** (guru) — ikon 18px + label; state aktif gradient accent.
- **Tab** (siswa) — 3 item equal-flex; aktif `accent`.
- **Card** — panel bg, border line, radius 14, padding 16.
- **Input / Select / Textarea** — bg #0b1220, border line, radius 9, padding 10–12.
- **Button** — `prim`(accent solid), `ghost`(bg #0b1220 + border).

## 3. Frame: GURU — Asesmen Builder
- **Desktop 1150×auto** — Grid 2 kolom: `Sidebar 240` + `Main`.
  - Sidebar: brand + nav list (Materi, Tugas, **Asesmen aktif**, Penilaian, Kelas) + footer.
  - Main (Auto Layout vertikal, gap 14): Header (H1 + user chip) → Sub → Tabs (4) → Card form (Judul+Kelas; Durasi+Seg) → Soal×4 (PG, BS, Match, Essay) → Footer (+Tambah / Simpan).
- **Mobile 420×auto** — sidebar hidden; semua stack 1 kolom (gap 12). Form row → vertikal.
- Auto Layout hints: main padding 22/26; card padding 16; gap soal 12.

## 4. Frame: SISWA — Materi + Tugas + Asesmen
- **Desktop 1150×auto** — wrap max 1080, 2 kolom (grid gap 14).
  - Kiri: Card "Materi Terbaru" (list `.mat` thumb 44 + judul + meta) ; Card "Kumpulkan Tugas" (textarea + input link + btn Kirim + badge tersimpan).
  - Kanan: Card Asesmen (header + timer pill → Soal×4 → btn Selesai).
- **Mobile 420×auto** — 1 kolom, urutan: Materi → Kumpul Tugas → Asesmen.

## 5. Catatan untuk Figma
- Pakai **Auto Layout** di semua card & row (gap = spacing scale) agar responsif desktop↔mobile.
- Mobile: set frame width 420, `clip content`, tak ada horizontal scroll.
- Essay sengaja beda warna (merah) = sinyal "dinilai manual".
- Butuh tambahan frame **Penilaian (grading essay)** & **Login** — belum ada di spec ini; minta kalau perlu.
