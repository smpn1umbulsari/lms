// Quiz Builder Live Preview Utility
import { escAttr } from "../core/dom.js";
import { showToast } from "../core/toast.js";
import { fnv1a, mulberry32, shuffle } from "../shared/quiz-utils.js";
import { matchBoardHTML } from "../core/match-board.js";

let isPhoneViewport = false;
let previewAnswers = {};
let previewSelectedPremise = {};
let activePreviewQuestions = [];

export function openPreviewModal(questions, metadata = {}) {
  if (!questions || !questions.length) {
    showToast("Tambahkan minimal 1 butir soal sebelum melihat pratinjau!", "warn");
    return;
  }

  activePreviewQuestions = questions;
  previewAnswers = {};
  previewSelectedPremise = {};
  isPhoneViewport = false;

  renderPreviewContent(metadata);
  applyViewport();
  document.getElementById("modal-preview-q")?.classList.remove("hidden");
}

export function closePreviewModal() {
  const modal = document.getElementById("modal-preview-q");
  modal?.classList.add("hidden");
}

export function togglePreviewViewport() {
  isPhoneViewport = !isPhoneViewport;
  applyViewport();
}

// Dialog menyempit, viewport tidak → media query CSS tidak ikut. Set manual.
function applyViewport() {
  const dialog = document.getElementById("preview-dialog-box");
  if (dialog) dialog.style.maxWidth = isPhoneViewport ? "375px" : "820px";
  const lbl = document.getElementById("preview-mode-lbl");
  if (lbl) lbl.textContent = isPhoneViewport ? "Mode HP (375px)" : "Mode Laptop / Penuh";
}

function renderPreviewContent(meta = {}) {
  const body = document.getElementById("modal-preview-body");
  if (!body) return;

  const judul =
    meta.judul || document.getElementById("as-judul")?.value.trim() || "Pratinjau Asesmen";
  const durasi = meta.durasi || document.getElementById("as-durasi")?.value || "60";
  const kelas =
    meta.kelas || document.querySelector("input#as-kelas")?.value || "Semua";

  const cardsHtml = activePreviewQuestions
    .map((q, idx) => {
      let qContent = "";
      if (q.tipe === "pg") {
        qContent = Object.entries(q.pilihan || {})
          .map(
            ([k, val]) => `
          <label class="opt-label">
            <input type="radio" name="prev_ans_${q.id}" value="${k}" ${
              previewAnswers[q.id] === k ? "checked" : ""
            } onchange="window._onPrevAns('${q.id}', '${k}')">
            <span style="color:var(--ink)"><strong>${k}.</strong> ${escAttr(val)}</span>
          </label>`
          )
          .join("");
      } else if (q.tipe === "bs") {
        const cur = previewAnswers[q.id];
        qContent = `
          <div class="bs-group">
            <button type="button" class="bs-btn ${cur === "true" ? "active-benar" : ""}" onclick="window._onPrevAns('${q.id}', 'true')">✓ BENAR</button>
            <button type="button" class="bs-btn ${cur === "false" ? "active-salah" : ""}" onclick="window._onPrevAns('${q.id}', 'false')">✕ SALAH</button>
          </div>`;
      } else if (q.tipe === "match") {
        qContent = `<div id="prev_match_${q.id}">${generatePreviewMatchHTML(q)}</div>`;
      } else if (q.tipe === "essay") {
        const curText = previewAnswers[q.id] || "";
        qContent = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px">
            <span class="badge badge-essay">Dinilai Manual Guru</span>
            <span class="tabular-nums" style="font-size:12px; color:var(--ink-2)" id="prevchar_${q.id}">${curText.length} karakter terisi</span>
          </div>
          <textarea placeholder="Ketikkan uraian jawaban Anda di sini..." oninput="window._onPrevAns('${
            q.id
          }', this.value); const c=document.getElementById('prevchar_${
            q.id
          }'); if(c) c.textContent=this.value.length+' karakter terisi';">${escAttr(curText)}</textarea>`;
      }

      return `
        <div class="q-card" data-qtype="${q.tipe}" style="background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:16px; margin-bottom:14px">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
            <span class="badge ${
              q.tipe === "match"
                ? "badge-match"
                : q.tipe === "bs"
                ? "badge-bs"
                : q.tipe === "essay"
                ? "badge-essay"
                : "badge-pg"
            }">Soal ${idx + 1} · ${q.tipe.toUpperCase()}</span>
            <span style="font-size:12px; color:var(--ink-3)">Bobot: ${
              q.bobot || 25
            } Poin</span>
          </div>
          <div style="font-weight:500; font-size:14px; color:var(--ink); margin-bottom:12px">${escAttr(
            q.teks || ""
          )}</div>
          ${qContent}
        </div>`;
    })
    .join("");

  body.innerHTML = `
    <div style="background:var(--surface-high); border:1px solid var(--line); border-radius:10px; padding:12px 16px; margin-bottom:16px">
      <div style="font-size:11.5px; color:var(--ink-3); text-transform:uppercase; font-weight:600">Simulasi Antarmuka Siswa</div>
      <h3 style="font-size:15px; font-weight:600; color:var(--ink); margin:4px 0">${escAttr(
        judul
      )}</h3>
      <div style="display:flex; gap:16px; font-size:12px; color:var(--ink-2); flex-wrap:wrap">
        <span>⏱ Durasi: <strong>${durasi} Menit</strong></span>
        <span>🏫 Kelas: <strong>${escAttr(kelas)}</strong></span>
        <span>📝 Total: <strong>${activePreviewQuestions.length} Butir Soal</strong></span>
      </div>
    </div>
    <div id="prev-q-list">
      ${cardsHtml}
    </div>
  `;
}

