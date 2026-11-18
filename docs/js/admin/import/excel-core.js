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

export function downloadSheet(filename, aoa, sheetName = "Data") {
  if (typeof window === "undefined" || !window.XLSX) return;
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(aoa), sheetName);
  window.XLSX.writeFile(wb, filename);
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
