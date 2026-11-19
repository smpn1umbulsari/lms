// Deterministic PRNG: FNV-1a hash + Mulberry32 generator
export function fnv1a(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function tsToMs(v) {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.toDate === "function") return v.toDate().getTime();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Hitung status jujur jendela asesmen siswa berdasarkan jadwal & riwayat pengerjaan.
 */
export function getQuizStatus(quizMeta, nowMs = Date.now(), ctx = {}) {
  const openMs = tsToMs(quizMeta?.openAt);
  const closeMs = tsToMs(quizMeta?.closeAt);
  const tolMin = Number(quizMeta?.toleransiMulai ?? 120);
  const maxAttempts = Math.min(3, Math.max(1, Number(quizMeta?.maxAttempts || 1)));
  const attemptsDone = Number(ctx.submittedCount || (ctx.submitted ? 1 : 0));
  const hasUnsubmittedStart = !!(ctx.started && !ctx.submitted);
  const graded = !!ctx.graded;
  const deadlineMs = Number(ctx.deadlineMs || 0);

  if (hasUnsubmittedStart) {
    const expired = (closeMs && nowMs > closeMs) || (deadlineMs && nowMs > deadlineMs);
    if (!expired) {
      return { code: "lanjutkan", label: "Sedang Dikerjakan", badgeClass: "badge-match", canStart: true, buttonLabel: "Lanjutkan Ujian" };
    }
    return { code: "ditutup", label: "Waktu Habis", badgeClass: "badge-danger", canStart: false, buttonLabel: "Waktu Habis" };
  }

  const canRetake = attemptsDone > 0 && attemptsDone < maxAttempts && (!closeMs || nowMs <= closeMs) && (!openMs || nowMs >= openMs);
  if (attemptsDone > 0 && !canRetake) {
    return graded
      ? { code: "dinilai", label: "Sudah Dinilai", badgeClass: "badge-ok", canStart: false, buttonLabel: "Sudah Dinilai" }
      : { code: "terkirim", label: "Sudah Dikirim", badgeClass: "badge-ok", canStart: false, buttonLabel: "Sudah Dikirim" };
  }

  if (openMs && nowMs < openMs) {
    return { code: "belum_dibuka", label: "Belum Dibuka", badgeClass: "badge-neutral", canStart: false, buttonLabel: "Belum Dibuka" };
  }
  if (closeMs && nowMs > closeMs) {
    return { code: "ditutup", label: "Sudah Ditutup", badgeClass: "badge-danger", canStart: false, buttonLabel: "Ditutup" };
  }
  if (openMs && tolMin >= 0 && nowMs > openMs + tolMin * 60000) {
    return { code: "terlambat", label: "Batas Masuk Lewat", badgeClass: "badge-danger", canStart: false, buttonLabel: "Terlambat" };
  }
  return {
    code: canRetake ? "remedial" : "terbuka",
    label: canRetake ? `Remedial (${attemptsDone}/${maxAttempts})` : "Sedang Dibuka",
    badgeClass: canRetake ? "badge-match" : "badge-ok",
    canStart: true,
    buttonLabel: canRetake ? "Kerjakan Remedial" : "Mulai Kerjakan"
  };
}