function generatePreviewMatchHTML(q) {
  const rnd = mulberry32(fnv1a(q.id));
  return matchBoardHTML(q, {
    answers: previewAnswers,
    selected: previewSelectedPremise,
    rightOptions: q._shuffledRight || (q._shuffledRight = shuffle(q.kanan || [], rnd)),
    select: "window._onPrevSelectPremise",
    option: "window._onPrevSelectOption",
    unpair: "window._onPrevUnpair",
  });
}

export function initQPreview() {
  window._closePreviewModal = closePreviewModal;
  window._togglePreviewViewport = togglePreviewViewport;

  window._onPrevAns = (qid, val) => {
    previewAnswers[qid] = val;
    const q = activePreviewQuestions.find((x) => x.id === qid);
    if (q && q.tipe === "bs") {
      renderPreviewContent();
      applyViewport();
    }
  };

  window._onPrevSelectPremise = (qid, premise) => {
    previewSelectedPremise[qid] =
      previewSelectedPremise[qid] === premise ? null : premise;
    const wrap = document.getElementById("prev_match_" + qid);
    const q = activePreviewQuestions.find((x) => x.id === qid);
    if (wrap && q) wrap.innerHTML = generatePreviewMatchHTML(q);
  };

  window._onPrevSelectOption = (qid, opt) => {
    const selP = previewSelectedPremise[qid];
    if (!selP) return;
    if (!previewAnswers[qid]) previewAnswers[qid] = {};
    Object.keys(previewAnswers[qid]).forEach((p) => {
      if (previewAnswers[qid][p] === opt) delete previewAnswers[qid][p];
    });
    previewAnswers[qid][selP] = opt;
    previewSelectedPremise[qid] = null;
    const wrap = document.getElementById("prev_match_" + qid);
    const q = activePreviewQuestions.find((x) => x.id === qid);
    if (wrap && q) wrap.innerHTML = generatePreviewMatchHTML(q);
  };

  window._onPrevUnpair = (qid, premise, ev) => {
    ev.stopPropagation();
    if (previewAnswers[qid]) delete previewAnswers[qid][premise];
    const wrap = document.getElementById("prev_match_" + qid);
    const q = activePreviewQuestions.find((x) => x.id === qid);
    if (wrap && q) wrap.innerHTML = generatePreviewMatchHTML(q);
  };
}
