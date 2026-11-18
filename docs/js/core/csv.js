// CSV Builder & Downloader (aman untuk Excel: BOM UTF-8 + anti formula-injection)

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(v) {
  let s = v === null || v === undefined ? "" : String(v);
  // Neutralkan sel yang akan dieksekusi Excel sebagai rumus (kecuali angka murni)
  if (FORMULA_START.test(s) && Number.isNaN(Number(s))) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCSV(rows) {
  return "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function downloadBlob(filename, blob) {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadCSV(filename, rows) {
  downloadBlob(filename, new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8;" }));
}
