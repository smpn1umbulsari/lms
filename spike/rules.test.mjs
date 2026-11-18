// Spike: validasi Rules §12 v0.7 + flow inti (auth→starts→quizzes→attempts→results→users)
// Jalankan via: firebase emulators:exec --only firestore --project demo-lms "node rules.test.mjs"
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, getDoc, Timestamp, serverTimestamp } from "firebase/firestore";

const now = Date.now();
const openAt = Timestamp.fromMillis(now - 3600_000);      // 1 jam lalu
const closeAt = Timestamp.fromMillis(now + 3600_000);     // 1 jam lagi
const expireAt = new Timestamp(closeAt.seconds + 30 * 86400, closeAt.nanoseconds);

const quiz = { openAt, closeAt, duration: 60, version: 1, toleransiMulai: 120, classes: ["c1"] };

let pass = 0, fail = 0;
const ok = async (l, p) => { try { await p; pass++; console.log("PASS  ", l); } catch (e) { fail++; console.log("FAIL  ", l, "->", e.message.split("\n")[0]); } };
const no = async (l, p) => { try { await p; pass++; console.log("PASS  ", l, "(ditolak)"); } catch (e) { fail++; console.log("FAIL  ", l, "(harusnya DITOLAK) ->", e.message.split("\n")[0]); } };

const env = await initializeTestEnvironment({
  projectId: "demo-lms",
  firestore: { host: "127.0.0.1", port: 8080, rules: readFileSync("firestore.rules", "utf8") },
});

// ---- seed via rules-disabled ----
await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, "classes", "c1"), { nama: "X-1" });
  await setDoc(doc(db, "users", "sA"), { nama: "A", kelas: "c1" });
  await setDoc(doc(db, "users", "sB"), { nama: "B", kelas: "c1" });
  await setDoc(doc(db, "admins", "adm"), { ok: true });
  await setDoc(doc(db, "quizzes", "q1"), quiz);
});

const sA = env.authenticatedContext("sA").firestore();
const sB = env.authenticatedContext("sB").firestore();
const adm = env.authenticatedContext("adm").firestore();
const anon = env.unauthenticatedContext().firestore();

const startsData = (uid) => ({ uid, quizId: "q1", attemptNo: 1, startedAt: serverTimestamp(), duration: 60, closeAt, maxAttempts: 1, quizVersion: 1, keyVersion: 1, expireAt });
const attemptsData = (uid) => ({ answers: {}, updatedAt: serverTimestamp(), submitSeq: 1, uid, quizId: "q1", attemptNo: 1, expireAt });

// ---- USERS ----
await ok("users: siswa create diri (kelas ada)", assertSucceeds(setDoc(doc(sA, "users", "sA"), { nama: "A", kelas: "c1" })));
await ok("users: siswa ubah nama sendiri", assertSucceeds(updateDoc(doc(sA, "users", "sA"), { nama: "A2" })));
await no("users: siswa ubah kelas (immutable)", assertFails(updateDoc(doc(sA, "users", "sA"), { kelas: "c2" })));

// ---- STARTS ----
await no("starts: id salah ditolak", assertFails(setDoc(doc(sA, "starts", "evil"), startsData("sA"))));
await no("starts: uid mismatch ditolak", assertFails(setDoc(doc(sA, "starts", "sA_q1_1"), startsData("sB"))));
await ok("starts: create benar (serverTimestamp==request.time)", assertSucceeds(setDoc(doc(sA, "starts", "sA_q1_1"), startsData("sA"))));
await ok("starts: baca milik sendiri", assertSucceeds(getDoc(doc(sA, "starts", "sA_q1_1"))));
await no("starts: baca milik orang lain", assertFails(getDoc(doc(sB, "starts", "sA_q1_1"))));

// ---- QUIZZES ----
await ok("quizzes: siswa baca dlm jendela + sudah mulai", assertSucceeds(getDoc(doc(sA, "quizzes", "q1"))));
await no("quizzes: siswa blm mulai ditolak", assertFails(getDoc(doc(sB, "quizzes", "q1"))));
await ok("quizzes: admin baca kapan saja", assertSucceeds(getDoc(doc(adm, "quizzes", "q1"))));
await no("quizzes: anon ditolak", assertFails(getDoc(doc(anon, "quizzes", "q1"))));

// ---- ATTEMPTS ----
await no("attempts: field ekstra ditolak", assertFails(setDoc(doc(sA, "attempts", "sA_q1_1"), { ...attemptsData("sA"), foo: 1 })));
await ok("attempts: create benar (jendela dari starts)", assertSucceeds(setDoc(doc(sA, "attempts", "sA_q1_1"), attemptsData("sA"))));
await ok("attempts: update jawaban sendiri", assertSucceeds(updateDoc(doc(sA, "attempts", "sA_q1_1"), { answers: { q1: "A" }, submitSeq: 2 })));
await no("attempts: siswa lain baca ditolak", assertFails(getDoc(doc(sB, "attempts", "sA_q1_1"))));

