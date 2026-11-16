# Deploy LMS — Firebase Spark + GitHub Pages ($0)

Arsitektur: **Firebase** = Auth (anonim + email admin) + Firestore. **Hosting** = GitHub Pages (statis, folder `/docs`). Tanpa Cloud Functions / Cloud Storage.

## 1. Firebase project (plan Spark)
1. console.firebase.google.com → Add project (Spark, gratis).
2. Authentication → Sign-in method → aktifkan **Anonymous** + **Email/Password**.
3. Authentication → Settings → Authorized domains → tambah `<username>.github.io` (WAJIB, tanpa ini login diblok).
4. Firestore Database → Create database → Production mode → region asia-southeast2 (Jakarta).
5. Project settings → General → Your apps → Web `</>` → copy config → tempel ke `docs/firebase-config.js`.
6. `.firebaserc` → ganti `REPLACE_PROJECT_ID` dengan project id.

## 2. Deploy security rules
```bash
npx firebase login
npx firebase deploy --only firestore:rules
```
`firestore.rules` = §12 PRD v0.7, sudah lulus 20/20 test emulator.

## 3. GitHub Pages
1. push repo ke GitHub.
2. Settings → Pages → Source: Deploy from a branch → branch `main`, folder `/docs` → Save.
3. Buka `https://<username>.github.io/<repo>/` → login anonim → kuis jalan.

## 4. Seed data produksi
Emulator pakai `spike/seed.mjs`. Untuk produksi isi `classes/c1`, `quizzes/q1`, dan `admins/<uid-guru>` lewat Console (atau skrip Admin SDK). Guru: buat user email/password di Auth → salin uid → dokumen `admins/{uid}`.

## 5. Kuota Spark (pagar)
50k reads / 20k writes / 20k deletes per hari. Budget v0.7: read ~40%, write ~43%, delete 18% untuk 1.800 sesi/hari. Pantau Console → Usage; tembus → kurangi fitur atau pindah Blaze.

## Gotchas
- App Check: biarkan **monitor** dulu (reCAPTCHA v3), jangan enforce sampai yakin.
- `apiKey` Firebase web BUKAN rahasia; yang melindungi = security rules.
- Tanpa Cloud Functions: grading latihan di klien; ujian resmi dinilai admin (rules mengunci).
- `404.html` = fallback GH Pages (redirect ke index).
