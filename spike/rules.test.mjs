// Spike: validasi Rules lengkap (RBAC Admin vs Guru, NIS + domain sekolah, freeze submit, tenggat tugas, remedial)
// Jalankan via: npx firebase emulators:exec --only firestore --project demo-lms "node spike/rules.test.mjs"
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, deleteDoc, getDoc, Timestamp, serverTimestamp } from "firebase/firestore";

const now = Date.now();
const openAt = Timestamp.fromMillis(now - 3600_000);
const closeAt = Timestamp.fromMillis(now + 3600_000);
const pastDue = Timestamp.fromMillis(now - 60_000);
const futureDue = Timestamp.fromMillis(now + 3600_000);
const expireAt = new Timestamp(closeAt.seconds + 30 * 86400, closeAt.nanoseconds);

const baseQuiz = {
  judul: "Kuis IPA",
  openAt,
  closeAt,
  duration: 60,
  version: 1,
  toleransiMulai: 120,
  classes: ["c1"],
  questions: [{ id: "q1", tipe: "pg", teks: "Soal 1" }]
};
const remedialQuiz = { ...baseQuiz, judul: "Kuis Remedial", maxAttempts: 2 };

let pass = 0, fail = 0;
const ok = async (l, p) => { try { await p; pass++; console.log("PASS  ", l); } catch (e) { fail++; console.log("FAIL  ", l, "->", e.message.split("\n")[0]); } };
const no = async (l, p) => { try { await p; pass++; console.log("PASS  ", l, "(ditolak)"); } catch (e) { fail++; console.log("FAIL  ", l, "(harusnya DITOLAK) ->", e.message.split("\n")[0]); } };

const env = await initializeTestEnvironment({
  projectId: "demo-lms",
  firestore: { host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8") }
});

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, "classes", "c1"), { nama: "7A" });
  await setDoc(doc(db, "classes", "c2"), { nama: "7B" });
  await setDoc(doc(db, "users", "sA"), { nis: "1001", nama: "A", kelas: "c1" });
  await setDoc(doc(db, "users", "sB"), { nis: "1002", nama: "B", kelas: "c1" });
  await setDoc(doc(db, "admins", "adm"), { nama: "Admin Utama", role: "admin" });
  await setDoc(doc(db, "quizzes", "q1"), baseQuiz);
  await setDoc(doc(db, "quizzes", "q2"), remedialQuiz);
  await setDoc(doc(db, "assignments", "asg_open"), { judul: "Tugas Aktif", classes: ["c1"], dueAt: futureDue });
  await setDoc(doc(db, "assignments", "asg_late"), { judul: "Tugas Telat", classes: ["c1"], dueAt: pastDue });
  await setDoc(doc(db, "certificates", "cert1"), { uid: "sA", quizId: "q1" });
});

const sA = env.authenticatedContext("sA", { email: "1001@smpn1umbulsari.sch.id" }).firestore();
const sB = env.authenticatedContext("sB", { email: "1002@smpn1umbulsari.sch.id" }).firestore();
const sLiars = env.authenticatedContext("sLiar", { email: "random@gmail.com" }).firestore();
const adm = env.authenticatedContext("adm", { email: "admin@smpn1umbulsari.sch.id" }).firestore();
const anon = env.unauthenticatedContext().firestore();

const startsData = (uid, quizId = "q1", attemptNo = 1, maxAttempts = 1) => ({
  uid, quizId, attemptNo, startedAt: serverTimestamp(), duration: 60, closeAt, maxAttempts, quizVersion: 1, keyVersion: 1, expireAt
});
const attemptsData = (uid, quizId = "q1", attemptNo = 1, extra = {}) => ({
  answers: {}, updatedAt: serverTimestamp(), submitSeq: 1, uid, quizId, attemptNo, expireAt, ...extra
});

// ---- P0-2: PENDAFTARAN LIAR & PRIVASI ----
await no("users: akun liar buat profil tanpa NIS ditolak", assertFails(setDoc(doc(sLiars, "users", "sLiar"), { nama: "Penyusup", kelas: "c1" })));
await ok("users: siswa ubah nama sendiri", assertSucceeds(updateDoc(doc(sA, "users", "sA"), { nama: "A2" })));
await no("users: siswa ubah kelas (immutable)", assertFails(updateDoc(doc(sA, "users", "sA"), { kelas: "c2" })));
await ok("classes: siswa baca kelas sendiri", assertSucceeds(getDoc(doc(sA, "classes", "c1"))));
await no("classes: siswa baca kelas lain ditolak", assertFails(getDoc(doc(sA, "classes", "c2"))));

