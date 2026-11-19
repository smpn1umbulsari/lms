# Panduan Deploy Produksi — SITURI LMS (`lms-situri`)

Host produksi tunggal: **Firebase Hosting (`https://lms-situri.web.app`)**.
> GitHub Pages tidak lagi digunakan sebagai host produksi karena tidak mendukung header keamanan `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, dan kontrol cache per path yang dikonfigurasi di `firebase.json`.

## 1. Konfigurasi Firebase Project (Plan Spark)
1. **Authentication -> Sign-in method**:
   - Aktifkan **Email/Password** saja.
   - **Matikan (Disable) Anonymous Auth** serta pendaftaran mandiri terbuka dari klien.
2. **Authentication -> Settings -> Authorized domains**:
   - Pastikan `lms-situri.web.app` dan `lms-situri.firebaseapp.com` terdaftar.
3. **Firestore Database**: region `asia-southeast2` (Jakarta), mode produksi.
4. **Konfigurasi Web (`docs/firebase-config.js`)**: tempel konfigurasi SDK Web project `lms-situri`. `.firebaserc` sudah menunjuk `"default": "lms-situri"`.
5. **App Check**: aktifkan reCAPTCHA v3 pada mode **monitor** terlebih dahulu sebelum memaksa (`enforce`) saat lalu lintas produksi stabil.

## 2. Pembuatan Akun Massal (Siswa & Guru)
Siswa masuk menggunakan NIS yang otomatis dipetakan ke `<NIS>@smpn1umbulsari.sch.id`. Gunakan skrip CLI dari file Excel (`NIS | Nama | Kelas` atau daftar guru):
```bash
npm run provision:accounts -- Data_Siswa.xlsx
npx firebase auth:import out/auth-import.json --hash-algo=PBKDF2_SHA256 --rounds=100000
```
Buka `out/Kartu_Login_Siswa.html` di browser untuk mencetak kartu login siswa per kelas. Jangan pernah mengunggah folder `out/` atau `auth-import.json` ke Git (sudah masuk `.gitignore`).

## 3. Urutan Deploy Aman (Wajib Berurutan)
Jalankan backfill role admin **sebelum** men-deploy `firestore.rules` ketat agar akun admin utama lama tidak terkunci:
```bash
# 1. Pastikan dokumen admins lama memiliki field role: "admin" / "guru"
node tools/backfill-admin-roles.mjs

# 2. Verifikasi seluruh tes & aturan keamanan secara lokal
npm test

# 3. Deploy Firestore Security Rules lalu Firebase Hosting
npx firebase deploy --only firestore:rules
npx firebase deploy --only hosting
```

## 4. Batas Kuota Spark & Operasional
- Kuota harian gratis Spark: `50.000` reads / `20.000` writes / `20.000` deletes.
- Dengan throttle autosave **18 detik** + flush lifecycle dan submit ACK terverifikasi di `docs/js/siswa/exam-sync.js`, satu sesi ujian memakan sekitar **4–6 writes/sesi** (kapasitas realistis ribuan sesi ujian per hari di bawah batas 20k write Spark).
- Gunakan **Menu Data & Excel -> Unduh Cadangan Lengkap (.json)** secara berkala karena Firebase Spark tidak menyertakan snapshot backup otomatis.

## 5. Tes Keamanan Emulator Lokal
```powershell
$env:JAVA_HOME = "d:\Project\LMS\.tools\jdk-21.0.13+9-jre"; $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
npx firebase emulators:exec --only firestore --project demo-lms "node spike/rules.test.mjs"
```
