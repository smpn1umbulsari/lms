// Runnable check: node spike/provision.test.mjs
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  generatePassword,
  buildAuthUser,
  parseCSV,
  provisionFromRows,
  buildCredentialsCSV,
  buildLoginCardsHTML
} from "../tools/provision-accounts.mjs";

let pass = 0;
const test = (name, fn) => {
  try { fn(); pass++; console.log("PASS  ", name); }
  catch (e) { console.error("FAIL  ", name, "->", e.message); process.exit(1); }
};

test("provision: generatePassword menghindari karakter ambigu & panjang benar", () => {
  const p = generatePassword(10);
  assert.equal(p.length, 10);
  assert(!/[0O1Il]/.test(p), `Karakter ambigu ditemukan: ${p}`);
});

test("provision: buildAuthUser menghasilkan hash PBKDF2_SHA256 base64 valid", () => {
  const u = buildAuthUser({ uid: "sis_007", email: "007@smpn1umbulsari.sch.id", displayName: "Budi", password: "Abc234xy" }, 1000);
  assert.equal(u.email, "007@smpn1umbulsari.sch.id");
  assert(u.emailVerified);
  const saltBuf = Buffer.from(u.salt, "base64");
  const expected = crypto.pbkdf2Sync("Abc234xy", saltBuf, 1000, 32, "sha256").toString("base64");
  assert.equal(u.passwordHash, expected);
});

test("provision: provisionFromRows siswa membuat email domain sekolah + nol depan NIS aman", () => {
  const rows = parseCSV("NIS,Nama,Kelas\n007,Ani Wijaya,7A\n12/3,Salah,7A\n008,Budi <Test>,7B");
  const res = provisionFromRows(rows, { kind: "siswa", domain: "smpn1umbulsari.sch.id", rounds: 1000 });
  assert.equal(res.records.length, 2);
  assert.equal(res.errors.length, 1);
  assert.equal(res.records[0].nis, "007");
  assert.equal(res.records[0].email, "007@smpn1umbulsari.sch.id");
  assert.equal(res.authPayload.users.length, 2);

  const csv = buildCredentialsCSV(res.records);
  assert(csv.includes("007@smpn1umbulsari.sch.id"));
  const html = buildLoginCardsHTML(res.records);
  assert(html.includes("Budi &lt;Test&gt;"), "Nama pada HTML card wajib ter-escape");
});

test("provision: mode guru memakai email undangan lowercase", () => {
  const rows = [["Email", "Nama", "NIP", "Mapel", "Aktif"], ["Guru@Smpn1Umbulsari.SCH.ID", "Pak Guru", "123", "IPA", "Ya"]];
  const res = provisionFromRows(rows, { kind: "guru", rounds: 1000 });
  assert.equal(res.records.length, 1);
  assert.equal(res.records[0].email, "guru@smpn1umbulsari.sch.id");
});

console.log(`\n=== ${pass} PASS / 0 FAIL ===\n`);