// ---- SISWA ROSTER + EMAIL BINDING ----
await ok("siswa: admin tulis roster", assertSucceeds(setDoc(doc(adm, "siswa", "1003"), { nama: "Cici", kelas: "c1", claimedBy: null })));
await ok("siswa: admin tulis roster keempat", assertSucceeds(setDoc(doc(adm, "siswa", "1004"), { nama: "Dedi", kelas: "c1", claimedBy: null })));
await no("siswa: siswa lain baca roster 1004 ditolak", assertFails(getDoc(doc(sA, "siswa", "1004"))));
const sC = env.authenticatedContext("sC", { email: "1003@smpn1umbulsari.sch.id" }).firestore();
await ok("siswa: pemilik NIS baca dokumen sendiri", assertSucceeds(getDoc(doc(sC, "siswa", "1003"))));
await no("siswa: sA tidak bisa claim NIS 1003 milik email lain", assertFails(updateDoc(doc(sA, "siswa", "1003"), { claimedBy: "sA" })));
await no("users: sA bind NIS 1003 tanpa email cocok ditolak", assertFails(setDoc(doc(sA, "users", "sA"), { nama: "Cici", kelas: "c1", nis: "1003", createdAt: serverTimestamp() })));
await no("users: sC bind kelas salah ditolak", assertFails(setDoc(doc(sC, "users", "sC"), { nama: "Cici", kelas: "c2", nis: "1003", createdAt: serverTimestamp() })));
await no("users: sC bind nama salah ditolak", assertFails(setDoc(doc(sC, "users", "sC"), { nama: "Salah", kelas: "c1", nis: "1003", createdAt: serverTimestamp() })));
await ok("users: sC bind roster cocok email + nama + kelas", assertSucceeds(setDoc(doc(sC, "users", "sC"), { nama: "Cici", kelas: "c1", nis: "1003", createdAt: serverTimestamp() })));
await ok("siswa: sC claim NIS 1003 sendiri", assertSucceeds(updateDoc(doc(sC, "siswa", "1003"), { claimedBy: "sC" })));
await no("siswa: ubah claimedBy yg sudah diklaim ditolak", assertFails(updateDoc(doc(sC, "siswa", "1003"), { claimedBy: "sA" })));
await ok("users: superadmin hapus ikatan users/sC (pemulihan akun)", assertSucceeds(deleteDoc(doc(adm, "users", "sC"))));

// ---- STARTS, QUIZZES, ATTEMPTS, FREEZE & REMEDIAL ----
await no("starts: id salah ditolak", assertFails(setDoc(doc(sA, "starts", "evil"), startsData("sA"))));
await ok("starts: create benar", assertSucceeds(setDoc(doc(sA, "starts", "sA_q1_1"), startsData("sA"))));
await ok("quizzes: siswa baca dlm jendela + sudah mulai", assertSucceeds(getDoc(doc(sA, "quizzes", "q1"))));
await no("quizzes: siswa blm mulai ditolak", assertFails(getDoc(doc(sB, "quizzes", "q1"))));
await no("quizzes: anon ditolak", assertFails(getDoc(doc(anon, "quizzes", "q1"))));
await no("attempts: field ekstra ditolak", assertFails(setDoc(doc(sA, "attempts", "sA_q1_1"), { ...attemptsData("sA"), foo: 1 })));
await ok("attempts: create & update jawaban", assertSucceeds(setDoc(doc(sA, "attempts", "sA_q1_1"), attemptsData("sA"))));
await ok("attempts: kirim (set submittedAt == request.time)", assertSucceeds(updateDoc(doc(sA, "attempts", "sA_q1_1"), { answers: { q1: "A" }, submitSeq: 2, submittedAt: serverTimestamp() })));
await no("attempts: ubah jawaban setelah submittedAt (freeze) ditolak", assertFails(updateDoc(doc(sA, "attempts", "sA_q1_1"), { answers: { q1: "B" }, submitSeq: 3 })));
await no("attempts: siswa lain baca ditolak", assertFails(getDoc(doc(sB, "attempts", "sA_q1_1"))));
await no("starts: remedial pd q1 (maxAttempts=1) ditolak", assertFails(setDoc(doc(sA, "starts", "sA_q1_2"), startsData("sA", "q1", 2, 1))));

await ok("starts: remedial q2 percobaan 1", assertSucceeds(setDoc(doc(sA, "starts", "sA_q2_1"), startsData("sA", "q2", 1, 2))));
await no("starts: q2 percobaan 2 sblm percobaan 1 dikirim ditolak", assertFails(setDoc(doc(sA, "starts", "sA_q2_2"), startsData("sA", "q2", 2, 2))));
await ok("attempts: q2 percobaan 1 kirim langsung", assertSucceeds(setDoc(doc(sA, "attempts", "sA_q2_1"), attemptsData("sA", "q2", 1, { submittedAt: serverTimestamp() }))));
await ok("starts: q2 percobaan 2 setelah 1 dikirim dibolehkan", assertSucceeds(setDoc(doc(sA, "starts", "sA_q2_2"), startsData("sA", "q2", 2, 2))));

