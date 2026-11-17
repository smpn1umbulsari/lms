// Runnable check: node spike/scoring.test.mjs
import assert from "node:assert/strict";
import { hitungSkor, BOBOT_DEFAULT } from "../docs/js/core/scoring.js";

const Q = [
  { id: "q1", tipe: "pg", kunci: "B", bobot: 40 },
  { id: "q2", tipe: "bs", kunci: "true", bobot: 30 },
  { id: "q3", tipe: "match", kunci: { a: "1", b: "2" }, bobot: 30 },
  { id: "q4", tipe: "essay" },
];

// 1. Bobot dihormati, essay tidak ikut total.
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

// 5. Kunci match kosong tidak dianggap benar.
r = hitungSkor([{ id: "m", tipe: "match", kunci: {}, bobot: 10 }], { m: {} });
assert.equal(r.dapat, 0);

// 6. Daftar soal kosong tidak meledak.
r = hitungSkor([], {});
assert.deepEqual([r.dapat, r.total, r.pct], [0, 0, 0]);

console.log("=== 6 PASS / 0 FAIL ===");
