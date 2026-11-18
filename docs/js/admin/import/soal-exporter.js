// Konversi dokumen kuis Firestore -> baris spreadsheet (pure, round-trip dengan soal-importer)

export const HEADER_SOAL = [
  "Kode", "Tipe", "Teks", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Kunci", "Kiri", "Kanan", "Bobot"
];

/**
 * @param {Array<{id:string,data:object}>} quizzes
 * @param {Object<string,object>} keysByQuiz  quizKeys/{id}.keys (mode ujian)
 */
export function buildSoalRows(quizzes, keysByQuiz = {}) {
  const aoa = [HEADER_SOAL];
  for (const { id: kode, data: qz } of quizzes) {
    const qKeys = keysByQuiz[kode] || {};
    for (const q of qz.questions || []) {
      const tipe = q.tipe || "pg";
      let kunci = q.kunci !== undefined ? q.kunci : qKeys[q.id] ?? "";
      let kiri = Array.isArray(q.kiri) ? q.kiri.filter(Boolean) : [];
      let kanan = Array.isArray(q.kanan) ? q.kanan.filter(Boolean) : [];

      if (tipe === "match") {
        if (kunci && typeof kunci === "object" && !Array.isArray(kunci)) {
          kiri = Object.keys(kunci);
          kanan = Object.values(kunci);
        }
        kunci = kiri.map((l, i) => `${l}>${kanan[i] || ""}`).join(";");
      }

      aoa.push([
        String(kode),
        String(tipe),
        String(q.teks || ""),
        String(q.pilihan?.A || ""),
        String(q.pilihan?.B || ""),
        String(q.pilihan?.C || ""),
        String(q.pilihan?.D || ""),
        String(kunci ?? ""),
        kiri.join("; "),
        kanan.join("; "),
        q.bobot ?? ""
      ]);
    }
  }
  return aoa;
}
