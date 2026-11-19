// Konversi dokumen kuis Firestore -> baris spreadsheet terformat (mendukung MATCH multi-baris & merge)
import { getQuestionType } from "../../core/scoring.js";

export const HEADER_SOAL = [
  "No", "Kode", "Tipe", "Teks", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Kunci", "Kiri", "Kanan", "Bobot"
];

export const SOAL_COL_WIDTHS = [6, 13, 9, 44, 16, 16, 16, 16, 22, 22, 28, 8];
export const SOAL_CENTER_COLS = [0, 2, 8, 11];
export const SOAL_TEXT_COLS = [1];

/**
 * @param {Array<{id:string,data:object}>} quizzes
 * @param {Object<string,object>} keysByQuiz  quizKeys/{id}.keys (mode ujian)
 */
export function buildSoalSheetData(quizzes, keysByQuiz = {}) {
  const aoa = [HEADER_SOAL];
  const merges = [];
  const rowGroups = [];
  let qNo = 0;

  for (const { id: kode, data: qz } of quizzes) {
    const qKeys = keysByQuiz[kode] || {};
    for (const q of qz.questions || []) {
      qNo++;
      const groupId = qNo - 1;
      const tipe = getQuestionType(q);
      let kunci = q.kunci !== undefined ? q.kunci : qKeys[q.id] ?? "";
      let kiri = Array.isArray(q.kiri) ? q.kiri.filter(Boolean) : [];
      let kanan = Array.isArray(q.kanan) ? q.kanan.filter(Boolean) : [];

      if (tipe === "match") {
        if (kunci && typeof kunci === "object" && !Array.isArray(kunci)) {
          kiri = Object.keys(kunci);
          kanan = Object.values(kunci);
        } else if (typeof kunci === "string" && kunci.includes(">") && !kiri.length) {
          for (const p of kunci.split(";").map((s) => s.trim()).filter(Boolean)) {
            const idx = p.indexOf(">");
            if (idx > 0) {
              kiri.push(p.slice(0, idx).trim());
              kanan.push(p.slice(idx + 1).trim());
            }
          }
        }

        const pairCount = Math.max(1, kiri.length, kanan.length);
        const startRow = aoa.length;
        for (let p = 0; p < pairCount; p++) {
          aoa.push(
            p === 0
              ? [
                  qNo,
                  String(kode),
                  "match",
                  String(q.teks || ""),
                  "",
                  "",
                  "",
                  "",
                  "",
                  String(kiri[p] || ""),
                  String(kanan[p] || ""),
                  q.bobot ?? 25
                ]
              : ["", "", "", "", "", "", "", "", "", String(kiri[p] || ""), String(kanan[p] || ""), ""]
          );
          rowGroups.push(groupId);
        }
        if (pairCount > 1) {
          const endRow = startRow + pairCount - 1;
          for (const colIdx of [0, 1, 2, 3, 4, 5, 6, 7, 8, 11]) {
            merges.push({ s: { r: startRow, c: colIdx }, e: { r: endRow, c: colIdx } });
          }
        }
        continue;
      }

      aoa.push([
        qNo,
        String(kode),
        String(tipe),
        String(q.teks || ""),
        String(q.pilihan?.A || ""),
        String(q.pilihan?.B || ""),
        String(q.pilihan?.C || ""),
        String(q.pilihan?.D || ""),
        String(kunci ?? ""),
        "",
        "",
        q.bobot ?? 25
      ]);
      rowGroups.push(groupId);
    }
  }
  return { aoa, merges, rowGroups, questionCount: qNo };
}

export function buildSoalRows(quizzes, keysByQuiz = {}) {
  return buildSoalSheetData(quizzes, keysByQuiz).aoa;
}