// ---- RESULTS ----
await no("results: siswa create ditolak", assertFails(setDoc(doc(sA, "results", "sA_q1_1"), { uid: "sA" })));
await ok("results: admin create", assertSucceeds(setDoc(doc(adm, "results", "sA_q1_1"), { uid: "sA", score: 80 })));
await ok("results: admin update (revisi in-place)", assertSucceeds(updateDoc(doc(adm, "results", "sA_q1_1"), { score: 85 })));
await no("results: siswa baca milik orang lain", assertFails(getDoc(doc(sB, "results", "sA_q1_1"))));

// ---- SISWA (roster impor Excel) ----
await ok("siswa: admin tulis roster", assertSucceeds(setDoc(doc(adm, "siswa", "1001"), { nama: "A", kelas: "c1", claimedBy: null })));
await no("siswa: siswa tulis roster ditolak", assertFails(setDoc(doc(sA, "siswa", "9999"), { nama: "X", kelas: "c1" })));
await ok("siswa: claim NIS sendiri (first-come)", assertSucceeds(updateDoc(doc(sA, "siswa", "1001"), { claimedBy: "sA" })));
// ponytail: roster tanpa pemetaan email↔NIS, jadi claim = first-come-first-served.
// Yang dicegah: dua akun memegang NIS yang sama. Yang tidak dicegah: siswa mengklaim
// NIS teman yang belum diklaim. Perbaikan butuh kolom email di Excel + cek token.email.
await no("siswa: claim NIS yang sudah diklaim ditolak", assertFails(updateDoc(doc(sB, "siswa", "1001"), { claimedBy: "sB" })));
await no("siswa: ubah claimedBy yang sudah ada ditolak", assertFails(updateDoc(doc(sA, "siswa", "1001"), { claimedBy: "sB" })));
await ok("siswa: admin tulis roster kedua", assertSucceeds(setDoc(doc(adm, "siswa", "1002"), { nama: "A2", kelas: "c1", claimedBy: null })));

// ---- USERS via roster ----
const sC = env.authenticatedContext("sC").firestore();
await no("users: bind kelas salah ditolak", assertFails(setDoc(doc(sC, "users", "sC"), { nama: "A", kelas: "c2", nis: "1001" })));
await no("users: bind nama salah ditolak", assertFails(setDoc(doc(sC, "users", "sC"), { nama: "Bukan A", kelas: "c1", nis: "1001" })));
await no("users: bind roster sudah diklaim ditolak", assertFails(setDoc(doc(sC, "users", "sC"), { nama: "A", kelas: "c1", nis: "1001" })));
await ok("users: bind roster bebas (kelas+nama cocok)", assertSucceeds(setDoc(doc(sC, "users", "sC"), { nama: "A2", kelas: "c1", nis: "1002" })));

// ---- GURU (invite impor Excel, doc ID lowercase) ----
const guru = env.authenticatedContext("gA", { email: "Budi@Sekolah.sch.id" }).firestore();
const guru2 = env.authenticatedContext("gB", { email: "siti@sekolah.sch.id" }).firestore();
await ok("guruInvites: admin tulis invite", assertSucceeds(setDoc(doc(adm, "guruInvites", "budi@sekolah.sch.id"), { nama: "Budi", nip: "1", mapel: "Info", aktif: true })));
await ok("guruInvites: guru baca invite sendiri (email beda kapital)", assertSucceeds(getDoc(doc(guru, "guruInvites", "budi@sekolah.sch.id"))));
await no("guruInvites: guru lain baca ditolak", assertFails(getDoc(doc(guru2, "guruInvites", "budi@sekolah.sch.id"))));
await ok("admins: guru aktivasi dgn invite aktif", assertSucceeds(setDoc(doc(guru, "admins", "gA"), { nama: "Budi" })));
await no("admins: tanpa invite ditolak", assertFails(setDoc(doc(guru2, "admins", "gB"), { nama: "Siti" })));
await env.withSecurityRulesDisabled(async (c) => {
  await setDoc(doc(c.firestore(), "guruInvites", "siti@sekolah.sch.id"), { nama: "Siti", aktif: false });
});
await no("admins: invite aktif=false ditolak", assertFails(setDoc(doc(guru2, "admins", "gB"), { nama: "Siti" })));

// ---- RBAC: Admin vs Guru ----
await env.withSecurityRulesDisabled(async (c) => {
  await setDoc(doc(c.firestore(), "admins", "gA"), { nama: "Budi", role: "guru" });
});
await no("RBAC: guru tulis roster siswa ditolak", assertFails(setDoc(doc(guru, "siswa", "1099"), { nama: "Siswa Baru", kelas: "c1" })));
await no("RBAC: guru tulis guruInvites ditolak", assertFails(setDoc(doc(guru, "guruInvites", "baru@sekolah.sch.id"), { nama: "Baru", aktif: true })));
await ok("RBAC: guru tulis materi dibolehkan", assertSucceeds(setDoc(doc(guru, "materials", "mat1"), { judul: "Materi Baru", deskripsi: "Isi", link: "" })));
await ok("RBAC: guru tulis penugasan dibolehkan", assertSucceeds(setDoc(doc(guru, "assignments", "asg1"), { judul: "Tugas 1", kelas: "c1" })));
await ok("RBAC: admin tulis roster siswa dibolehkan", assertSucceeds(setDoc(doc(adm, "siswa", "1099"), { nama: "Siswa Baru", kelas: "c1", claimedBy: null })));

await env.cleanup();
console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);
