// Panel impor generik: file -> parse -> ringkasan -> pratinjau (dipakai Soal, Siswa, Guru)
import { readExcelFile, renderErrorsBox, validateFile, esc } from "./excel-core.js";

const PREVIEW_LIMIT = 200;

/**
 * @param cfg.key      "soal" | "siswa" | "guru" (menentukan id elemen imp-*-{key})
 * @param cfg.parse    (rows) => { items, errors, ringkasan }
 * @param cfg.columns  header tabel pratinjau
 * @param cfg.cells    (item, idx, ctx) => array HTML sel (sudah di-escape)
 * @param cfg.summary  (res) => string ringkasan
 * @param cfg.onParsed async (res) => ctx { note?, blocked? } (opsional)
 */
export function bindImportPanel(cfg) {
  const $ = (id) => document.getElementById(id);
  const input = $(`imp-file-${cfg.key}`);
  const ribbon = $(`imp-ribbon-${cfg.key}`);
  const errBox = $(`imp-errors-${cfg.key}`);
  const preview = $(`imp-preview-${cfg.key}`);
  const btn = $(`btn-imp-save-${cfg.key}`);
  const state = { items: [], ctx: {} };

  input?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const bad = validateFile(file);
      if (bad) throw new Error(bad);
      const res = cfg.parse(await readExcelFile(file));
      state.items = res.items;
      state.ctx = (await cfg.onParsed?.(res)) || {};

      if (ribbon) {
        ribbon.classList.remove("hidden");
        ribbon.textContent = `${cfg.summary(res)} / ${res.errors.length} baris bermasalah${state.ctx.note ? " — " + state.ctx.note : ""}`;
      }
      renderErrorsBox(errBox, res.errors);
      if (preview) preview.innerHTML = renderPreview(cfg, res.items, state.ctx);
      if (btn) btn.disabled = !res.items.length || !!state.ctx.blocked;
    } catch (err) {
      state.items = [];
      if (btn) btn.disabled = true;
      cfg.showToast(`Gagal memproses Excel ${cfg.key}: ${err.message}`, "error");
    } finally {
      e.target.value = ""; // izinkan memilih berkas yang sama lagi setelah diperbaiki
    }
  });

  return state;
}

function renderPreview(cfg, items, ctx) {
  if (!items.length) {
    return `<div class="text-sm text-subtle" style="padding:12px">Tidak ada data valid untuk ditampilkan.</div>`;
  }
  const shown = items.slice(0, PREVIEW_LIMIT);
  const more = items.length > shown.length ? `<div class="text-xs text-subtle" style="padding:8px">+ ${items.length - shown.length} baris lainnya tidak ditampilkan</div>` : "";
  return `
    <div class="table-container" style="margin-top:10px; max-height:260px; overflow:auto">
      <table>
        <thead><tr><th>No</th>${cfg.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
        <tbody>${shown
          .map((it, i) => `<tr><td>${i + 1}</td>${cfg.cells(it, i, ctx).map((c) => `<td>${c}</td>`).join("")}</tr>`)
          .join("")}</tbody>
      </table>${more}
    </div>`;
}
