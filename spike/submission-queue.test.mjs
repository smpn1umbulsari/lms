// Runnable check: node spike/submission-queue.test.mjs
import assert from "node:assert/strict";

// Simulated localStorage mock
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => store.get(k) || null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};

const QUEUE_KEY = "situri_pending_submissions";

function getPendingSubmissions() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

function savePendingSubmission(item) {
  const list = getPendingSubmissions().filter((x) => x.subId !== item.subId);
  list.push({ ...item, queuedAt: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
}

function removePendingSubmission(subId) {
  const list = getPendingSubmissions().filter((x) => x.subId !== subId);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
}

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

localStorage.clear();

test("queue: initial state returns empty array", () => {
  const q = getPendingSubmissions();
  assert.deepEqual(q, []);
});

test("queue: corrupted storage defaults safely to empty array", () => {
  localStorage.setItem(QUEUE_KEY, "invalid-json{{");
  const q = getPendingSubmissions();
  assert.deepEqual(q, []);
  localStorage.clear();
});

test("queue: savePendingSubmission adds new item with timestamp", () => {
  savePendingSubmission({
    subId: "user1__asg1",
    uid: "user1",
    assignmentId: "asg1",
    teks: "Laporan fotosintesis",
    link: "https://drive.google.com/test"
  });
  const q = getPendingSubmissions();
  assert.equal(q.length, 1);
  assert.equal(q[0].subId, "user1__asg1");
  assert.equal(q[0].teks, "Laporan fotosintesis");
  assert(q[0].queuedAt > 0, "Harus menyertakan timestamp queuedAt");
});

test("queue: savePendingSubmission updates existing item without duplicates", () => {
  savePendingSubmission({
    subId: "user1__asg1",
    uid: "user1",
    assignmentId: "asg1",
    teks: "Laporan fotosintesis revisi 2",
    link: "https://drive.google.com/test2"
  });
  const q = getPendingSubmissions();
  assert.equal(q.length, 1, "Tidak boleh duplikat untuk subId yang sama");
  assert.equal(q[0].teks, "Laporan fotosintesis revisi 2");
});

test("queue: multiple distinct submissions can be saved and filtered by uid", () => {
  savePendingSubmission({
    subId: "user2__asg1",
    uid: "user2",
    assignmentId: "asg1",
    teks: "Tugas siswa 2",
    link: ""
  });
  const q = getPendingSubmissions();
  assert.equal(q.length, 2);
  const user1Queue = q.filter((x) => x.uid === "user1");
  const user2Queue = q.filter((x) => x.uid === "user2");
  assert.equal(user1Queue.length, 1);
  assert.equal(user2Queue.length, 1);
});

test("queue: removePendingSubmission removes specified item cleanly", () => {
  removePendingSubmission("user1__asg1");
  const q = getPendingSubmissions();
  assert.equal(q.length, 1);
  assert.equal(q[0].subId, "user2__asg1");
  removePendingSubmission("user2__asg1");
  assert.equal(getPendingSubmissions().length, 0);
});

console.log(`\n=== ${pass} PASS / 0 FAIL ===\n`);
