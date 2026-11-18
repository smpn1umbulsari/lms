// Tap-to-Pair MATCH board — satu implementasi untuk ujian siswa & pratinjau admin.
import { escAttr } from "./dom.js";

export function matchBoardHTML(q, { answers, selected, rightOptions }) {
  const curMap = answers[q.id] || {};
  const activeLeft = selected[q.id];

  const leftCards = (q.kiri || [])
    .map((leftItem, lIdx) => {
      const paired = curMap[leftItem];
      const isSel = activeLeft === leftItem;
      return `
      <div class="match-card ${isSel ? "is-selected" : ""} ${paired ? "is-paired" : ""}" data-action="match-select-premise" data-qid="${escAttr(q.id)}" data-premise="${escAttr(leftItem)}">
        <div style="font-weight:600; color:var(--ink)"><span class="badge badge-match" style="margin-right:6px">A${lIdx + 1}</span>${escAttr(leftItem)}</div>
        ${
          paired
            ? `<div class="match-card-meta"><span style="color:var(--ok); font-weight:600">↳ ${escAttr(paired)}</span><button type="button" class="match-unpair-btn" title="Hapus" data-action="match-unpair" data-qid="${escAttr(q.id)}" data-premise="${escAttr(leftItem)}">✕</button></div>`
            : isSel
            ? `<div class="match-card-meta" style="color:var(--accent)">Pilih respon di Kolom B...</div>`
            : ""
        }
      </div>`;
    })
    .join("");

  const rightCards = (rightOptions || [])
    .map((opt, rIdx) => {
      const pairedPremise = Object.keys(curMap).find((k) => curMap[k] === opt);
      return `
      <div class="match-card ${pairedPremise ? "is-paired" : ""}" data-action="match-select-option" data-qid="${escAttr(q.id)}" data-opt="${escAttr(opt)}">
        <div style="font-weight:500; color:var(--ink)"><span class="badge badge-neutral" style="margin-right:6px">B${rIdx + 1}</span>${escAttr(opt)}</div>
        ${pairedPremise ? `<div class="match-card-meta"><span style="color:var(--ok); font-weight:600">✓ Pasangan (${escAttr(pairedPremise)})</span></div>` : ""}
      </div>`;
    })
    .join("");

  return `
    <div style="margin-bottom:6px; font-size:12px; color:var(--ink-2)">Ketuk kartu di <strong>Kolom A</strong>, lalu ketuk jawaban pasangannya di <strong>Kolom B</strong>:</div>
    <div class="match-board">
      <div><div class="match-col-title">Kolom A (Premis)</div>${leftCards}</div>
      <div><div class="match-col-title">Kolom B (Pilihan)</div>${rightCards}</div>
    </div>`;
}
