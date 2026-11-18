// Pembangun baris Rekap Nilai (pure, tanpa Firebase/DOM)

export function scoreOf(r) {
  if (!r) return undefined;
  for (const k of ["totalScore", "score", "nilai", "total"]) {
    if (r[k] !== undefined && r[k] !== null && r[k] !== "") return Number(r[k]);
  }
  return undefined;
}

const avg = (vals) => (vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : "");

/**
 * @param students    [{ uid, nis, nama, kelas }]
 * @param assignments [{ id, judul }]
 * @param quizzes     [{ id, judul }]
 * @param subMap      { uid: { assignmentId: nilai } }
 * @param resMap      { uid: { quizId: nilai } }
 * @param bobot       { tugas, ujian } (default 40/60)
 */
export function buildRekapRows({ students, assignments, quizzes, subMap, resMap, bobot = { tugas: 0.4, ujian: 0.6 } }) {
  const header = [
    "NIS", "Nama Siswa", "Kelas",
    ...assignments.map((a) => a.judul || a.id), "Rata-rata Tugas",
    ...quizzes.map((q) => q.judul || q.id), "Rata-rata Ujian",
    `Nilai Akhir (${Math.round(bobot.tugas * 100)}% Tugas + ${Math.round(bobot.ujian * 100)}% Ujian)`
  ];

  const sorted = [...students].sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));
  const rows = sorted.map((s) => {
    const sub = subMap[s.uid] || {};
    const res = resMap[s.uid] || {};
    const tVals = assignments.map((a) => sub[a.id]);
    const qVals = quizzes.map((q) => res[q.id]);
    const aT = avg(tVals.filter((v) => v !== undefined));
    const aU = avg(qVals.filter((v) => v !== undefined));
    let akhir = "";
    if (aT !== "" && aU !== "") akhir = Math.round(aT * bobot.tugas + aU * bobot.ujian);
    else if (aT !== "") akhir = aT;
    else if (aU !== "") akhir = aU;
    return [s.nis || "", s.nama, s.kelas, ...tVals.map((v) => v ?? ""), aT, ...qVals.map((v) => v ?? ""), aU, akhir];
  });
  return [header, ...rows];
}
