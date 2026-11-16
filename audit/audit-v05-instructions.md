Kamu adalah AUDITOR INDEPENDEN yang skeptis dan teliti. Tugas: audit dokumen PRD "LMS Interaktif v0.5" di bawah ini. Dokumen ini adalah revisi yang mengklaim telah menambal 9 temuan KRITIS (K1–K9) + temuan SEDANG dari audit sebelumnya.

FOKUS AUDIT (periksa dengan keras, jangan percaya klaim di changelog):
1. Apakah perbaikan K1 (validasi snapshot `starts` di Firestore Rules) BENAR-BENAR bisa diekspresikan di Firestore Security Rules? Perhatikan batas access-call, apakah `get()` berantai valid, dan apakah `request.resource.id` bisa dipakai untuk binding ID (K9).
2. Apakah model `attempts` "satu dokumen map answers + create/update terbatas" (K7) konsisten di SELURUH dokumen (F-08, §10, §11, §12, §13)? Apakah `affectedKeys().hasOnly([...])` valid untuk map nested `answers`? Apakah retry benar-benar idempoten?
3. Apakah `quizLocks/{quizId}` (K5) benar-benar menegakkan immutability via Rules (`exists(/quizLocks/$(quizId))`)? Adakah celah (siapa yang menulis lock, kapan, race condition)?
4. VERIFIKASI ARITMETIKA tabel §13.1 baris demi baris: jumlahkan ulang min/max READ Cache-On (klaim 19.412–31.412), Cache-Off (40.412–49.412), WRITE Hari-H (7.401–8.406), WRITE Ekstrem (12.206). Cek setiap persen. Cek apakah kolom "Write Ekstrem" konsisten dengan label "LUAR hari H = 0".
5. Apakah gate rilis §17 (Cache-On 39–63%, cache-off 81–99% diterima sebagai risiko) masuk akal, atau justru mengakui bahwa sistem gagal di skenario realistis?
6. Perbaikan SEDANG: DST 107 menit (S1), results create-only + `_v2` (S4), skema `quizKeysLatihan`/`quizExplanations` (S6/S7), storage/egress §13.5 (S8/S9), klaim kuota Console (S10), metode Emulator (S11), alarm relatif (M9). Mana yang masih cacat?
7. CACAT BARU yang diperkenalkan v0.5 (regresi): mis. apakah `maxAttempts=1` menghapus fitur retry yang masih dibutuhkan? Apakah "create+update terbatas" bertentangan dengan "create-only" di tempat lain? Apakah angka baru konsisten dengan premis 1.800 sesi/900 concurrent?
8. Kontradiksi internal, angka tanpa asal, dan lubang keamanan tersisa.

FORMAT JAWABAN:
- Bagian A: VONIS (SIAP / BELUM SIAP untuk implementasi) + 3 alasan utama.
- Bagian B: Temuan KRITIS (blok implementasi) — bernomor, sertakan seksi/baris.
- Bagian C: Temuan SEDANG.
- Bagian D: Temuan MINOR.
- Bagian E: Verifikasi aritmetika (tunjukkan penjumlahan ulang; sebutkan jika ada selisih).
- Bagian F: Rekomendasi prioritas (maks 5).
Bahasa Indonesia. Ringkas, tajam, tanpa basa-basi.

=== ISI DOKUMEN PRD LMS INTERAKTIF v0.5 ===
