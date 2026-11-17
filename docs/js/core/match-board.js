// Tap-to-Pair MATCH board — satu implementasi untuk ujian siswa & pratinjau admin.
import { escAttr } from "./dom.js";

// escAttr + JSON.stringify: aman di atribut HTML DAN di dalam string literal JS
// (apostrof seperti Jum'at tidak lagi memutus onclick).
const jsStr = (v) => escAttr(JSON.stringify(String(v)));

export function matchBoardHTML(q, { answers, selected, rightOptions, select, option, unpair }) {
  const curMap = answers[q.id] || {};
  const activeLeft = selected[q.id];
  const call = (fn, ...args) => `${fn}(${jsStr(q.id)}, ${args.map(jsStr).join(", ")})`;

  const leftCards = (q.kiri || [])
    .map((leftItem, lIdx) => {
      const paired = curMap[leftItem];
      const isSel = activeLeft === leftItem;
      return `
      <div class="match-card ${isSel ? "is-selected" : ""} ${paired ? "is-paired" : ""}" onclick="${call(select, leftItem)}">
        <div style="font-weight:600; color:var(--ink)"><span class="badge badge-match" style="margin-right:6px">A${lIdx + 1}</span>${escAttr(leftItem)}</div>
        ${
          paired
            ? `<div class="match-card-meta"><span style="color:var(--ok); font-weight:600">↳ ${escAttr(paired)}</span><button type="button" class="match-unpair-btn" title="Hapus" onclick="${unpair}(${jsStr(q.id)}, ${jsStr(leftItem)}, event)">✕</button></div>`
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
      <div class="match-card ${pairedPremise ? "is-paired" : ""}" onclick="${call(option, opt)}">
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