// ---- SUBMISSIONS DEADLINE & LOCK AFTER GRADED ----
await ok("submissions: kirim tugas sebelum tenggat", assertSucceeds(setDoc(doc(sA, "submissions", "sA__asg_open"), { uid: "sA", assignmentId: "asg_open", teks: "Halo", link: "", submittedAt: serverTimestamp(), updatedAt: serverTimestamp() })));
await no("submissions: kirim tugas lewat tenggat ditolak", assertFails(setDoc(doc(sA, "submissions", "sA__asg_late"), { uid: "sA", assignmentId: "asg_late", teks: "Telat", link: "", submittedAt: serverTimestamp(), updatedAt: serverTimestamp() })));
await ok("submissions: guru beri nilai + catatan + gradedAt + gradedBy", assertSucceeds(updateDoc(doc(adm, "submissions", "sA__asg_open"), { nilai: 90, catatanGuru: "Bagus", updatedAt: serverTimestamp(), gradedAt: serverTimestamp(), gradedBy: "adm" })));
await no("submissions: siswa ubah jawaban setelah dinilai ditolak", assertFails(updateDoc(doc(sA, "submissions", "sA__asg_open"), { teks: "Edit", link: "", updatedAt: serverTimestamp() })));

// ---- P0-1: RBAC SUPERADMIN VS GURU (TES NEGATIF ESKALASI) ----
const guru = env.authenticatedContext("gA", { email: "Budi@Sekolah.sch.id" }).firestore();
const guru2 = env.authenticatedContext("gB", { email: "siti@sekolah.sch.id" }).firestore();
await ok("guruInvites: admin tulis invite", assertSucceeds(setDoc(doc(adm, "guruInvites", "budi@sekolah.sch.id"), { nama: "Budi", nip: "1", mapel: "Info", aktif: true })));
await no("admins: guru aktivasi TANPA field role ditolak", assertFails(setDoc(doc(guru, "admins", "gA"), { email: "budi@sekolah.sch.id", nama: "Budi", nip: "1", mapel: "Info", activatedAt: serverTimestamp() })));
await no("admins: guru aktivasi dgn role='admin' ditolak", assertFails(setDoc(doc(guru, "admins", "gA"), { email: "budi@sekolah.sch.id", nama: "Budi", nip: "1", mapel: "Info", role: "admin", activatedAt: serverTimestamp() })));
await ok("admins: guru aktivasi wajib role='guru'", assertSucceeds(setDoc(doc(guru, "admins", "gA"), { email: "budi@sekolah.sch.id", nama: "Budi", nip: "1", mapel: "Info", role: "guru", activatedAt: serverTimestamp() })));
await no("RBAC: guru naikkan diri jadi admin ditolak", assertFails(updateDoc(doc(guru, "admins", "gA"), { role: "admin" })));
await no("admins: tanpa invite ditolak", assertFails(setDoc(doc(guru2, "admins", "gB"), { email: "siti@sekolah.sch.id", nama: "Siti", nip: "", mapel: "", role: "guru", activatedAt: serverTimestamp() })));
await no("RBAC: guru tulis roster siswa ditolak", assertFails(setDoc(doc(guru, "siswa", "1099"), { nama: "X", kelas: "c1" })));
await no("RBAC: guru tulis guruInvites ditolak", assertFails(setDoc(doc(guru, "guruInvites", "baru@sekolah.sch.id"), { nama: "Baru", aktif: true })));
await no("RBAC: guru ubah nama classes ditolak", assertFails(updateDoc(doc(guru, "classes", "c1"), { nama: "Hacked" })));
await ok("RBAC: guru update jadwal quizzes/materialsVersion di classes dibolehkan", assertSucceeds(updateDoc(doc(guru, "classes", "c1"), { materialsVersion: 2, quizzes: { q1: { version: 1 } } })));
await ok("RBAC: guru tulis materi & penugasan tervalidasi dibolehkan", assertSucceeds(setDoc(doc(guru, "assignments", "asg_ok"), { judul: "Tugas IPA", classes: ["c1"] })));
await no("assignments: skema tanpa judul ditolak", assertFails(setDoc(doc(guru, "assignments", "asg_bad"), { judul: "", classes: ["c1"] })));
await no("certificates: publik & siswa dilarang baca", assertFails(getDoc(doc(anon, "certificates", "cert1"))));
await no("certificates: siswa dilarang baca", assertFails(getDoc(doc(sA, "certificates", "cert1"))));
await ok("certificates: staf dibolehkan baca", assertSucceeds(getDoc(doc(guru, "certificates", "cert1"))));

await env.cleanup();
console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);
