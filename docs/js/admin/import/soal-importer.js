// Parser Soal CBT Excel (PG, Benar/Salah, Menjodohkan, Essay)
// Pure function tanpa dependency DOM/Firebase agar dapat diuji di Node.js.
import { normHeader, findCol, getCell, isRowEmpty } from "./excel-core.js";

/**
 * Parse sheet Soal: Kode | Tipe | Teks | Opsi A | Opsi B | Opsi C | Opsi D | Kunci | Kiri | Kanan
 */
export function parseSoal(rows) {
  const items = [];
  const errors = [];
  const ringkasan = { pg: 0, bs: 0, match: 0, essay: 0 };

  if (!Array.isArray(rows) || rows.length === 0) {
    return { items, errors, ringkasan };
  }

  const hdr = normHeader(rows[0]);
  const cKode = findCol(hdr, ["kode"]);
  const cTipe = findCol(hdr, ["tipe"]);
  const cTeks = findCol(hdr, ["teks", "pertanyaan", "soal"]);
  const cOpsiA = findCol(hdr, ["opsi a", "opsia", "pilihan a", "a"]);
  const cOpsiB = findCol(hdr, ["opsi b", "opsib", "pilihan b", "b"]);
  const cOpsiC = findCol(hdr, ["opsi c", "opsic", "pilihan c", "c"]);
  const cOpsiD = findCol(hdr, ["opsi d", "opsid", "pilihan d", "d"]);
  const cKunci = findCol(hdr, ["kunci", "jawaban"]);
  const cKiri = findCol(hdr, ["kiri", "kolom a"]);
  const cKanan = findCol(hdr, ["kanan", "kolom b"]);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isRowEmpty(row)) continue;
    const baris = i + 1;

    const kode = cKode !== -1 ? getCell(row, cKode) : `q${items.length + 1}`;
    const rawTipe = getCell(row, cTipe);
    const tipe = (rawTipe || "pg").toLowerCase();
    const teks = getCell(row, cTeks);
    const opsiA = getCell(row, cOpsiA);
    const opsiB = getCell(row, cOpsiB);
    const opsiC = getCell(row, cOpsiC);
    const opsiD = getCell(row, cOpsiD);
    const rawKunci = getCell(row, cKunci);
    const rawKiri = getCell(row, cKiri);
    const rawKanan = getCell(row, cKanan);

    if (cKode !== -1 && !kode) {
      errors.push({ baris, pesan: "Kode tidak boleh kosong" });
      continue;
    }
    if (!teks) {
      errors.push({ baris, pesan: "Teks soal tidak boleh kosong" });
      continue;
    }
    if (!["pg", "bs", "match", "essay"].includes(tipe)) {
      errors.push({ baris, pesan: `Tipe soal tidak dikenal: "${rawTipe}"` });
      continue;
    }

    let kunci = "";
    let kiri = ["", ""];
    let kanan = ["", ""];

    if (tipe === "pg") {
      const k = rawKunci.toUpperCase();
      if (!["A", "B", "C", "D"].includes(k)) {
        errors.push({ baris, pesan: `Kunci PG tidak sah: "${rawKunci}" (harus A..D)` });
        continue;
      }
      kunci = k;
    } else if (tipe === "bs") {
      const k = rawKunci.toUpperCase();
      if (!["A", "B", "C", "D", "TRUE", "FALSE", "BENAR", "SALAH"].includes(k)) {
        errors.push({ baris, pesan: `Kunci BS tidak sah: "${rawKunci}"` });
        continue;
      }
      if (k === "TRUE" || k === "BENAR") kunci = "true";
      else if (k === "FALSE" || k === "SALAH") kunci = "false";
      else kunci = k;
    } else if (tipe === "match") {
      let validMatch = false;
      const parsedKiri = [];
      const parsedKanan = [];

      if (rawKunci) {
        const pairs = rawKunci.split(";").map((s) => s.trim()).filter(Boolean);
        if (pairs.length > 0) {
          validMatch = true;
          for (const p of pairs) {
            const gtIdx = p.indexOf(">");
            if (gtIdx === -1) {
              validMatch = false;
              break;
            }
            const l = p.slice(0, gtIdx).trim();
            const r = p.slice(gtIdx + 1).trim();
            if (!l || !r) {
              validMatch = false;
              break;
            }
            parsedKiri.push(l);
            parsedKanan.push(r);
          }
        }
      } else if (rawKiri && rawKanan) {
        const sepL = rawKiri.includes(";") ? ";" : ",";
        const sepR = rawKanan.includes(";") ? ";" : ",";
        const lArr = rawKiri.split(sepL).map((s) => s.trim()).filter(Boolean);
        const rArr = rawKanan.split(sepR).map((s) => s.trim()).filter(Boolean);
        if (lArr.length > 0 && lArr.length === rArr.length) {
          parsedKiri.push(...lArr);
          parsedKanan.push(...rArr);
          validMatch = true;
        }
      }

      if (!validMatch) {
        errors.push({
          baris,
          pesan: "Kunci Match tidak sah (gunakan format kiri1>kanan1;kiri2>kanan2)"
        });
        continue;
      }
      kiri = parsedKiri;
      kanan = parsedKanan;
      kunci = parsedKiri.map((l, idx) => `${l}>${parsedKanan[idx]}`).join(";");
    } else if (tipe === "essay") {
      kunci = rawKunci;
    }

    items.push({
      id: `q${items.length + 1}`,
      kode,
      tipe,
      teks,
      bobot: 25,
      pilihan: { A: opsiA, B: opsiB, C: opsiC, D: opsiD },
      kunci,
      kiri,
      kanan
    });
    ringkasan[tipe]++;
  }

  return { items, errors, ringkasan };
}
