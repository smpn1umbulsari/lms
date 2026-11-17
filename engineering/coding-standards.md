# Aturan Penulisan Kode — Batas Ukuran & Struktur

## 1. Batas Ukuran File

| Jenis | Disarankan | Batas keras |
|---|---|---|
| JS (modul) | ≤ 250 baris | **400** |
| CSS | ≤ 200 baris | **300** |
| HTML (halaman/shell) | ≤ 120 baris | **200** |
| HTML partial/template | ≤ 150 baris | **250** |
| Test | ≤ 300 baris | **500** |
| Dokumen (`.md`) | bebas | — |

- Melewati "disarankan" → pertimbangkan memecah pada PR berikutnya.
- Melewati "batas keras" → **tidak boleh di-merge**, kecuali ada pengecualian tertulis (lihat §6).
- Baris dihitung termasuk komentar dan baris kosong.

## 2. Batas Ukuran Unit

- Fungsi: ≤ **40 baris** (maks 60). Lebih dari itu, pecah menjadi fungsi bernama.
- Nesting: maks **3 level** (if/for/callback). Gunakan early return.
- Parameter fungsi: maks **4**; selebihnya gunakan objek.
- Panjang baris: ≤ **110** karakter.

## 3. Satu File, Satu Tanggung Jawab

- Satu modul = satu fitur atau satu concern (mis. `materi.js`, `exam-runner.js`).
- Pisahkan: **akses data (Firestore)** · **logika/transformasi** · **render DOM**. Jangan campur dalam satu fungsi.
- Tidak ada `<style>` atau `<script>` berisi logika di dalam HTML. HTML hanya markup + `<link>` + `<script src>`.
- Tidak ada atribut `style="..."` panjang atau handler `onclick="..."`; gunakan kelas CSS dan `addEventListener`/`data-action`.

## 4. Organisasi Folder & Penamaan

```
docs/css/{base,components,layout,pages}/
docs/js/{core,shared,admin,siswa}/
```

- Nama file: `kebab-case`, deskriptif (`exam-runner.js`, bukan `util2.js`).
- Dilarang nama generik: `utils.js`, `helpers.js`, `misc.js` yang menjadi tempat sampah. Beri nama menurut domain (`format.js`, `media.js`).
- Satu export utama per modul; modul `index`/`main` hanya merangkai.
- Arah dependensi satu arah: `pages → features → shared → core`. Tidak boleh ada impor melingkar.

## 5. Duplikasi (DRY)

- Kode yang sama muncul di **2 tempat** → ekstrak ke `shared/` atau `core/` pada PR yang sama.
- CSS: nilai warna, spasi, radius, bayangan wajib lewat variabel di `css/base/tokens.css`; jangan hardcode ulang.
- Komponen UI berulang (tombol, kartu, modal, toast, tabel) hanya didefinisikan sekali di `css/components/`.

## 6. Pengecualian

File boleh melebihi batas hanya jika:
1. Bersifat data/generated (mis. `design/stitch/screens/*`, lockfile, seed data), atau
2. Ada komentar di baris 1: `// size-exception: <alasan>, ditinjau: YYYY-MM-DD`, dan disetujui reviewer.

Daftar pengecualian dicatat di `engineering/size-exceptions.txt`.

## 7. Penegakan Otomatis

Skrip `.tools/check-file-size.ps1` (dijalankan di pre-commit dan CI):

```powershell
$limits = @{ '.js'=400; '.css'=300; '.html'=200 }
$bad = Get-ChildItem docs -Recurse -File |
  Where-Object { $limits.ContainsKey($_.Extension) } |
  Where-Object { (Get-Content $_.FullName).Count -gt $limits[$_.Extension] } |
  Where-Object { -not (Select-String -Path $_.FullName -Pattern 'size-exception:' -Quiet) }
if ($bad) { $bad | ForEach-Object { "TOO LONG: $($_.FullName)" }; exit 1 }
```

Hook git (`.git/hooks/pre-commit`) memanggil skrip di atas. Selama masa transisi, `admin.html` dan `index.html` dicatat di `size-exceptions.txt` dan dihapus dari daftar begitu fase terkait selesai.

Opsional: ESLint `max-lines` (400), `max-lines-per-function` (60), `max-depth` (3), `complexity` (10) bila nanti dipakai tooling Node.

## 8. Checklist Review PR

- [ ] Tidak ada file melewati batas keras
- [ ] Tidak ada fungsi > 60 baris
- [ ] Tidak ada duplikasi dengan modul yang ada
- [ ] CSS memakai token, bukan nilai hardcode
- [ ] Tidak ada inline `<style>`/`<script>` logika/`onclick`
- [ ] Modul baru berada di folder yang tepat dan bernama deskriptif
- [ ] Perubahan perilaku dan refactor tidak dicampur dalam satu PR

## 9. Aturan untuk Agen AI / Generator Kode

- Jangan menambah kode ke file yang sudah mendekati batas; buat modul baru.
- Saat diminta fitur baru, tempatkan di modul fitur yang sesuai, bukan di `main.js` atau halaman HTML.
- Hasil generate desain (Stitch) harus dipecah menjadi CSS komponen + markup partial sebelum masuk `docs/`.
