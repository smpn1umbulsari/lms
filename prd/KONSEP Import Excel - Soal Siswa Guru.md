# KONSEP: Import Excel — Soal, Siswa, Guru

Dokumen kerja untuk dijalankan manual di Antigravity IDE. Repo: `D:\Project\LMS`.

---

## 1. Tujuan

Guru/admin bisa mengunggah satu file Excel untuk:

| Import | Hasil |
|---|---|
| **Soal** | Bank soal masuk ke builder ulangan, siap diterbitkan |
| **Siswa** | Roster kelas terdaftar; siswa login lalu mengikat akunnya ke NIS |
| **Guru** | Undangan akun guru; guru aktivasi diri jadi admin |

Tanpa mengubah arsitektur, tanpa build step, tetap gratis di Firebase Spark.

---

## 2. Batasan keras (tidak boleh dilanggar)

- Static HTML + ES modules + Firebase JS SDK v11 (gstatic CDN) + Firestore + Firebase Auth.
- **Dilarang**: Cloud Functions, Cloud Storage, build step, bundler, `require()`, npm dependency.
- Satu-satunya dependensi baru: **SheetJS dari CDN**.
- `firestore.rules` dan `spike/rules.test.mjs` **sudah final dan teruji (36 assert hijau 3 putaran)** — jangan diubah.
- Jangan commit, jangan `firebase deploy`.

---

## 3. Yang sudah selesai (jangan dikerjakan ulang)

`firestore.rules` sudah memuat:

```
match /siswa/{nis} {
  allow read: if request.auth != null;
  allow write: if isAdmin();
  // siswa hanya boleh mengklaim dirinya sekali: claimedBy null -> uid sendiri
  allow update: if request.auth != null
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['claimedBy'])
    && resource.data.claimedBy == null
    && request.resource.data.claimedBy == request.auth.uid;
}

match /users/{uid} {
  allow read: if request.auth != null && (request.auth.uid == uid || isAdmin());
  allow create: if request.auth != null && request.auth.uid == uid && (
    (!('nis' in request.resource.data)
      && exists(/databases/$(database)/documents/classes/$(request.resource.data.kelas)))
    || ('nis' in request.resource.data
      && exists(/databases/$(database)/documents/siswa/$(request.resource.data.nis))
      && get(.../siswa/$(request.resource.data.nis)).data.kelas == request.resource.data.kelas
      && get(.../siswa/$(request.resource.data.nis)).data.nama  == request.resource.data.nama
      && get(.../siswa/$(request.resource.data.nis)).data.claimedBy == null));
  allow update: if request.auth != null && (
    (request.auth.uid == uid && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['nama','updatedAt']))
    || isAdmin());
}

match /admins/{uid} {
  allow read: if isAdmin() || (request.auth != null && request.auth.uid == uid);
  allow write: if isAdmin();
  allow create: if request.auth != null && request.auth.uid == uid
    && request.auth.token.email != null
    && exists(.../guruInvites/$(request.auth.token.email.lower()))
    && get(.../guruInvites/$(request.auth.token.email.lower())).data.aktif == true;
}

match /guruInvites/{email} {
  allow read: if isAdmin()
    || (request.auth != null && request.auth.token.email != null
        && request.auth.token.email.lower() == email);
  allow write: if isAdmin();
}
```

Konsekuensi yang mengikat implementasi:

1. Dokumen `siswa/{nis}` **wajib** punya field `nama`, `kelas`, `claimedBy` (null saat impor).
2. `users/{uid}` yang dibuat siswa **wajib** memuat `nis`, `nama`, `kelas` — dan `nama`+`kelas` harus **sama persis** dengan roster, kalau tidak ditolak rules.
3. Urutan tulis saat siswa mengikat: **create `users/{uid}` dulu**, baru `update siswa/{nis}.claimedBy = uid`.
4. `guruInvites/{email}` doc ID = email **lowercase**; aktivasi admin butuh `aktif == true`.
5. Revoke guru = set `aktif: false` (bukan hapus akun).

**Celah yang diterima (jangan coba ditambal tanpa keputusan Boss):** roster tidak memuat email, jadi klaim NIS bersifat *first-come-first-served*. Yang dicegah: dua akun memegang NIS sama. Yang tidak dicegah: siswa mengklaim NIS teman yang belum diklaim.

---

## 4. Template Excel

Baris 1 = header. Nama kolom case-insensitive, spasi di-trim. Baris kosong diabaikan.

**Soal** — `Kode | Tipe | Teks | Opsi A | Opsi B | Opsi C | Opsi D | Kunci | Kiri | Kanan`

- `Tipe`: `pg` (default) | `bs` | `match` | `essay`
- `Kunci` untuk `pg`/`bs`: `A`..`D`
- `Kunci` untuk `match`: `kiri1>kanan1;kiri2>kanan2` → dipecah ke `kiri[]` dan `kanan[]`
- `Kunci` untuk `essay`: teks rubrik bebas

**Siswa** — `NIS | Nama | Kelas`
- NIS **wajib string** (jaga leading zero: `String(v).trim()`, jangan `Number`)
- Kelas harus sudah ada di koleksi `classes`

**Guru** — `Email | Nama | NIP | Mapel | Aktif`
- `Email` jadi doc ID lowercase
- `Aktif`: `Ya`/`Tidak`, default `Ya` bila kosong

---

## 5. Alur tiap import

Semua tiga import memakai pola yang sama: **pilih file → parse → preview → simpan**. Tidak boleh langsung tulis ke Firestore tanpa preview.

### 5.1 Soal
`XLSX.read` → `sheet_to_json(ws, {header:1, defval:""})` → `parseSoal(rows)` → tampilkan tabel preview + ribbon (`3 PG, 1 BS, 2 Match, 1 Essay / 1 baris bermasalah`) + daftar error per baris → tombol **"Isi Builder"** mengisi `questionsList` yang sudah dipakai halaman asesmen lalu panggil `renderQBuilder()`.

