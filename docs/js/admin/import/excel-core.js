// SheetJS (XLSX) Core Helper & Common Row Parsers
// Digunakan bersama oleh import/export Soal, Siswa, dan Guru

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
 * @param opts.extra    sheet tambahan [{ name, aoa }] (mis. Petunjuk)
 * @param opts.textCols indeks kolom yang diformat teks (nol depan aman)
 * @param opts.padRows  jumlah baris kosong berformat teks di bawah header
 */
export function downloadSheet(filename, aoa, sheetName = "Data", opts = {}) {
  if (typeof window === "undefined" || !window.XLSX) return;
  const X = window.XLSX;
  const wb = X.utils.book_new();
  const ws = X.utils.aoa_to_sheet(aoa);
  const ncols = Math.max(...aoa.map((r) => r.length));
  if (opts.textCols?.length && opts.padRows) {
    for (let r = aoa.length; r <= opts.padRows; r++) {
      for (const c of opts.textCols) ws[X.utils.encode_cell({ r, c })] = { t: "s", v: "", z: "@" };
    }
    ws["!ref"] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(opts.padRows, aoa.length - 1), c: ncols - 1 } });
  }
  ws["!cols"] = Array.from({ length: ncols }, (_, c) => ({
    wch: Math.min(60, Math.max(10, ...aoa.map((r) => String(r[c] ?? "").length)) + 2)
  }));
  X.utils.book_append_sheet(wb, ws, sheetName);
  for (const ex of opts.extra || []) {
    const s2 = X.utils.aoa_to_sheet(ex.aoa);
    s2["!cols"] = [{ wch: 28 }, { wch: 90 }];
    X.utils.book_append_sheet(wb, s2, ex.name);
  }
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
