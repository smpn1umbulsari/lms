# LMS Interaktif — SMPN 1 Umbulsari

LMS kuis/ujian online, biaya **$0**: Firebase Spark (Auth + Firestore) + GitHub Pages statis. Tanpa Cloud Functions/Storage.

## Struktur
- `prd/` — spesifikasi. **`PRD LMS Interaktif v0.7.md`** = final (tervalidasi agy ronda-3, 0 blocker). Versi v0.2–v0.6 diarsipkan utuh.
- `audit/` — jejak audit (opencode + agy v0.5/v0.6/v0.7).
- `firestore.rules` — security rules kanonik (§12 PRD v0.7), lulus **20/20** test emulator.
- `firebase.json`, `.firebaserc` — config Firebase CLI (deploy rules).
- `docs/` — app produksi (di-serve GitHub Pages folder `/docs`).
- `spike/` — harness dev: `rules.test.mjs` (20 assert) + `seed.mjs` + `index.html` (uji emulator).
- `.tools/` — JRE 21 portable (untuk emulator; gitignored).

## Test rules lokal
```bash
export JAVA_HOME="$PWD/.tools/jdk-21.0.13+9-jre"; export PATH="$JAVA_HOME/bin:$PATH"
npx firebase emulators:exec --only firestore --project demo-lms "node spike/rules.test.mjs"
```

## Deploy
Lihat `DEPLOY.md`.
