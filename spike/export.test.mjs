// Tes unit: CSV aman, diff roster, rekap nilai, round-trip export->import soal, validasi parser
// Jalankan: node spike/export.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { csvCell, toCSV } from "../docs/js/core/csv.js";
import { diffSiswa, diffGuru, unknownClasses, isSuperAdminDoc } from "../docs/js/admin/import/roster-diff.js";
import { buildRekapRows, scoreOf } from "../docs/js/admin/export/rekap.js";
import { buildSoalRows, buildSoalSheetData } from "../docs/js/admin/import/soal-exporter.js";
import { parseSoal } from "../docs/js/admin/import/soal-importer.js";
import { parseSiswa, parseGuru } from "../docs/js/admin/import/user-importer.js";
import { parseNilaiImport } from "../docs/js/admin/import/nilai-importer.js";
import { buildStyledWorkbookBytes } from "../docs/js/admin/import/xlsx-style.js";
import {
  buildTemplateSoalSpec,
  buildTemplateSiswaSpec,
  buildTemplateGuruSpec
} from "../docs/js/admin/import/export-templates.js";

let pass = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log("PASS  ", name); }
  catch (e) { console.error("FAIL  ", name, "->", e.message); process.exit(1); }
};

// ---- CSV ----
t("csv: kutip ganda di-escape & BOM ada", () => {
  assert.equal(csvCell('a"b'), '"a""b"');
  assert(toCSV([["x"]]).startsWith("\ufeff"));
});
t("csv: formula injection dinetralkan, angka negatif tetap", () => {
  assert.equal(csvCell("=HYPERLINK(1)"), `"'=HYPERLINK(1)"`);
  assert.equal(csvCell("@SUM(A1)"), `"'@SUM(A1)"`);
  assert.equal(csvCell("-5"), '"-5"');
  assert.equal(csvCell(0), '"0"');
  assert.equal(csvCell(null), '""');
});

// ---- Roster diff ----
t("siswa diff: baru/ubah/sama + claimedBy dipertahankan", () => {
  const items = [
    { nis: "1", nama: "Ani", kelas: "7A" },
    { nis: "2", nama: "Budi", kelas: "7B" },
    { nis: "3", nama: "Cici", kelas: "7A" }
  ];
  const ex = new Map([
    ["1", { nama: "Ani", kelas: "7A", claimedBy: "u1" }],
    ["2", { nama: "Budi", kelas: "7A", claimedBy: "u2" }],
    ["9", { nama: "Lama", kelas: "7A", claimedBy: null }]
  ]);
  const d = diffSiswa(items, ex);
  assert.equal(d.baru.length, 1);
  assert.equal(d.sama.length, 1);
  assert.equal(d.ubah.length, 1);
  assert.equal(d.ubah[0].claimedBy, "u2");
  assert.equal(d.tidakDiFile, 1);
});
t("guru diff: aktif undefined dianggap true (tanpa perubahan)", () => {
  const d = diffGuru(
    [{ email: "a@s.id", nama: "A", nip: "", mapel: "", aktif: true }],
    new Map([["a@s.id", { nama: "A" }]])
  );
  assert.equal(d.sama.length, 1);
});
t("unknownClasses & isSuperAdminDoc", () => {
  assert.deepEqual(unknownClasses([{ kelas: "7A" }, { kelas: "9Z" }, { kelas: "9Z" }], new Set(["7A"])), { "9Z": 2 });
  assert(!isSuperAdminDoc({ ok: true }));
  assert(isSuperAdminDoc({ role: "admin" }));
  assert(!isSuperAdminDoc({ role: "guru" }));
  assert(!isSuperAdminDoc(undefined));
});

// ---- Rekap ----
t("rekap: rata-rata & nilai akhir 40/60, sel kosong tetap kosong", () => {
  const rows = buildRekapRows({
    students: [{ uid: "u1", nis: "007", nama: "Ani", kelas: "7A" }, { uid: "u2", nis: "8", nama: "Budi", kelas: "7A" }],
    assignments: [{ id: "a1", judul: "T1" }],
    quizzes: [{ id: "q1", judul: "U1" }],
    subMap: { u1: { a1: 80 } },
    resMap: { u1: { q1: 90 } }
  });
  assert.deepEqual(rows[0].slice(0, 3), ["NIS", "Nama Siswa", "Kelas"]);
  assert.deepEqual(rows[1], ["007", "Ani", "7A", 80, 80, 90, 90, 86]);
  assert.deepEqual(rows[2], ["8", "Budi", "7A", "", "", "", "", ""]);
});
t("scoreOf: prioritas field (pct > totalScore) & nilai 0 dihitung", () => {
  assert.equal(scoreOf({ pct: 75, totalScore: 150 }), 75);
  assert.equal(scoreOf({ totalScore: 0, score: 5 }), 0);
  assert.equal(scoreOf({ nilai: "70" }), 70);
  assert.equal(scoreOf({}), undefined);
});

