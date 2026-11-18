// Parser Roster Siswa & Undangan Guru Excel
// Pure function tanpa dependency DOM/Firebase agar dapat diuji di Node.js.
import { normHeader, findCol, getCell, isRowEmpty } from "./excel-core.js";

/**
 * Parse sheet Siswa: NIS | Nama | Kelas
 */
export function parseSiswa(rows) {
  const items = [];
  const errors = [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return { items, errors, ringkasan: { total: 0 } };
  }

  const hdr = normHeader(rows[0]);
  const cNis = findCol(hdr, ["nis", "nisn"]);
  const cNama = findCol(hdr, ["nama", "nama siswa"]);
  const cKelas = findCol(hdr, ["kelas", "rombel"]);

  const seenNis = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isRowEmpty(row)) continue;
    const baris = i + 1;

    const nis = getCell(row, cNis);
    const nama = getCell(row, cNama);
    const kelas = getCell(row, cKelas);

    if (!nis) {
      errors.push({ baris, pesan: "NIS tidak boleh kosong" });
      continue;
    }
    if (!nama) {
      errors.push({ baris, pesan: "Nama siswa tidak boleh kosong" });
      continue;
    }
    if (!kelas) {
      errors.push({ baris, pesan: "Kelas tidak boleh kosong" });
      continue;
    }
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(nis)) {
      errors.push({ baris, pesan: `NIS tidak sah: "${nis}" (hanya huruf, angka, titik, strip)` });
      continue;
    }
    if (kelas.includes("/") || kelas.length > 30 || nama.length > 100) {
      errors.push({ baris, pesan: "Nama/Kelas terlalu panjang atau mengandung karakter '/'" });
      continue;
    }
    if (seenNis.has(nis)) {
      errors.push({ baris, pesan: `NIS duplikat: "${nis}"` });
      continue;
    }

    seenNis.add(nis);
    items.push({ nis, nama, kelas, claimedBy: null });
  }

  return { items, errors, ringkasan: { total: items.length } };
}

/**
 * Parse sheet Guru: Email | Nama | NIP | Mapel | Aktif
 */
export function parseGuru(rows) {
  const items = [];
  const errors = [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return { items, errors, ringkasan: { total: 0 } };
  }

  const hdr = normHeader(rows[0]);
  const cEmail = findCol(hdr, ["email"]);
  const cNama = findCol(hdr, ["nama", "nama guru"]);
  const cNip = findCol(hdr, ["nip"]);
  const cMapel = findCol(hdr, ["mapel", "mata pelajaran"]);
  const cAktif = findCol(hdr, ["aktif", "status"]);

  const seenEmail = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isRowEmpty(row)) continue;
    const baris = i + 1;

    const rawEmail = getCell(row, cEmail);
    const email = rawEmail.toLowerCase();
    const nama = getCell(row, cNama);
    const nip = cNip !== -1 ? getCell(row, cNip) : "";
    const mapel = cMapel !== -1 ? getCell(row, cMapel) : "";
    const rawAktif = cAktif !== -1 ? getCell(row, cAktif).toLowerCase() : "";

    if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email)) {
      errors.push({ baris, pesan: `Email tidak sah: "${rawEmail}"` });
      continue;
    }
    if (!nama) {
      errors.push({ baris, pesan: "Nama guru tidak boleh kosong" });
      continue;
    }
    if (seenEmail.has(email)) {
      errors.push({ baris, pesan: `Email duplikat: "${email}"` });
      continue;
    }

    let aktif = true;
    if (rawAktif === "" || rawAktif === "ya" || rawAktif === "true" || rawAktif === "1") {
      aktif = true;
    } else if (rawAktif === "tidak" || rawAktif === "false" || rawAktif === "0") {
      aktif = false;
    } else {
      errors.push({ baris, pesan: `Nilai Aktif tidak sah: "${rawAktif}" (isi Ya/Tidak)` });
      continue;
    }

    seenEmail.add(email);
    items.push({ email, nama, nip, mapel, aktif });
  }

  return { items, errors, ringkasan: { total: items.length } };
}
