// Import & Export Excel Orchestrator (Soal, Siswa, Guru)
// Mengoordinasikan panel impor (parse -> pratinjau -> simpan) dan tombol template/export.

import { readExcelFile, downloadSheet, esc } from "./import/excel-core.js";
import { bindImportPanel } from "./import/panel.js";
import { parseSoal } from "./import/soal-importer.js";
import { parseSiswa, parseGuru } from "./import/user-importer.js";
import { previewRoster, saveRoster, statusBadge } from "./import/roster-save.js";
import { initAccountTools } from "./import/account-tools.js";
import {
  downloadTemplateSoal,
  downloadTemplateSiswa,
  downloadTemplateGuru,
  exportSiswaXLSX,
  exportGuruXLSX,
  exportSoalXLSX
} from "./import/export-templates.js";

// Re-export untuk backward compatibility & automated unit testing di Node.js
export { parseSoal, parseSiswa, parseGuru, readExcelFile, downloadSheet };

function toBuilderItems(items) {
  return items.map((q, idx) => {
    let kunci = q.kunci;
    if (q.tipe === "bs") {
      if (q.kunci === "A") kunci = "true";
      else if (q.kunci === "B") kunci = "false";
    }
    return {
      id: `q${idx + 1}`,
      tipe: q.tipe,
      teks: q.teks,
      bobot: q.bobot || 25,
      pilihan: { ...q.pilihan },
      kunci,
      kiri: Array.isArray(q.kiri) && q.kiri.length ? [...q.kiri] : ["", ""],
      kanan: Array.isArray(q.kanan) && q.kanan.length ? [...q.kanan] : ["", ""]
    };
  });
}

function bindRosterSave(fb, showToast, { kind, label, panel, ribbonId, btnId }) {
  const btn = document.getElementById(btnId);
  btn?.addEventListener("click", async () => {
    const diff = panel.ctx.diff;
    if (!diff || btn.disabled) return;
    const total = diff.baru.length + diff.ubah.length;
    if (!total) return showToast("Tidak ada perubahan untuk disimpan.", "warn");
    btn.disabled = true;
    const ribbon = document.getElementById(ribbonId);
    const r = await saveRoster(fb, kind, diff, (p) => {
      if (ribbon) ribbon.textContent = `Progres Simpan ${label}: ${p.terkirim} terkirim, ${p.gagal} gagal (dari ${p.total})`;
    });
    const extra = r.sinkron ? `, ${r.sinkron} akun siswa disinkronkan` : "";
    showToast(
      r.gagal
        ? `Selesai: ${r.terkirim} tersimpan, ${r.gagal} gagal${extra}.`
        : `${r.terkirim} ${label} tersimpan, ${r.dilewati} tanpa perubahan dilewati${extra}.`,
      r.gagal ? "warn" : "ok"
    );
    btn.disabled = !r.gagal; // sukses: kunci sampai berkas baru dipilih; gagal: boleh coba lagi
  });
}

export async function initImportExport() {
  if (typeof document === "undefined") return;

  const [fb, { showToast }, { setQuestionsList, renderQBuilder }] = await Promise.all([
    import("../core/firebase.js"),
    import("../core/toast.js"),
    import("./qbuilder.js")
  ]);

  // --- 1. SOAL ---
  const soal = bindImportPanel({
    key: "soal",
    showToast,
    parse: parseSoal,
    summary: ({ ringkasan: r }) => `${r.pg} PG, ${r.bs} BS, ${r.match} Match, ${r.essay} Essay`,
    columns: ["Kode", "Tipe", "Teks Soal", "Kunci", "Bobot"],
    cells: (it) => [
      `<code>${esc(it.kode)}</code>`,
      `<span class="badge badge-${esc(it.tipe)}">${esc(it.tipe.toUpperCase())}</span>`,
      esc(it.teks),
      `<code>${esc(it.kunci)}</code>`,
      esc(it.bobot)
    ],
    onParsed: ({ items }) => {
      const kodes = [...new Set(items.map((i) => i.kode))];
      return kodes.length > 1
        ? { note: `⚠ berkas berisi ${kodes.length} kode (${kodes.slice(0, 4).join(", ")}); semua soal digabung ke satu Builder` }
        : {};
    }
  });
  document.getElementById("btn-imp-save-soal")?.addEventListener("click", () => {
    if (!soal.items.length) return;
    const builderItems = toBuilderItems(soal.items);
    const asCodeEl = document.getElementById("as-code");
    if (asCodeEl && !asCodeEl.value.trim() && soal.items[0]?.kode) asCodeEl.value = soal.items[0].kode;
    setQuestionsList(builderItems);
    renderQBuilder();
    showToast(`${builderItems.length} butir soal dimasukkan ke Builder Asesmen.`, "ok");
    document.querySelector(".nav-btn[data-tab='sec-asesmen']")?.click();
  });

  // --- 2. SISWA ---
  const siswa = bindImportPanel({
    key: "siswa",
    showToast,
    parse: parseSiswa,
    summary: ({ items }) => `${items.length} siswa valid`,
    columns: ["NIS", "Nama", "Kelas", "Status"],
    cells: (it, i, ctx) => [`<code>${esc(it.nis)}</code>`, esc(it.nama), `<span class="badge badge-pg">${esc(it.kelas)}</span>`, statusBadge(it, ctx, "nis")],
    onParsed: (res) => previewRoster(fb, "siswa", res)
  });
  bindRosterSave(fb, showToast, { kind: "siswa", label: "siswa", panel: siswa, ribbonId: "imp-ribbon-siswa", btnId: "btn-imp-save-siswa" });

  // --- 3. GURU ---
  const guru = bindImportPanel({
    key: "guru",
    showToast,
    parse: parseGuru,
    summary: ({ items }) => `${items.length} undangan guru valid`,
    columns: ["Email (ID)", "Nama", "NIP", "Mapel", "Aktif", "Status"],
    cells: (it, i, ctx) => [
      `<code>${esc(it.email)}</code>`,
      esc(it.nama),
      esc(it.nip || "-"),
      esc(it.mapel || "-"),
      `<span class="badge ${it.aktif ? "badge-ok" : "badge-danger"}">${it.aktif ? "Ya" : "Tidak"}</span>`,
      statusBadge(it, ctx, "email")
    ],
    onParsed: (res) => previewRoster(fb, "guru", res)
  });
  bindRosterSave(fb, showToast, { kind: "guru", label: "undangan guru", panel: guru, ribbonId: "imp-ribbon-guru", btnId: "btn-imp-save-guru" });

  // --- 4. TEMPLATE & EXPORT ---
  const ctx = { db: fb.db, collection: fb.collection, getDocs: fb.getDocs, showToast };
  const on = (id, fn) => document.getElementById(id)?.addEventListener("click", fn);
  on("btn-tpl-soal", downloadTemplateSoal);
  on("btn-tpl-siswa", downloadTemplateSiswa);
  on("btn-tpl-guru", downloadTemplateGuru);
  on("btn-export-siswa-xlsx", () => exportSiswaXLSX(ctx));
  on("btn-export-guru-xlsx", () => exportGuruXLSX(ctx));
  on("btn-export-soal-xlsx", () => exportSoalXLSX(ctx));
  initAccountTools(fb);
}