Guru tetap menekan tombol **"Simpan & Terbitkan"** yang sudah ada (`btn-as-save`, ~L1213) — jangan menduplikasi logika simpan/terbit.

**Nol schema Firestore baru.** Item soal wajib mengikuti bentuk `questionsList[]` yang sudah dipakai (`{id, tipe, teks, pilihan:{A,B,C,D}, kunci, kiri:[], kanan:[], bobot}`) — cek dulu di `docs/admin.html` (grep `questionsList`, `renderQBuilder`, `bobot`).

### 5.2 Siswa
`parseSiswa(rows)` → preview → tombol Simpan menulis `writeBatch` ke `siswa/{nis}` dengan `{nama, kelas, claimedBy: null}`, **maksimal 400 dokumen per batch**, tampilkan progres terkirim/gagal.

### 5.3 Guru
`parseGuru(rows)` → preview → `writeBatch` ke `guruInvites/{email_lower}` dengan `{nama, nip, mapel, aktif}`.

---

## 6. File yang harus dibuat / diubah

| File | Aksi |
|---|---|
| `docs/js/import-parser.js` | **baru** — ES module, fungsi murni, tanpa DOM/Firestore |
| `spike/import.test.mjs` | **baru** — tes Node, tanpa framework |
| `docs/admin.html` | tab "📥 Import Excel" + 3 sub-panel + muat SheetJS |
| `docs/index.html` | layar "Masukkan NIS" + hapus default `{nama: email.split("@")[0], kelas:"c1"}` (~L473) |

### 6.1 `docs/js/import-parser.js`

```js
export function parseSoal(rows)  // -> { items:[...], errors:[{baris,pesan}], ringkasan:{pg,bs,match,essay} }
export function parseSiswa(rows) // -> { items:[...], errors:[...], ringkasan:{total} }
export function parseGuru(rows)  // -> { items:[...], errors:[...], ringkasan:{total} }
```

Fungsi murni — tidak menyentuh DOM atau Firestore, supaya bisa dites di Node.
Validasi wajib: `Kode`/`Teks` kosong → error; tipe tidak dikenal → error; kunci tidak sah → error; NIS duplikat → error; email tanpa `@` → error; email duplikat → error.

### 6.2 `spike/import.test.mjs`

`node spike/import.test.mjs` harus jalan **tanpa dependensi**. Pakai `node:assert/strict`. Minimal 6 assert:

1. soal: sheet campuran pg/bs/match/essay → jumlah per tipe benar
2. soal: baris tanpa `Teks` → masuk `errors`, tidak masuk `items`
3. siswa: NIS `"007"` tetap string `"007"` (bukan `7`)
4. siswa: NIS duplikat → `errors`
5. guru: `"Budi@Sekolah.sch.id"` → `"budi@sekolah.sch.id"`
6. guru: `Aktif: "Tidak"` → `false`; kosong → `true`

Cetak `=== N PASS / M FAIL ===`, `process.exit(fail ? 1 : 0)`.

### 6.3 `docs/admin.html`

- SheetJS **hanya di halaman ini**:
  `<script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js" integrity="sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT" crossorigin="anonymous"></script>`
  Global `window.XLSX`.
- Tombol nav: `<button class="nav-btn" data-tab="sec-import">📥 Import Excel</button>` setelah `sec-grading`.
- Pane: `<div id="sec-import" class="tab-pane hidden">`. Pakai mekanisme tab yang sudah ada (`data-tab` + `.tab-pane.hidden`), jangan bikin mekanisme baru.
- Tiap sub-panel: `<input type="file" accept=".xlsx,.xls">` + tombol **Unduh Template** (generate client-side: `XLSX.utils.aoa_to_sheet` → `XLSX.writeFile`) + preview tabel + ribbon + error + tombol Simpan.
- Pakai `db`, `writeBatch`, `doc`, `collection` yang **sudah diimpor** di file itu — jangan duplikasi import.

### 6.4 `docs/index.html`

Saat login dan `users/{uid}` belum punya `nis`:
1. Tampilkan input NIS + tombol.
2. `getDoc(siswa/{nis})` → tidak ada → "NIS tidak terdaftar".
3. `claimedBy` sudah terisi dan ≠ uid ini → "NIS sudah dipakai akun lain, hubungi guru".
4. Kalau bebas → `setDoc(users/{uid}, {nama: roster.nama, kelas: roster.kelas, nis, updatedAt})` **lalu** `updateDoc(siswa/{nis}, {claimedBy: uid})`.
5. Hapus default lama `{nama: email.split("@")[0], kelas:"c1"}`.

Jangan ubah alur login/auth yang sudah jalan.

---

## 7. Kriteria terima (bukti wajib)

```bash
node spike/import.test.mjs          # cetak N PASS / M FAIL
node --check docs/js/import-parser.js
git status --short                  # hanya 4 file di atas yang berubah
git diff --stat
```

Rules regresi (dari root repo, butuh JDK lokal):

```bash
export JAVA_HOME="$PWD/.tools/jdk-21.0.13+9-jre" && export PATH="$JAVA_HOME/bin:$PATH"
firebase emulators:exec --only firestore --project demo-lms "node spike/rules.test.mjs"
# harus === 36 PASS / 0 FAIL ===
```

Jangan klaim selesai tanpa output perintah di atas. Kalau ada yang gagal, laporkan apa adanya.

---

## 8. Gaya kode

Vanilla JS, ES module, tanpa framework, komentar bahasa Indonesia seperlunya. Jangan refactor kode yang tidak berhubungan. Diff sekecil mungkin.
