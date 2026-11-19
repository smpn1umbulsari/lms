// Koreksi Massal & Import Nilai Ujian Orchestrator
import { auth, db, doc, getDoc, collection, query, where, getDocs, writeBatch, Timestamp } from "../core/firebase.js";
import { showToast } from "../core/toast.js";
import { readExcelFile, renderErrorsBox, esc } from "./import/excel-core.js";
import { parseNilaiImport } from "./import/nilai-importer.js";
import { downloadTemplateNilaiKuis, saveNilaiImport } from "./import/nilai-sync.js";

export function initKoreksiImport() {
  const toggleBtn = document.getElementById("btn-toggle-import-nilai");
  const panel = document.getElementById("panel-import-nilai");
  const tplBtn = document.getElementById("btn-tpl-nilai");
  const fileInput = document.getElementById("file-import-nilai");
  const ribbon = document.getElementById("ribbon-import-nilai");
  const errBox = document.getElementById("err-import-nilai");
  const preview = document.getElementById("preview-import-nilai");
  const saveBtn = document.getElementById("btn-save-import-nilai");

  let parsedItems = [];

  toggleBtn?.addEventListener("click", () => {
    panel?.classList.toggle("hidden");
  });

  tplBtn?.addEventListener("click", () => {
    const code = (document.getElementById("gr-code")?.value || "").trim();
    downloadTemplateNilaiKuis(code, { db, doc, getDoc, collection, query, where, getDocs, showToast });
  });

  fileInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await readExcelFile(file);
      const res = parseNilaiImport(rows);
      parsedItems = res.items;

      if (ribbon) {
        ribbon.classList.remove("hidden");
        ribbon.textContent = `${res.ringkasan.total} nilai valid (Rata-rata: ${res.ringkasan.avg}, Min: ${res.ringkasan.min}, Max: ${res.ringkasan.max}) / ${res.errors.length} baris bermasalah`;
      }
      renderErrorsBox(errBox, res.errors);

      if (preview) {
        if (!res.items.length) {
          preview.innerHTML = `<div class="text-sm text-subtle" style="padding:12px">Tidak ada baris nilai yang valid untuk ditampilkan.</div>`;
        } else {
          const shown = res.items.slice(0, 100);
          preview.innerHTML = `
            <div class="table-container" style="margin-top:10px; max-height:240px; overflow:auto">
              <table>
                <thead>
                  <tr><th>No</th><th>NIS / ID Siswa</th><th>Nilai Baru</th><th>Catatan Guru</th></tr>
                </thead>
                <tbody>
                  ${shown
                    .map(
                      (it, idx) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td><code>${esc(it.identifier)}</code></td>
                      <td><strong style="color:var(--ok); font-variant-numeric:tabular-nums">${it.nilai}</strong></td>
                      <td>${esc(it.catatan || "-")}</td>
                    </tr>`
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`;
        }
      }

      if (saveBtn) saveBtn.disabled = res.items.length === 0;
    } catch (err) {
      parsedItems = [];
      if (saveBtn) saveBtn.disabled = true;
      showToast("Gagal memproses file nilai: " + err.message, "error");
    } finally {
      e.target.value = "";
    }
  });

  saveBtn?.addEventListener("click", async () => {
    const code = (document.getElementById("gr-code")?.value || "").trim();
    if (!code) return showToast("Masukkan kode kuis pada kolom input di atas!", "warn");
    if (!parsedItems.length) return showToast("Pilih file nilai terlebih dahulu!", "warn");

    saveBtn.disabled = true;
    try {
      await saveNilaiImport(code, parsedItems, { auth, db, doc, collection, query, where, getDocs, writeBatch, Timestamp, showToast });
      if (ribbon) ribbon.textContent = `Selesai: ${parsedItems.length} nilai kuis ${code} berhasil disimpan.`;
    } catch (e) {
      saveBtn.disabled = false;
    }
  });
}
