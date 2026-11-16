# Instruksi Audit Independen — PRD LMS v0.6

Anda auditor teknis independen. Baca dua file berikut dari disk (pakai tool baca file Anda):
1. `D:/Project/LMS/PRD LMS Interaktif v0.6.md`  (dokumen yang diaudit)
2. `D:/Project/LMS/audit-v05-agy.out`            (temuan Anda sebelumnya di v0.5)

Tugas: putuskan apakah v0.6 sudah **SIAP** diimplementasikan, atau masih **REJECT**.

Fokus wajib (verifikasi ketat, jangan percaya klaim dokumen — hitung sendiri):
- **A. Rules v0.6 benar-benar compile?** Cek: `match /starts/{startId}` + binding `startId == request.auth.uid + '_' + request.resource.data.quizId + '_1'`; semua `get()/exists()` pakai path penuh `/databases/$(database)/documents/...`; `startedAt == request.time` + `serverTimestamp()`; `duration.value(90,'s')`; `keys().hasOnly` di create & `affectedKeys().hasOnly` di update. Ada properti/sintaks Firestore Rules yang tetap salah?
- **B. Aritmetika kuota §13.1:** READ 18.012–19.812, WRITE 7.406–8.406, ekstrem 12.206. Hitung ulang baris demi baris. Ada hidden read/access-call yang belum dianggarkan? (rule-get `quizzes`+`users` di starts, `exists(starts)` di quizzes, rule-get `starts` di attempts, `admins` di grading). Apakah cache-in-satu-evaluasi (1 access-call untuk get() berulang) benar di Firestore?
- **C. 8 temuan v0.5 (K-BARU-01..08) benar-benar tertutup?** Untuk tiap temuan: tutup / masih bocor.
- **D. Temuan baru:** apa pun yang membuat v0.6 tetap gagal (sintaks Rules, race, idempotensi, deadlock, storage/egress, DST).
- **E. Angka operasi vs batas keras:** read ≤50.000, write ≤20.000, delete ≤20.000, storage ≤1 GiB, egress ≤10 GiB/bulan.

Tulis laporan Bahasa Indonesia, Bagian A–F:
- A. Vonis: SIAP / REJECT (satu baris)
- B. Status 8 temuan K-BARU-01..08 (tutup/bocor + alasan singkat)
- C. Verifikasi sintaks Rules (temuan spesifik bila ada)
- D. Verifikasi aritmetika kuota (tabel hitung ulang + selisih)
- E. Temuan baru (K-BARU-09 dst.) — hanya yang benar-benar baru & berdampak
- F. 3 rekomendasi prioritas tertinggi

Jujur & keras. Jangan memuji. Bila siap, katakan SIAP dengan syarat sisa (bila ada).