// ---- Round-trip soal ----
t("soal: export -> import mempertahankan tipe, kunci, bobot, match", () => {
  const quizzes = [{
    id: "q_ipa",
    data: { questions: [
      { id: "q1", tipe: "pg", teks: "Ibukota?", pilihan: { A: "Jakarta", B: "Bandung", C: "", D: "" }, kunci: "A", bobot: 40 },
      { id: "q2", tipe: "bs", teks: "Air 100C", pilihan: {}, kunci: "true", bobot: 20 },
      { id: "q3", tipe: "match", teks: "Jodohkan", kiri: ["Al", "Tr"], kanan: ["Difusi", "Saring"], kunci: undefined },
      { id: "q4", tipe: "essay", teks: "Jelaskan", pilihan: {} }
    ] }
  }];
  const keys = { q_ipa: { q3: { Al: "Difusi", Tr: "Saring" } } };
  const res = parseSoal(buildSoalRows(quizzes, keys));
  assert.equal(res.errors.length, 0, JSON.stringify(res.errors));
  assert.deepEqual(res.ringkasan, { pg: 1, bs: 1, match: 1, essay: 1 });
  assert.equal(res.items[0].bobot, 40);
  assert.equal(res.items[0].kunci, "A");
  assert.equal(res.items[1].kunci, "true");
  assert.deepEqual(res.items[2].kiri, ["Al", "Tr"]);
  assert.equal(res.items[3].bobot, 25);
});

// ---- Validasi parser baru ----
t("soal: PG kunci ke opsi kosong / kurang 2 opsi / bobot salah ditolak", () => {
  const H = ["Kode", "Tipe", "Teks", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Kunci", "Bobot"];
  const r = parseSoal([
    H,
    ["q", "pg", "S1", "a", "b", "", "", "C", ""],
    ["q", "pg", "S2", "a", "", "", "", "A", ""],
    ["q", "pg", "S3", "a", "b", "", "", "A", "abc"],
    ["q", "pg", "S4", "a", "b", "", "", "A", "30"]
  ]);
  assert.equal(r.errors.length, 3);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].bobot, 30);
});
t("siswa: NIS dengan '/' ditolak; guru: email tanpa domain ditolak", () => {
  const s = parseSiswa([["NIS", "Nama", "Kelas"], ["12/3", "X", "7A"], ["123", "Y", "7A"]]);
  assert.equal(s.items.length, 1);
  assert.equal(s.errors.length, 1);
  const g = parseGuru([["Email", "Nama"], ["abc@x", "A"], ["ok@x.id", "B"]]);
  assert.equal(g.items.length, 1);
  assert.equal(g.errors.length, 1);
});

// ---- Nilai importer ----
t("nilai: parse nilai valid, hitung rata-rata, min, max, dan sanitasi catatan", () => {
  const H = ["NIS", "Nama Siswa", "Kelas", "Nilai", "Catatan Guru"];
  const res = parseNilaiImport([
    H,
    ["1001", "Ani", "7A", "85", "Sangat baik"],
    ["1002", "Budi", "7A", "95", "Luar biasa"],
    ["1003", "Cici", "7A", "60", "Perlu remidi"]
  ]);
  assert.equal(res.errors.length, 0);
  assert.equal(res.items.length, 3);
  assert.deepEqual(res.ringkasan, { total: 3, avg: 80, min: 60, max: 95 });
  assert.equal(res.items[0].identifier, "1001");
  assert.equal(res.items[0].nilai, 85);
  assert.equal(res.items[0].catatan, "Sangat baik");
});

t("nilai: nilai di luar 0-100, duplikat, atau tanpa header ditolak", () => {
  const H = ["NIS", "Nilai"];
  const res = parseNilaiImport([
    H,
    ["1001", "105"], // > 100
    ["1002", "-5"],  // < 0
    ["1003", "abc"], // NaN
    ["1004", ""],    // Kosong
    ["1005", "75"],   // Valid
    ["1005", "80"]    // Duplikat
  ]);
  assert.equal(res.errors.length, 5);
  assert.equal(res.items.length, 1);
  assert.equal(res.items[0].identifier, "1005");
  assert.equal(res.items[0].nilai, 75);

  const noHdr = parseNilaiImport([["Nama", "Kelas"]]);
  assert.equal(noHdr.errors.length, 1);
  assert.equal(noHdr.items.length, 0);
});

