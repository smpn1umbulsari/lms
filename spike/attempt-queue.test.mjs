// Runnable check: node spike/attempt-queue.test.mjs
import assert from "node:assert/strict";

const map = new Map();
const mockStorage = {
  getItem: (k) => (map.has(k) ? map.get(k) : null),
  setItem: (k, v) => map.set(k, String(v)),
  removeItem: (k) => map.delete(k)
};
globalThis.localStorage = mockStorage;

const { createFallbackStore, putLocalAttempt, getLocalAttempt, deleteLocalAttempt, listPendingAttempts } = await import(
  "../docs/js/core/attempt-queue.js"
);

let pass = 0;
const test = async (name, fn) => {
  try {
    await fn();
    pass++;
    console.log("PASS  ", name);
  } catch (e) {
    console.error("FAIL  ", name, "->", e.message);
    process.exit(1);
  }
};

await test("attempt-queue: corrupt storage aman dibaca sebagai kosong", async () => {
  mockStorage.setItem("situri_cbt_attempts_v1", "{bad-json");
  const s = createFallbackStore(mockStorage);
  assert.equal(await s.get("u1_q1_1"), null);
  assert.deepEqual(await s.listPending("u1"), []);
});

await test("attempt-queue: put, get, dan timpa record untuk startId yang sama", async () => {
  await putLocalAttempt({ startId: "u1_q1_1", uid: "u1", quizId: "q1", attemptNo: 1, answers: { a: "A" }, pendingSubmit: false });
  let got = await getLocalAttempt("u1_q1_1");
  assert.equal(got.answers.a, "A");
  assert.equal(got.pendingSubmit, false);

  await putLocalAttempt({ startId: "u1_q1_1", uid: "u1", quizId: "q1", attemptNo: 1, answers: { a: "B" }, pendingSubmit: true });
  got = await getLocalAttempt("u1_q1_1");
  assert.equal(got.answers.a, "B");
  assert.equal(got.pendingSubmit, true);
});

await test("attempt-queue: listPendingAttempts menyaring pendingSubmit & uid", async () => {
  await putLocalAttempt({ startId: "u2_q1_1", uid: "u2", quizId: "q1", attemptNo: 1, answers: {}, pendingSubmit: true });
  await putLocalAttempt({ startId: "u1_q2_1", uid: "u1", quizId: "q2", attemptNo: 1, answers: {}, pendingSubmit: false });
  const p1 = await listPendingAttempts("u1");
  assert.equal(p1.length, 1);
  assert.equal(p1[0].startId, "u1_q1_1");
});

await test("attempt-queue: deleteLocalAttempt menghapus bersih", async () => {
  await deleteLocalAttempt("u1_q1_1");
  assert.equal(await getLocalAttempt("u1_q1_1"), null);
  assert.equal((await listPendingAttempts("u1")).length, 0);
});

console.log(`\n=== ${pass} PASS / 0 FAIL ===\n`);
