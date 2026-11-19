// Analisis Butir Soal & Tingkat Kesulitan untuk Koreksi Ujian
import { escAttr } from "../core/dom.js";
import { getQuestionType, isAutoCorrect } from "../core/scoring.js";

export function renderItemAnalysis(quizDoc, attempts, keys) {
  const container = document.getElementById("gr-item-analysis");
  if (!container) return;
  if (!attempts.length || !quizDoc?.questions?.length) {
    container.innerHTML = "";
    return;
  }

  const total = attempts.length;
  const analysis = quizDoc.questions.map((q, idx) => {
    const tipe = getQuestionType(q);
    if (tipe === "essay") {
      return {
        no: idx + 1,
        tipe: "ESSAY",
        teks: q.teks || "",
        correctCount: null,
        pct: null,
        level: "Koreksi Manual",
        badge: "badge-essay",
        isRemedial: false
      };
    }

    let correctCount = 0;
    attempts.forEach((att) => {
      if (isAutoCorrect(q, (att.answers || {})[q.id], keys[q.id])) correctCount++;
    });

    const pct = Math.round((correctCount / total) * 100);
    let level = "Sedang";
    let badge = "badge-pg";
    let isRemedial = false;

    if (pct >= 70) {
      level = "Mudah";
      badge = "badge-ok";
    } else if (pct < 30) {
      level = "Sukar / Remedial";
      badge = "badge-err";
      isRemedial = true;
    }

    return {
      no: idx + 1,
      tipe: tipe.toUpperCase(),
      teks: q.teks || "",
      correctCount,
      pct,
      level,
      badge,
      isRemedial
    };
  });

  const remedialItems = analysis.filter((a) => a.isRemedial);
  let remedialAlert = "";
  if (remedialItems.length > 0) {
    const listNos = remedialItems.map((r) => `No. ${r.no} (${r.pct}%)`).join(", ");
    remedialAlert = `
      <div style="padding:10px 14px; margin-bottom:14px; background:rgba(217,45,32,0.08); border-left:4px solid var(--err); border-radius:8px; font-size:12.5px; color:var(--ink)">
        <strong>⚠️ Peringatan Remedial:</strong> Butir soal <strong>${listNos}</strong> dijawab benar oleh &lt; 30% siswa. Disarankan mengadakan pendalaman materi pada butir ini.
      </div>
    `;
  }

  container.innerHTML = `
    <div style="background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:16px; margin-bottom:16px">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
        <div>
          <h3 style="font-size:14px; font-weight:600; color:var(--ink)">Analisis Butir Soal & Tingkat Kesulitan</h3>
          <p style="font-size:11.5px; color:var(--ink-2); margin-top:2px">Berdasarkan ${total} lembar jawaban siswa yang masuk</p>
        </div>
        <span class="badge badge-neutral">${quizDoc.questions.length} Butir Soal</span>
      </div>
      ${remedialAlert}
      <div style="overflow-x:auto">
        <table style="width:100%; border-collapse:collapse; font-size:12.5px; text-align:left">
          <thead>
            <tr style="border-bottom:1px solid var(--line); color:var(--ink-2)">
              <th style="padding:6px 8px">No</th>
              <th style="padding:6px 8px">Tipe</th>
              <th style="padding:6px 8px">Ringkasan Butir Soal</th>
              <th style="padding:6px 8px; text-align:center">Benar</th>
              <th style="padding:6px 8px; text-align:center">% Benar</th>
              <th style="padding:6px 8px; text-align:center">Tingkat Kesulitan</th>
            </tr>
          </thead>
          <tbody>
            ${analysis
              .map(
                (a) => `
              <tr style="border-bottom:1px solid var(--line-light, var(--line))">
                <td style="padding:8px; font-weight:600; color:var(--ink)">${a.no}</td>
                <td style="padding:8px"><span class="badge ${
                  a.tipe === "MATCH"
                    ? "badge-match"
                    : a.tipe === "BS"
                    ? "badge-bs"
                    : a.badge
                }">${a.tipe}</span></td>
                <td style="padding:8px; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ink)" title="${escAttr(
                  a.teks
                )}">
                  ${escAttr(a.teks)}
                </td>
                <td style="padding:8px; text-align:center; color:var(--ink)">${
                  a.pct !== null ? `${a.correctCount}/${total}` : "-"
                }</td>
                <td style="padding:8px; text-align:center; font-weight:600; color:var(--ink)">${
                  a.pct !== null ? `${a.pct}%` : "-"
                }</td>
                <td style="padding:8px; text-align:center"><span class="badge ${a.badge}">${
                  a.level
                }</span></td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