t("template xlsx: style header teal, border tipis, freeze pane, merge MATCH & round-trip parser bersih", () => {
  const ctx = { window: {}, self: {}, global: {}, Uint8Array, ArrayBuffer, DataView, TextEncoder, TextDecoder };
  vm.runInNewContext(readFileSync(new URL("../docs/vendor/xlsx.full.min.js", import.meta.url), "utf8"), ctx);
  const X = ctx.XLSX || ctx.window.XLSX;
  const dec = new TextDecoder();

  const specSoal = buildTemplateSoalSpec();
  const soalBytes = buildStyledWorkbookBytes(X, [
    { name: specSoal.sheetName, aoa: specSoal.aoa, ...specSoal.opts },
    ...(specSoal.opts.extra || []).map((e) => ({ ...e, borderPadRows: e.aoa.length }))
  ]);
  const zipSoal = X.CFB.read(soalBytes, { type: "array" });
  const stylesXml = dec.decode(Uint8Array.from(X.CFB.find(zipSoal, "/xl/styles.xml").content));
  const sheet1Xml = dec.decode(Uint8Array.from(X.CFB.find(zipSoal, "/xl/worksheets/sheet1.xml").content));

  assert(stylesXml.includes('style="thin"'), "Border tipis harus tertulis di styles.xml");
  assert(stylesXml.includes("FF0F6B5C"), "Warna header teal #0F6B5C harus ada");
  assert(stylesXml.includes("FFF4F9F7"), "Warna baris zebra harus ada");
  assert(stylesXml.includes('numFmtId="49"'), "Format teks @ harus ada");
  assert(sheet1Xml.includes('ySplit="1"'), "Freeze pane baris header harus aktif");
  assert(sheet1Xml.includes("<mergeCells"), "Merge vertikal untuk contoh MATCH multi-baris harus ada");
  assert(sheet1Xml.includes('s="1"'), "Sel header harus memakai style 1");

  const wbSoal = X.read(soalBytes, { type: "array", raw: false });
  const rowsSoal = X.utils.sheet_to_json(wbSoal.Sheets[specSoal.sheetName], { header: 1, defval: "", raw: false });
  const parsedSoal = parseSoal(rowsSoal);
  assert.equal(parsedSoal.errors.length, 0, JSON.stringify(parsedSoal.errors));
  assert.deepEqual(parsedSoal.ringkasan, { pg: 1, bs: 1, match: 1, essay: 1 });
  assert.equal(parsedSoal.items[2].kiri.length, 3);

  const specSiswa = buildTemplateSiswaSpec();
  const siswaBytes = buildStyledWorkbookBytes(X, [{ name: specSiswa.sheetName, aoa: specSiswa.aoa, ...specSiswa.opts }]);
  const wbSiswa = X.read(siswaBytes, { type: "array", raw: false });
  const parsedSiswa = parseSiswa(X.utils.sheet_to_json(wbSiswa.Sheets[specSiswa.sheetName], { header: 1, defval: "", raw: false }));
  assert.equal(parsedSiswa.errors.length, 0);
  assert.strictEqual(parsedSiswa.items[0].nis, "007");

  const specGuru = buildTemplateGuruSpec();
  const guruBytes = buildStyledWorkbookBytes(X, [{ name: specGuru.sheetName, aoa: specGuru.aoa, ...specGuru.opts }]);
  const wbGuru = X.read(guruBytes, { type: "array", raw: false });
  const parsedGuru = parseGuru(X.utils.sheet_to_json(wbGuru.Sheets[specGuru.sheetName], { header: 1, defval: "", raw: false }));
  assert.equal(parsedGuru.errors.length, 0);
  assert.strictEqual(parsedGuru.items[0].nip, "198501122010011005");

  const sheetData = buildSoalSheetData([{ id: "q_m", data: { questions: [{ id: "q1", tipe: "match", teks: "Jodoh", kiri: ["1", "2"], kanan: ["Satu", "Dua"] }] } }]);
  assert.equal(sheetData.aoa.length, 3);
  assert.equal(sheetData.merges.length, 10);
});

console.log(`\n=== ${pass} PASS / 0 FAIL ===`);
