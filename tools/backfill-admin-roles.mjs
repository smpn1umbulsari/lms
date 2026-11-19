#!/usr/bin/env node
/**
 * Backfill `role` pada koleksi `admins/{uid}` sebelum mendeploy firestore.rules ketat.
 * Penggunaan:
 *   node tools/backfill-admin-roles.mjs --project=lms-situri --superadmin=<uid_atau_email> [--apply] [--emulator=127.0.0.1:8080] [--token=<access_token>]
 *
 * Tanpa --apply, skrip hanya berjalan dalam mode dry-run.
 */
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    project: { type: "string", default: "lms-situri" },
    superadmin: { type: "string", default: "" },
    apply: { type: "boolean", default: false },
    emulator: { type: "string", default: "" },
    token: { type: "string", default: process.env.FIRESTORE_ACCESS_TOKEN || "" },
    help: { type: "boolean", default: false }
  }
});

if (values.help) {
  console.log(`Penggunaan:
  node tools/backfill-admin-roles.mjs --project=<id> --superadmin=<uid1,email2> [--apply] [--emulator=127.0.0.1:8080]

Catatan:
  - Dokumen admins/{uid} yang ada di --superadmin akan diset role="admin".
  - Dokumen admins/{uid} lain yang belum memiliki field role akan diset role="guru".
  - Tanpa --token (atau --emulator), jalankan: gcloud auth print-access-token`);
  process.exit(0);
}

const superSet = new Set(
  values.superadmin.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
);
const baseUrl = values.emulator
  ? `http://${values.emulator}/v1/projects/${values.project}/databases/(default)/documents`
  : `https://firestore.googleapis.com/v1/projects/${values.project}/databases/(default)/documents`;

const headers = { "Content-Type": "application/json" };
if (values.token) headers.Authorization = `Bearer ${values.token}`;
else if (values.emulator) headers.Authorization = "Bearer owner";

if (!values.emulator && !values.token) {
  console.error("Error: Sertakan --token=<gcloud auth print-access-token> atau --emulator=127.0.0.1:8080.");
  process.exit(1);
}

const listRes = await fetch(`${baseUrl}/admins?pageSize=300`, { headers });
if (!listRes.ok) {
  console.error("Gagal membaca koleksi admins:", listRes.status, await listRes.text());
  process.exit(1);
}
const { documents = [] } = await listRes.json();
console.log(`Ditemukan ${documents.length} dokumen di koleksi admins.`);

let updated = 0;
for (const d of documents) {
  const uid = d.name.split("/").pop();
  const f = d.fields || {};
  const email = (f.email?.stringValue || "").toLowerCase();
  const curRole = f.role?.stringValue || null;
  const targetRole = superSet.has(uid.toLowerCase()) || (email && superSet.has(email)) ? "admin" : curRole || "guru";

  if (curRole === targetRole) {
    console.log(`[SKIP] ${uid} (${email || "-"}) sudah role="${curRole}"`);
    continue;
  }
  console.log(`[${values.apply ? "APPLY" : "DRY-RUN"}] ${uid} (${email || "-"}): ${curRole || "(kosong)"} -> role="${targetRole}"`);
  if (values.apply) {
    const patchRes = await fetch(`${baseUrl}/admins/${encodeURIComponent(uid)}?updateMask.fieldPaths=role`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ fields: { role: { stringValue: targetRole } } })
    });
    if (!patchRes.ok) {
      console.error(`  Gagal patch ${uid}:`, patchRes.status, await patchRes.text());
      process.exitCode = 1;
    } else updated++;
  }
}
console.log(`Selesai (${values.apply ? `${updated} dokumen diperbarui` : "mode dry-run, jalankan dengan --apply untuk menulis"}).`);
