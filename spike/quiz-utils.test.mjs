// Runnable check: node spike/quiz-utils.test.mjs
import assert from "node:assert/strict";
import { fnv1a, mulberry32, shuffle, getQuizStatus } from "../docs/js/shared/quiz-utils.js";

let pass = 0;
const test = (name, fn) => {
  try {
    fn();
    pass++;
    console.log("PASS  ", name);
  } catch (err) {
    console.error("FAIL  ", name, "->", err.message);
    process.exit(1);
  }
};

// 1. fnv1a Hash Determinism
test("fnv1a: hash konsisten untuk string yang sama", () => {
  const h1 = fnv1a("soal_ipa_01");
  const h2 = fnv1a("soal_ipa_01");
  assert.equal(h1, h2);
  assert(h1 >= 0, "fnv1a harus menghasilkan unsigned 32-bit");
});

test("fnv1a: string berbeda menghasilkan hash berbeda", () => {
  const h1 = fnv1a("soal_ipa_01");
  const h2 = fnv1a("soal_ipa_02");
  assert.notEqual(h1, h2);
});

// 2. mulberry32 PRNG Determinism
test("mulberry32: sequence identik untuk seed yang sama", () => {
  const rnd1 = mulberry32(12345);
  const rnd2 = mulberry32(12345);
  const seq1 = [rnd1(), rnd1(), rnd1(), rnd1()];
  const seq2 = [rnd2(), rnd2(), rnd2(), rnd2()];
  assert.deepEqual(seq1, seq2);
  seq1.forEach((v) => {
    assert(v >= 0 && v < 1, "Nilai PRNG harus berada di rentang [0, 1)");
  });
});

test("mulberry32: sequence berbeda untuk seed berbeda", () => {
  const rnd1 = mulberry32(11111);
  const rnd2 = mulberry32(99999);
  assert.notEqual(rnd1(), rnd2());
});

// 3. shuffle Function
test("shuffle: deterministik dengan generator PRNG yang sama", () => {
  const arr = ["A", "B", "C", "D", "E"];
  const res1 = shuffle(arr, mulberry32(42));
  const res2 = shuffle(arr, mulberry32(42));
  assert.deepEqual(res1, res2);
});

test("shuffle: tidak memutasi array asli & melestarikan seluruh elemen", () => {
  const original = ["Pilihan 1", "Pilihan 2", "Pilihan 3"];
  const copy = [...original];
  const shuffled = shuffle(original, mulberry32(99));

  assert.deepEqual(original, copy, "Array asli tidak boleh berubah");
  assert.equal(shuffled.length, original.length);
  assert.deepEqual([...shuffled].sort(), [...original].sort());
});

test("shuffle: menangani array kosong & 1 elemen tanpa error", () => {
  const empty = shuffle([], mulberry32(1));
  assert.deepEqual(empty, []);

  const single = shuffle(["Single"], mulberry32(1));
  assert.deepEqual(single, ["Single"]);
});

// 4. Status jendela ujian jujur
test("getQuizStatus: membedakan belum dibuka, terbuka, terlambat, ditutup, terkirim, lanjutkan, remedial", () => {
  const openAt = 1_000_000;
  const closeAt = openAt + 120 * 60000;
  const q = { openAt, closeAt, toleransiMulai: 30, maxAttempts: 1 };

  assert.equal(getQuizStatus(q, openAt - 1000).code, "belum_dibuka");
  assert.equal(getQuizStatus(q, openAt - 1000).canStart, false);

  assert.equal(getQuizStatus(q, openAt + 10 * 60000).code, "terbuka");
  assert.equal(getQuizStatus(q, openAt + 10 * 60000).canStart, true);

  assert.equal(getQuizStatus(q, openAt + 40 * 60000).code, "terlambat");
  assert.equal(getQuizStatus(q, openAt + 40 * 60000).canStart, false);

  assert.equal(getQuizStatus(q, closeAt + 1000).code, "ditutup");
  assert.equal(getQuizStatus(q, openAt + 40 * 60000, { started: true, deadlineMs: openAt + 70 * 60000 }).code, "lanjutkan");
  assert.equal(getQuizStatus(q, openAt + 10 * 60000, { submitted: true }).code, "terkirim");
  assert.equal(getQuizStatus(q, openAt + 10 * 60000, { submitted: true, graded: true }).code, "dinilai");
  assert.equal(getQuizStatus({ ...q, maxAttempts: 2 }, openAt + 10 * 60000, { submittedCount: 1 }).code, "remedial");
});

console.log(`\n=== ${pass} PASS / 0 FAIL ===`);
