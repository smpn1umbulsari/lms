#!/usr/bin/env node
/**
 * Generator Akun Massal + Kartu Login Siswa untuk Firebase Auth Spark ($0).
 * Penggunaan:
 *   npm run provision:accounts -- roster.xlsx [--kind=siswa|guru] [--domain=smpn1umbulsari.sch.id] [--out=out] [--url=https://lms-situri.web.app]
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { parseSiswa, parseGuru } from "../docs/js/admin/import/user-importer.js";
import { toCSV } from "../docs/js/core/csv.js";

const PASS_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const PBKDF2_ROUNDS = 100000;

export function generatePassword(len = 8, randBytes = crypto.randomBytes) {
  const bytes = randBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += PASS_ALPHABET[bytes[i] % PASS_ALPHABET.length];
  }
  return out;
}

export function buildAuthUser({ uid, email, displayName, password }, rounds = PBKDF2_ROUNDS) {
  const saltBytes = crypto.randomBytes(16);
  const hashBytes = crypto.pbkdf2Sync(password, saltBytes, rounds, 32, "sha256");
  return {
    localId: uid,
    email: String(email).toLowerCase(),
    emailVerified: true,
    displayName: String(displayName || ""),
    passwordHash: hashBytes.toString("base64"),
    salt: saltBytes.toString("base64")
  };
}

export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function readRowsFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".csv") {
    return parseCSV(fs.readFileSync(filePath, "utf8"));
  }
  const vendorPath = path.resolve(path.dirname(fileURLToPathSafe()), "../docs/vendor/xlsx.full.min.js");
  const sandbox = { window: {}, global: {}, self: {}, module: { exports: {} }, exports: {} };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  vm.runInNewContext(fs.readFileSync(vendorPath, "utf8"), sandbox);
  const XLSX = sandbox.XLSX || sandbox.window.XLSX || sandbox.module.exports;
  const wb = XLSX.read(fs.readFileSync(filePath), { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
}

function fileURLToPathSafe() {
  return path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
}

function escHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildCredentialsCSV(records) {
  const rows = [
    ["NIS / ID", "Nama", "Kelas", "Email Login", "Sandi Awal"],
    ...records.map((r) => [r.nis || "", r.nama, r.kelas || "GURU", r.email, r.password])
  ];
  return toCSV(rows);
}

export function buildLoginCardsHTML(records, portalUrl = "https://lms-situri.web.app") {
  const cards = records.map((r) => `
    <div class="card">
      <div class="head"><strong>SITURI LMS · SMPN 1 Umbulsari</strong><span>${escHtml(r.kelas || "GURU")}</span></div>
      <div class="name">${escHtml(r.nama)}</div>
      <div class="row"><span>Masuk (NIS/Email):</span><code>${escHtml(r.nis || r.email)}</code></div>
      <div class="row"><span>Email Lengkap:</span><code>${escHtml(r.email)}</code></div>
      <div class="row"><span>Sandi Awal:</span><code class="pass">${escHtml(r.password)}</code></div>
      <div class="url">${escHtml(portalUrl)}</div>
    </div>`).join("\n");

  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>Kartu Login — SITURI LMS</title>
<style>
  body{font-family:system-ui,-apple-system,sans-serif;margin:16px;color:#14161a}
  .toolbar{margin-bottom:14px;display:flex;justify-content:space-between;align-items:center}
  .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .card{border:1px solid #d4d4d8;border-radius:8px;padding:12px;break-inside:avoid}
  .head{display:flex;justify-content:space-between;font-size:11px;color:#525860;border-bottom:1px solid #e7e5e0;padding-bottom:4px;margin-bottom:6px}
  .name{font-size:14px;font-weight:700;margin-bottom:6px}
  .row{display:flex;justify-content:space-between;font-size:12px;margin:3px 0}
  code{font-family:ui-monospace,monospace;background:#f4f4f5;padding:1px 5px;border-radius:4px}
  .pass{font-weight:700;font-size:13px}
  .url{font-size:10.5px;color:#0f6b5c;margin-top:6px;border-top:1px dashed #e7e5e0;padding-top:4px}
  @media print{.toolbar{display:none} body{margin:6mm}}
</style></head><body>
<div class="toolbar"><strong>Kartu Akun SITURI LMS (${records.length} Akun)</strong><button onclick="window.print()">Cetak / Simpan PDF</button></div>
<div class="grid">${cards}</div></body></html>`;
}

export function provisionFromRows(rows, { kind = "siswa", domain = "smpn1umbulsari.sch.id", rounds = PBKDF2_ROUNDS } = {}) {
  const parsed = kind === "guru" ? parseGuru(rows) : parseSiswa(rows);
  const records = parsed.items.map((it) => {
    const password = generatePassword(8);
    if (kind === "guru") {
      const safeId = `guru_${crypto.createHash("sha256").update(it.email).digest("hex").slice(0, 16)}`;
      return { uid: safeId, email: it.email, nama: it.nama, kelas: it.mapel || "Guru", nis: "", password };
    }
    const email = `${it.nis.toLowerCase()}@${domain}`;
    const safeId = `sis_${it.nis.replace(/[^A-Za-z0-9_-]/g, "_")}`;
    return { uid: safeId, email, nama: it.nama, kelas: it.kelas, nis: it.nis, password };
  });

  const authUsers = records.map((r) => buildAuthUser({ uid: r.uid, email: r.email, displayName: r.nama, password: r.password }, rounds));
  return { errors: parsed.errors, records, authPayload: { users: authUsers } };
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      kind: { type: "string", default: "siswa" },
      domain: { type: "string", default: "smpn1umbulsari.sch.id" },
      out: { type: "string", default: "out" },
      url: { type: "string", default: "https://lms-situri.web.app" },
      help: { type: "boolean", default: false }
    }
  });
  const filePath = positionals[0];
  if (values.help) {
    console.log("Penggunaan: npm run provision:accounts -- <file.xlsx|csv> [--kind=siswa|guru] [--domain=smpn1umbulsari.sch.id] [--out=out]");
    process.exit(0);
  }
  if (!filePath) {
    console.log("Penggunaan: npm run provision:accounts -- <file.xlsx|csv> [--kind=siswa|guru] [--domain=smpn1umbulsari.sch.id] [--out=out]");
    process.exit(1);
  }

  const rows = readRowsFromFile(filePath);
  const res = provisionFromRows(rows, { kind: values.kind, domain: values.domain });
  if (res.errors.length) {
    console.warn("Peringatan baris bermasalah:", res.errors);
  }
  fs.mkdirSync(values.out, { recursive: true });
  const jsonPath = path.join(values.out, "auth-import.json");
  const csvPath = path.join(values.out, "Kredensial_Akun.csv");
  const htmlPath = path.join(values.out, "Kartu_Login_Siswa.html");

  fs.writeFileSync(jsonPath, JSON.stringify(res.authPayload, null, 2));
  fs.writeFileSync(csvPath, buildCredentialsCSV(res.records));
  fs.writeFileSync(htmlPath, buildLoginCardsHTML(res.records, values.url));

  console.log(`Berhasil memproses ${res.records.length} akun (${res.errors.length} baris dilewati).`);
  console.log(`1) Impor ke Firebase Auth:\n   npx firebase auth:import "${jsonPath}" --hash-algo=PBKDF2_SHA256 --rounds=${PBKDF2_ROUNDS}`);
  console.log(`2) Kartu Cetak Siswa: ${htmlPath}`);
  console.log(`3) Rekap Operator (rahasia): ${csvPath}`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main();
}
