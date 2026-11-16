# Instruksi Audit Ronda-3 — PRD LMS v0.7

Anda auditor independen. Baca file berikut sendiri dengan tool baca file Anda:
1. `D:/Project/LMS/PRD LMS Interaktif v0.7.md` (dokumen yang diaudit)
2. `D:/Project/LMS/audit-v06-agy.out` (vonis REJECT Anda ronda-2, untuk cek apakah sudah ditambal)

v0.7 adalah patch atas v0.6 yang menambal temuan ronda-2 Anda: K-BARU-09 s/d 13, S-BARU-08, S-BARU-09, dan sisa K-BARU-03.

## Tugas — putuskan SIAP atau REJECT implementasi

### A. Verifikasi 8 tambalan benar-benar ada dan BENAR di blok Rules §12
- **K-BARU-09:** nol aritmetika `Timestamp * 60` / `Timestamp + int`; semua pakai `duration.value(n,'m')` / `duration.value(90,'s')`.
- **K-BARU-10:** `attempts` `allow update` membaca jendela dari `get(.../starts/$(attemptId))`, BUKAN `resource.data.closeAt/startedAt/duration`.
- **K-BARU-11:** `isAdmin()` ber-guard `request.auth != null`; ada `|| isAdmin()` di `allow read` `starts/attempts/results/quizzes/users`.
- **K-BARU-12:** ada blok `match /progress/{uid}` dan `match /admins/{uid}`.
- **K-BARU-13:** metadata jadwal ada di `classes/{code}.quizzes` sehingga siswa bisa menyusun `starts` tanpa membaca `quizzes` lebih dulu.
- **S-BARU-08:** `users` update self hanya `['nama','updatedAt']`; `kelas` hanya admin.
- **S-BARU-09:** `expireAt == closeAt + duration.value(30,'d')` divalidasi di `starts` & `attempts`.
- **K-BARU-03:** `results` `allow create, update: if isAdmin()` (revisi in-place), mekanisme `_v2` dibuang.

### B. Cari bug BARU yang belum pernah dilaporkan
Periksa Rules v0.7 dengan mata segar: apakah `q()`/`st()` sebagai function yang mengembalikan `get().data` valid di Firestore Rules dan tetap 1 access-call? Apakah `duration.value(q(...).toleransiMulai, 'm')` valid (arg int dari map)? Apakah `answers.size()` valid untuk map? Apakah `kelas in q(...).classes` valid untuk array? Apakah ada `allow update` ganda/konflik? Apakah `results` create+update membuka celah yang tak disengaja?

### C. Hitung ulang aritmetika §13.1
READ 18.210–20.010 (worst 21.810), WRITE 7.586–8.586, ekstrem write 12.386. Cek setiap baris; cari hidden read/access-call yang belum dianggarkan (rule-get `admins`, `exists`, `get(starts)`, dsb).

## Output (Bahasa Indonesia, ke stdout)
Bagian A: status tiap 8 tambalan (BENAR / SALAH / HILANG).
Bagian B: daftar bug baru (atau "tidak ada").
Bagian C: aritmetika per baris + total + verdict lulus/gagal kuota.
Vonis akhir: **SIAP IMPLEMENTASI** atau **REJECT**, satu kalimat alasan.
