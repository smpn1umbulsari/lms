// Seed data for the thin client slice. Run against a live emulator (firestore:8080).
// ponytail: practice quiz embeds `kunci` in questions so client grades instantly; real exam keys live admin-only in quizKeys (proven by rules.test.mjs).
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { readFileSync } from "node:fs";

const now = Date.now();
const openAt = Timestamp.fromMillis(now - 3600_000);
const closeAt = Timestamp.fromMillis(now + 3600_000);

const questions = [
  { id: "q1", teks: "Ibu kota Indonesia?", pilihan: { A: "Jakarta", B: "Bandung", C: "Surabaya", D: "Medan" }, kunci: "A" },
  { id: "q2", teks: "2 + 3 x 4 = ?", pilihan: { A: "20", B: "14", C: "24", D: "9" }, kunci: "B" },
  { id: "q3", teks: "Lawan kata 'panas'?", pilihan: { A: "dingin", B: "hangat", C: "api", D: "kering" }, kunci: "A" },
];

// metadata mirrored in classes/{code}.quizzes (K-BARU-13) so client can build `starts` without reading quizzes
const quizMeta = { openAt, closeAt, duration: 60, version: 1, toleransiMulai: 120, classes: ["c1"], judul: "Kuis Latihan: Umum" };

const env = await initializeTestEnvironment({
  projectId: "demo-lms",
  firestore: { host: "127.0.0.1", port: 8080, rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
});

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, "classes", "c1"), { nama: "X-1", quizzes: { q1: quizMeta } });
  await setDoc(doc(db, "quizzes", "q1"), { ...quizMeta, questions });
  await setDoc(doc(db, "admins", "teacher"), { nama: "Guru" });
});

await env.cleanup();
console.log("SEED OK: classes/c1, quizzes/q1, admins/teacher");
