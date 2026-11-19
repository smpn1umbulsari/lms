// Renderer Kartu Koreksi Siswa & Input Nilai Essay
import { escAttr } from "../core/dom.js";
import { getBobot, gradeAttempt } from "../core/scoring.js";

export function profileOf(uid, userMap) {
  return (
    userMap.get(uid) || {
      uid,
      nis: "-",
      nama: `Akun ${String(uid).slice(0, 6)}`,
      kelas: "-"
    }
  );
}

function formatTs(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function renderEssayInputRow(att, q, studentAns, prevRes, draftScores, draftNotes) {
  const bobot = getBobot(q);
  const keyDraft = `${att.id}__${q.id}`;
  const rawScore =
    keyDraft in draftScores
      ? draftScores[keyDraft]
      : prevRes?.essayScores?.[q.id] ?? "";
  const rawNote =
    keyDraft in draftNotes
      ? draftNotes[keyDraft]
      : prevRes?.essayNotes?.[q.id] ?? "";

  return `
    <div style="margin-top:12px; padding:14px; background:var(--paper); border:1px solid var(--line); border-left:3px solid var(--badge-essay); border-radius:10px">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; gap:8px; flex-wrap:wrap">
        <span class="badge badge-essay">URAIAN (MANUAL)</span>
        <span class="tabular-nums" style="font-size:11.5px; color:var(--ink-3)">Maks. ${bobot} Poin</span>
      </div>
      <div style="font-weight:500; color:var(--ink); margin-bottom:6px">${escAttr(q.teks)}</div>
      <div style="padding:10px; background:var(--surface); border:1px solid var(--line); border-radius:8px; color:var(--ink); margin-bottom:10px; white-space:pre-wrap">
        <span style="font-size:11.5px; color:var(--ink-3); display:block; margin-bottom:2px">Jawaban Siswa:</span>
        ${escAttr(studentAns) || "<em>Tidak dijawab</em>"}
      </div>
      <div class="row" style="align-items:center">
        <div style="max-width:160px">
          <label for="essay_${escAttr(att.id)}_${escAttr(q.id)}">Nilai Uraian (0 – ${bobot})</label>
          <input type="number" class="gr-essay-input" id="essay_${escAttr(att.id)}_${escAttr(q.id)}"
            data-att-id="${escAttr(att.id)}" data-qid="${escAttr(q.id)}"
            value="${escAttr(rawScore)}" min="0" max="${bobot}" step="1" placeholder="Kosong (0–${bobot})" style="margin-bottom:0">
        </div>
        <div>
          <label for="note_${escAttr(att.id)}_${escAttr(q.id)}">Catatan Guru (Opsional)</label>
          <input type="text" class="gr-note-input" id="note_${escAttr(att.id)}_${escAttr(q.id)}"
            data-att-id="${escAttr(att.id)}" data-qid="${escAttr(q.id)}"
            value="${escAttr(rawNote)}" placeholder="Masukkan masukan untuk siswa..." style="margin-bottom:0">
        </div>
      </div>
    </div>
  `;
}

export function renderStudentCard(att, idx, ctx) {
  const { quizDoc, keys, userMap, resultMap, draftScores, draftNotes, dirtyIds } = ctx;
  const prof = profileOf(att.uid, userMap);
  const prevRes = resultMap.get(att.id) || null;
  const questions = quizDoc?.questions || [];
  const essayQuestions = questions.filter((q) => q.tipe === "essay");

  const essayScoresMap = {};
  essayQuestions.forEach((q) => {
    const keyDraft = `${att.id}__${q.id}`;
    essayScoresMap[q.id] =
      keyDraft in draftScores ? draftScores[keyDraft] : prevRes?.essayScores?.[q.id] ?? "";
  });

  const graded = gradeAttempt(questions, att.answers || {}, keys, essayScoresMap);
  const subTime = formatTs(att.submittedAt);
  const subBadge = att.submittedAt
    ? `<span class="badge badge-ok">Dikirim ${escAttr(subTime)}</span>`
    : `<span class="badge badge-warn">Belum Dikirim</span>`;
  const revBadge = prevRes
    ? `<span class="badge badge-neutral">Tersimpan · Revisi #${prevRes.revisionNo || 1}</span>`
    : "";
  const dirtyBadge = dirtyIds.has(att.id)
    ? `<span class="badge badge-warn" data-dirty-for="${escAttr(att.id)}">Belum Dipublikasi</span>`
    : "";

  const essayHtml = essayQuestions
    .map((q) => renderEssayInputRow(att, q, (att.answers || {})[q.id], prevRes, draftScores, draftNotes))
    .join("");

  return `
    <div class="q-card" data-qtype="pg" data-att-card="${escAttr(att.id)}" style="margin-bottom:14px">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px">
        <div style="display:flex; align-items:center; gap:10px">
          <div class="avatar-circle" style="background:var(--surface-high); color:var(--ink)">${String(idx + 1).padStart(2, "0")}</div>
          <div>
            <h3 style="font-size:14.5px; font-weight:600; color:var(--ink)">
              ${escAttr(prof.nama)}
              <span class="badge badge-neutral" style="margin-left:4px">${escAttr(prof.kelas)}</span>
            </h3>
            <span class="tabular-nums" style="font-size:12px; color:var(--ink-2)">
              NIS: <code>${escAttr(prof.nis)}</code> · Percobaan ke-${att.attemptNo || 1}
            </span>
            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px">${subBadge} ${revBadge} ${dirtyBadge}</div>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px">
          <span class="badge badge-pg tabular-nums" id="live_score_${escAttr(att.id)}">
            Nilai: ${graded.pct}/100 (${graded.totalPoints}/${graded.maxScore} poin)
          </span>
          <span class="tabular-nums" style="font-size:11.5px; color:var(--ink-3)">
            Otomatis: ${graded.autoPoints}/${graded.autoMax} poin (${graded.benar}/${graded.autoCount} benar)
          </span>
        </div>
      </div>
      ${essayHtml}
    </div>
  `;
}
