// Mesin skor tunggal (latihan + koreksi resmi berbobot & ternormalisasi 0-100).
// Bobot kosong/0 memakai default 25 poin — konsisten dengan builder soal.
export const BOBOT_DEFAULT = 25;

export function getBobot(q) {
  const n = Number(q?.bobot);
  return Number.isFinite(n) && n > 0 ? n : BOBOT_DEFAULT;
}

export function getQuestionType(q) {
  const raw = typeof q?.tipe === "string" ? q.tipe.trim().toLowerCase() : "";
  if (raw === "pg" || raw === "bs" || raw === "match" || raw === "essay") return raw;
  if (Array.isArray(q?.kiri) && q.kiri.length) return "match";
  if (q?.pilihan && typeof q.pilihan === "object" && Object.keys(q.pilihan).length) return "pg";
  if (typeof q?.kunci === "boolean" || q?.kunci === "true" || q?.kunci === "false") return "bs";
  return raw || "pg";
}

export function normalizeQuestion(q, idx = 0) {
  const tipe = getQuestionType(q);
  const out = {
    ...(q && typeof q === "object" ? q : {}),
    id: q?.id || `q${idx + 1}`,
    tipe,
    teks: q?.teks || "",
    bobot: getBobot(q)
  };
  if (tipe === "pg") {
    out.pilihan = { A: "", B: "", C: "", D: "", ...(q?.pilihan || {}) };
    if (q?.kunci !== undefined && q?.kunci !== null) out.kunci = String(q.kunci).toUpperCase();
  } else if (tipe === "bs") {
    if (q?.kunci !== undefined && q?.kunci !== null) {
      out.kunci = q.kunci === false || String(q.kunci).toLowerCase() === "false" ? "false" : "true";
    }
  } else if (tipe === "match") {
    out.kiri = Array.isArray(q?.kiri) ? q.kiri : [];
    out.kanan = Array.isArray(q?.kanan) ? q.kanan : [];
  }
  return out;
}

export function isAutoCorrect(q, studentAns, keyVal) {
  const tipe = getQuestionType(q);
  if (!q || tipe === "essay") return false;
  if (tipe === "pg") {
    return keyVal !== undefined && keyVal !== null && keyVal !== "" && studentAns === keyVal;
  }
  if (tipe === "bs") {
    if (keyVal === undefined || keyVal === null || keyVal === "") return false;
    return String(studentAns).toLowerCase() === String(keyVal).toLowerCase();
  }
  if (tipe === "match" && keyVal && typeof keyVal === "object") {
    const keys = Object.keys(keyVal);
    if (!keys.length) return false;
    const map = studentAns && typeof studentAns === "object" ? studentAns : {};
    return keys.every((k) => keyVal[k] === map[k]);
  }
  return false;
}

/** Hitung skor otomatis (PG/BS/Match) untuk mode latihan atau pratinjau cepat. */
export function hitungSkor(questions, answers, keysMap = null) {
  let dapat = 0;
  let total = 0;
  let benar = 0;
  let auto = 0;

  (questions || []).forEach((q) => {
    if (!q || getQuestionType(q) === "essay") return;
    const bobot = getBobot(q);
    total += bobot;
    auto++;

    const keyVal = keysMap ? keysMap[q.id] : q.kunci;
    if (isAutoCorrect(q, answers ? answers[q.id] : undefined, keyVal)) {
      benar++;
      dapat += bobot;
    }
  });

  return { dapat, total, benar, auto, pct: total ? Math.round((dapat / total) * 100) : 0 };
}

/**
 * Penilaian menyeluruh (otomatis + essay manual) menghasilkan poin mentah dan skala 0-100 (`pct`).
 */
export function gradeAttempt(questions, answers, keysMap = null, essayScores = {}) {
  let autoPoints = 0;
  let autoMax = 0;
  let essayPoints = 0;
  let essayMax = 0;
  let benar = 0;
  let autoCount = 0;
  let essayCount = 0;
  const missingEssays = [];
  const perQuestion = {};

  (questions || []).forEach((q) => {
    if (!q) return;
    const tipe = getQuestionType(q);
    const bobot = getBobot(q);
    const keyVal = keysMap ? keysMap[q.id] : q.kunci;
    const ans = answers ? answers[q.id] : undefined;

    if (tipe === "essay") {
      essayCount++;
      essayMax += bobot;
      const raw = essayScores ? essayScores[q.id] : undefined;
      const hasVal = raw !== "" && raw !== null && raw !== undefined && Number.isFinite(Number(raw));
      const pts = hasVal ? Math.min(bobot, Math.max(0, Number(raw))) : 0;
      if (!hasVal) missingEssays.push(q.id);
      essayPoints += pts;
      perQuestion[q.id] = { bobot, earned: pts, max: bobot, isEssay: true, missing: !hasVal, isCorrect: null };
      return;
    }

    autoCount++;
    autoMax += bobot;
    const ok = isAutoCorrect(q, ans, keyVal);
    const pts = ok ? bobot : 0;
    if (ok) benar++;
    autoPoints += pts;
    perQuestion[q.id] = { bobot, earned: pts, max: bobot, isEssay: false, missing: false, isCorrect: ok };
  });

  const totalPoints = autoPoints + essayPoints;
  const maxScore = autoMax + essayMax;
  const pct = maxScore > 0 ? Math.round((totalPoints / maxScore) * 100) : 0;

  return {
    autoPoints,
    autoMax,
    essayPoints,
    essayMax,
    totalPoints,
    maxScore,
    pct,
    benar,
    autoCount,
    essayCount,
    missingEssays,
    perQuestion
  };
}
