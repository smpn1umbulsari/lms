// Tes unit murni untuk parser Import Excel (Soal, Siswa, Guru)
// Jalankan via: node spike/import.test.mjs
import assert from "node:assert/strict";
import { parseSoal, parseSiswa, parseGuru } from "../docs/js/admin/import-export.js";

let pass = 0;
let fail = 0;

function check(label, fn) {
  try {
    fn();
    pass++;
    console.log("PASS  ", label);
  } catch (e) {
    fail++;
    console.log("FAIL  ", label, "->", e.message.split("\n")[0]);
  }
}

// 1. soal: sheet campuran pg/bs/match/essay -> jumlah per tipe benar
check("soal: sheet campuran pg/bs/match/essay -> jumlah per tipe benar", () => {
  const rows = [
    ["Kode", "Tipe", "Teks", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Kunci", "Kiri", "Kanan"],
    ["q_ipa_1", "pg", "Ibukota Indonesia?", "Jakarta", "Bandung", "Surabaya", "Medan", "A", "", ""],
    ["q_ipa_1", "", "2 + 2 = ?", "3", "4", "5", "6", "B", "", ""],
    ["q_ipa_1", "bs", "Air mendidih pada 100C.", "Benar", "Salah", "", "", "A", "", ""],
    ["q_ipa_1", "match", "Jodohkan organ dan fungsi", "", "", "", "", "Alveolus>Difusi O2;Trakea>Saring debu", "", ""],
    ["q_ipa_1", "essay", "Jelaskan proses fotosintesis!", "", "", "", "", "Rubrik: sebutkan klorofil & cahaya", "", ""]
  ];
  const res = parseSoal(rows);
  assert.equal(res.errors.length, 0);
  assert.equal(res.items.length, 5);
  assert.deepEqual(res.ringkasan, { pg: 2, bs: 1, match: 1, essay: 1 });
  const matchItem = res.items.find((x) => x.tipe === "match");
  assert.deepEqual(matchItem.kiri, ["Alveolus", "Trakea"]);
  assert.deepEqual(matchItem.kanan, ["Difusi O2", "Saring debu"]);
});

// 2. soal: baris tanpa Teks -> masuk errors, tidak masuk items
check("soal: baris tanpa Teks -> masuk errors, tidak masuk items", () => {
  const rows = [
    ["Kode", "Tipe", "Teks", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Kunci"],
    ["q_1", "pg", "", "A1", "B1", "C1", "D1", "A"],
    ["q_1", "pg", "Soal valid", "A2", "B2", "C2", "D2", "C"]
  ];
  const res = parseSoal(rows);
  assert.equal(res.items.length, 1);
  assert.equal(res.errors.length, 1);
  assert.equal(res.errors[0].baris, 2);
});

// 3. siswa: NIS "007" tetap string "007" (bukan 7)
check('siswa: NIS "007" tetap string "007" (bukan 7)', () => {
  const rows = [
    ["NIS", "Nama", "Kelas"],
    ["007", "James Bond", "c1"]
  ];
  const res = parseSiswa(rows);
  assert.equal(res.errors.length, 0);
  assert.equal(res.items.length, 1);
  assert.strictEqual(res.items[0].nis, "007");
  assert.strictEqual(typeof res.items[0].nis, "string");
  assert.strictEqual(res.items[0].claimedBy, null);
});

// 4. siswa: NIS duplikat -> errors
check("siswa: NIS duplikat -> errors", () => {
  const rows = [
    ["NIS", "Nama", "Kelas"],
    ["1001", "Ani", "7A"],
    ["1001", "Budi", "7B"]
  ];
  const res = parseSiswa(rows);
  assert.equal(res.items.length, 1);
  assert.equal(res.errors.length, 1);
  assert.equal(res.errors[0].baris, 3);
});

// 5. guru: "Budi@Sekolah.sch.id" -> "budi@sekolah.sch.id"
check('guru: "Budi@Sekolah.sch.id" -> "budi@sekolah.sch.id"', () => {
  const rows = [
    ["Email", "Nama", "NIP", "Mapel", "Aktif"],
    ["Budi@Sekolah.sch.id", "Budi Santoso", "19800101", "IPA", "Ya"]
  ];
  const res = parseGuru(rows);
  assert.equal(res.errors.length, 0);
  assert.equal(res.items.length, 1);
  assert.strictEqual(res.items[0].email, "budi@sekolah.sch.id");
});

// 6. guru: Aktif: "Tidak" -> false; kosong -> true
check('guru: Aktif: "Tidak" -> false; kosong -> true', () => {
  const rows = [
    ["Email", "Nama", "NIP", "Mapel", "Aktif"],
    ["siti@sekolah.sch.id", "Siti Aminah", "19850202", "Matematika", "Tidak"],
    ["agus@sekolah.sch.id", "Agus Salim", "19860303", "Bahasa", ""]
  ];
  const res = parseGuru(rows);
  assert.equal(res.errors.length, 0);
  assert.equal(res.items.length, 2);
  assert.strictEqual(res.items[0].aktif, false);
  assert.strictEqual(res.items[1].aktif, true);
});

// 7. soal: multi-baris MATCH (merge / sel lanjutan kosong + pengulangan kode/no)
check("soal: multi-baris MATCH menggabung pasangan ke 1 soal tanpa duplikat", () => {
  const rows = [
    ["No", "Kode", "Tipe", "Teks", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Kunci", "Kiri", "Kanan", "Bobot"],
    [1, "q_bio", "match", "Jodohkan organ!", "", "", "", "", "", "Alveolus", "Pertukaran O2", 30],
    ["", "", "", "", "", "", "", "", "", "Trakea", "Saring debu", ""],
    ["1", "q_bio", "match", "Jodohkan organ!", "", "", "", "", "", "Diafragma", "Pengatur napas", ""],
    [2, "q_bio", "match", "Jodohkan besaran!", "", "", "", "", "", "Panjang", "Meter", 20],
    ["", "", "", "", "", "", "", "", "", "Massa", "Kilogram", ""]
  ];
  const res = parseSoal(rows);
  assert.equal(res.errors.length, 0, JSON.stringify(res.errors));
  assert.equal(res.items.length, 2);
  assert.deepEqual(res.ringkasan, { pg: 0, bs: 0, match: 2, essay: 0 });
  assert.deepEqual(res.items[0].kiri, ["Alveolus", "Trakea", "Diafragma"]);
  assert.deepEqual(res.items[0].kanan, ["Pertukaran O2", "Saring debu", "Pengatur napas"]);
  assert.equal(res.items[0].kunci, "Alveolus>Pertukaran O2;Trakea>Saring debu;Diafragma>Pengatur napas");
  assert.deepEqual(res.items[1].kiri, ["Panjang", "Massa"]);
});

console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
process.exit(fail ? 1 : 0);
