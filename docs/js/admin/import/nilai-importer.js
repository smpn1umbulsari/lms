// Parser Nilai Ujian / Koreksi Massal (Excel & CSV)
// Pure function tanpa dependency DOM/Firebase agar dapat diuji di Node.js.
import { normHeader, findCol, getCell, isRowEmpty } from "./excel-core.js";

/**
 * Parse sheet Nilai: NIS/UID | Nilai | Catatan (opsional)
 */
export function parseNilaiImport(rows) {
  const items = [];
  const errors = [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return { items, errors, ringkasan: { total: 0, avg: 0, min: 0, max: 0 } };
  }

  const hdr = normHeader(rows[0]);
  const cId = findCol(hdr, ["nis", "nisn", "uid", "id siswa", "id"]);
  const cNilai = findCol(hdr, ["nilai", "skor", "score", "poin"]);
  const cCatatan = findCol(hdr, ["catatan", "catatan guru", "feedback", "keterangan"]);

  if (cId === -1 || cNilai === -1) {
    errors.push({
      baris: 1,
      pesan: "Header harus memuat kolom 'NIS' (atau 'UID') dan kolom 'Nilai'."
    });
    return { items, errors, ringkasan: { total: 0, avg: 0, min: 0, max: 0 } };
  }

  const seenId = new Set();
  let sum = 0;
  let min = 100;
  let max = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isRowEmpty(row)) continue;
    const baris = i + 1;

    const id = getCell(row, cId);
    const rawNilai = getCell(row, cNilai);
    const catatan = cCatatan !== -1 ? getCell(row, cCatatan) : "";

    if (!id) {
      errors.push({ baris, pesan: "Kolom NIS / ID tidak boleh kosong" });
      continue;
    }

    const normId = id.toLowerCase();
    if (seenId.has(normId)) {
      errors.push({ baris, pesan: `NIS/ID duplikat: "${id}"` });
      continue;
    }

    if (rawNilai === "") {
      errors.push({ baris, pesan: `Nilai untuk NIS "${id}" belum diisi` });
      continue;
    }

    const n = Number(rawNilai.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      errors.push({
        baris,
        pesan: `Nilai "${rawNilai}" tidak sah (harus berupa angka 0 - 100)`
      });
      continue;
    }

    seenId.add(normId);
    items.push({
      identifier: id,
      nilai: Math.round(n),
      catatan: catatan.slice(0, 1000)
    });

    sum += n;
    if (n < min) min = n;
    if (n > max) max = n;
  }

  const total = items.length;
  const avg = total > 0 ? Math.round(sum / total) : 0;
  return {
    items,
    errors,
    ringkasan: { total, avg, min: total ? min : 0, max: total ? max : 0 }
  };
}
