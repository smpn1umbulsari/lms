// SheetJS (XLSX) Core Helper & Common Row Parsers
// Digunakan bersama oleh import/export Soal, Siswa, dan Guru
import { buildStyledWorkbookBytes } from "./xlsx-style.js";

export function normHeader(row) {
  return (Array.isArray(row) ? row : []).map((c) => String(c ?? "").trim().toLowerCase());
}

export function findCol(headers, aliases) {
  for (const a of aliases) {
    const idx = headers.indexOf(a);
    if (idx !== -1) return idx;
  }
  return -1;
}

export function getCell(row, idx) {
  if (!Array.isArray(row) || idx < 0 || idx >= row.length) return "";
  return String(row[idx] ?? "").trim();
}

export function isRowEmpty(row) {
  if (!Array.isArray(row) || row.length === 0) return true;
  return row.every((c) => String(c ?? "").trim() === "");
}

export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function validateFile(file) {
  if (!/\.xlsx?$/i.test(file.name)) return "Format berkas harus .xlsx atau .xls";
  if (file.size > MAX_FILE_BYTES) return "Ukuran berkas melebihi 5 MB";
  return "";
}

/**
 * @param opts.extra         sheet tambahan [{ name, aoa, colWidths }]
 * @param opts.textCols      indeks kolom yang diformat teks (nol depan & NIP aman)
 * @param opts.centerCols    indeks kolom rata tengah
 * @param opts.padRows       jumlah baris kosong berformat teks di bawah header
 * @param opts.borderPadRows jumlah baris ber-border rapi siap isi
 * @param opts.merges        daftar SheetJS merge ranges
 * @param opts.rowGroups     indeks grup per baris data (zebra grouping untuk multi-baris)
 */
export function downloadSheet(filename, aoa, sheetName = "Data", opts = {}) {
  if (typeof window === "undefined" || !window.XLSX) return;
  const X = window.XLSX;
  const sheets = [
    {
      name: sheetName,
      aoa,
      colWidths: opts.colWidths,
      textCols: opts.textCols,
      centerCols: opts.centerCols,
      padRows: opts.padRows,
      borderPadRows: opts.borderPadRows,
      merges: opts.merges,
      rowGroups: opts.rowGroups,
      freezeHeader: opts.freezeHeader !== false
    },
    ...(opts.extra || []).map((ex) => ({
      name: ex.name,
      aoa: ex.aoa,
      colWidths: ex.colWidths || [24, 92],
      borderPadRows: ex.aoa.length,
      freezeHeader: true
    }))
  ];

  const outBytes = buildStyledWorkbookBytes(X, sheets);
  const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (typeof Blob !== "undefined" && typeof URL?.createObjectURL === "function") {
    const blob = new Blob([outBytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const wb = X.read(outBytes, { type: "array" });
  X.writeFile(wb, filename);
}

export function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.XLSX) {
      reject(new Error("Library SheetJS (XLSX) belum dimuat."));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = window.XLSX.read(data, { type: "array", raw: false });
        const firstSheet = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheet];
        const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca berkas Excel."));
    reader.readAsArrayBuffer(file);
  });
}

export function renderErrorsBox(el, errors) {
  if (!el) return;
  if (!errors || !errors.length) {
    el.innerHTML = "";
    el.classList.add("hidden");
    return;
  }
  el.classList.remove("hidden");
  el.innerHTML = `
    <div style="font-weight:600; margin-bottom:4px">Daftar Baris Bermasalah (${errors.length}):</div>
    <ul style="margin:0; padding-left:18px; font-size:12px">
      ${errors.map((e) => `<li>Baris ${e.baris}: ${esc(e.pesan)}</li>`).join("")}
    </ul>
  `;
}
