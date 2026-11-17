// Skor latihan berbobot. Essay tidak dihitung otomatis (dinilai manual guru);
// bobot kosong/0 memakai default 25 poin — sama dengan yang ditampilkan builder.
export const BOBOT_DEFAULT = 25;

export function hitungSkor(questions, answers) {
  let dapat = 0;
  let total = 0;
  let benar = 0;
  let auto = 0;

  (questions || []).forEach((q) => {
    if (!q || q.tipe === "essay") return;
    const bobot = Number(q.bobot) > 0 ? Number(q.bobot) : BOBOT_DEFAULT;
    total += bobot;
    auto++;

    const a = answers ? answers[q.id] : undefined;
    let ok = false;
    if (q.tipe === "pg" || q.tipe === "bs") ok = a === q.kunci;
    else if (q.tipe === "match" && q.kunci && Object.keys(q.kunci).length) {
      const map = a || {};
      ok = Object.keys(q.kunci).every((k) => q.kunci[k] === map[k]);
    }
    if (ok) {
      benar++;
      dapat += bobot;
    }
  });

  return { dapat, total, benar, auto, pct: total ? Math.round((dapat / total) * 100) : 0 };
}
