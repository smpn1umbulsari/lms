// Runnable check: node spike/scoring.test.mjs
import assert from "node:assert/strict";
import { hitungSkor, gradeAttempt, isAutoCorrect, getBobot, BOBOT_DEFAULT } from "../docs/js/core/scoring.js";

const Q = [
  { id: "q1", tipe: "pg", kunci: "B", bobot: 40 },
  { id: "q2", tipe: "bs", kunci: "true", bobot: 30 },
  { id: "q3", tipe: "match", kunci: { a: "1", b: "2" }, bobot: 30 },
  { id: "q4", tipe: "essay" },
];

// 1. Bobot dihormati, essay tidak ikut total pada hitungSkor.
let r = hitungSkor(Q, { q1: "B", q2: "true", q3: { a: "1", b: "2" } });
assert.deepEqual([r.dapat, r.total, r.pct, r.benar, r.auto], [100, 100, 100, 3, 3]);

// 2. Bobot tidak rata: hanya PG benar = 40/100, bukan 33%.
r = hitungSkor(Q, { q1: "B" });
assert.equal(r.pct, 40);
assert.equal(r.benar, 1);

// 3. Jawaban kosong / match sebagian = salah.
r = hitungSkor(Q, {});
assert.equal(r.dapat, 0);
r = hitungSkor(Q, { q3: { a: "1" } });
assert.equal(r.dapat, 0);

// 4. Bobot kosong -> default 25.
r = hitungSkor([{ id: "x", tipe: "pg", kunci: "A" }], { x: "A" });
assert.equal(r.total, BOBOT_DEFAULT);
assert.equal(r.pct, 100);
assert.equal(getBobot({}), BOBOT_DEFAULT);

// 5. Kunci match kosong tidak dianggap benar.
r = hitungSkor([{ id: "m", tipe: "match", kunci: {}, bobot: 10 }], { m: {} });
assert.equal(r.dapat, 0);

// 6. Daftar soal kosong tidak meledak.
r = hitungSkor([], {});
assert.deepEqual([r.dapat, r.total, r.pct], [0, 0, 0]);

// 7. gradeAttempt: 10 soal PG bobot 10 (total 100) -> tidak pakai 25 tetap!
const Q10 = Array.from({ length: 10 }, (_, i) => ({ id: `q${i + 1}`, tipe: "pg", bobot: 10 }));
const K10 = Object.fromEntries(Q10.map((q) => [q.id, "A"]));
const A10 = { q1: "A", q2: "A", q3: "A", q4: "A", q5: "A" };
const g10 = gradeAttempt(Q10, A10, K10, {});
assert.deepEqual([g10.autoPoints, g10.maxScore, g10.pct, g10.benar], [50, 100, 50, 5]);

// 8. gradeAttempt: campuran bobot (5+15+30+50) + essay kosong vs terisi 0.
const QMix = [
  { id: "q1", tipe: "pg", bobot: 5 },
  { id: "q2", tipe: "bs", bobot: 15 },
  { id: "q3", tipe: "match", bobot: 30 },
  { id: "q4", tipe: "essay", bobot: 50 }
];
const KMix = { q1: "A", q2: "true", q3: { x: "y" } };
const AMix = { q1: "A", q2: "true", q3: { x: "y" }, q4: "Uraian" };
const gMissing = gradeAttempt(QMix, AMix, KMix, { q4: "" });
assert.deepEqual(gMissing.missingEssays, ["q4"]);
assert.equal(gMissing.autoPoints, 50);
assert.equal(gMissing.maxScore, 100);
assert.equal(gMissing.pct, 50);

const gZero = gradeAttempt(QMix, AMix, KMix, { q4: 0 });
assert.deepEqual(gZero.missingEssays, []);
assert.equal(gZero.essayPoints, 0);

const gFull = gradeAttempt(QMix, AMix, KMix, { q4: 40 });
assert.deepEqual([gFull.autoPoints, gFull.essayPoints, gFull.totalPoints, gFull.maxScore, gFull.pct], [50, 40, 90, 100, 90]);

// 9. isAutoCorrect batas tepi & clamping essay max bobot.
assert(!isAutoCorrect({ id: "q1", tipe: "pg" }, "A", ""));
const gClamp = gradeAttempt(QMix, AMix, KMix, { q4: 999 });
assert.equal(gClamp.essayPoints, 50);

console.log("=== 9 PASS / 0 FAIL ===");
