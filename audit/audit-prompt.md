Anda auditor teknis senior. Audit kritis file "PRD LMS Interaktif v0.4.md" (LMS Firebase Spark + GitHub Pages, biaya $0, 1.000 siswa, puncak 900 concurrent, 1.800 sesi ujian/hari).

Tugas: temukan cacat NYATA. Jangan memuji. Jangan mengarang pujian. Fokus pada:

1. ARITMETIKA TABEL KUOTA (Seksi 13.1): hitung ULANG sendiri setiap baris dan kolom min/max serta TOTAL. Verifikasi apakah total Cache-On 14.812-24.206 dan Cache-Off 35.812-42.206 benar-benar cocok dengan penjumlahan baris. Verifikasi % terhadap 50.000 read / 20.000 write. Laporkan angka yang tidak konsisten.

2. KONTRADIKSI INTERNAL: cek apakah gate rilis (Seksi 17) konsisten dengan tabel & catatan (Seksi 13.1). Cek apakah rumus closeAt identik di semua seksi (8,10,11,12,13,17,18). Cek apakah model deadline (read window vs write window) logis dan tidak saling bertabrakan.

3. LOGIKA DEADLINE: apakah closeAt = openAt + toleransiMulai + durasi + 90s benar-benar menjamin write per-siswa tidak pernah melewati closeAt? Apakah ada celah siswa mulai terlambat lalu read-block?

4. KELAYAKAN SPARK $0: apakah asumsi (tanpa Cloud Functions, tanpa Cloud Storage, TTL gratis, App Check monitor) realistis? Ada klaim yang salah soal kuota Firestore/Auth?

5. SECURITY RULES: apakah aturan access-call (10 single / 20 batch), create-only attemptNo, get() cache per-request benar secara teknis? Ada lubang keamanan (mis. siswa bisa curang, baca quizKeys, manipulasi results)?

6. ID DOKUMEN: konsistensi attempts/{uid}_{quizId}_{attemptNo} vs starts vs results di semua seksi.

7. ANGKA TANPA ASAL / KLAIM TANPA SUMBER: tandai setiap angka yang tidak bisa diturunkan dari asumsi eksplisit.

Output: daftar temuan berprioritas (KRITIS / SEDANG / MINOR). Untuk tiap temuan: lokasi (seksi/baris), masalah, bukti/bukti-hitung, saran perbaikan konkret. Jika sesuatu benar, cukup satu baris "OK: <hal>". Akhiri dengan vonis: apakah dokumen siap dijadikan dasar implementasi atau belum, dan apa 3 hal terpenting yang harus diperbaiki.
