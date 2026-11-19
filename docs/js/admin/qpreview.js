// Quiz Builder Live Preview Utility
import { escAttr } from "../core/dom.js";
import { showToast } from "../core/toast.js";
import { fnv1a, mulberry32, shuffle } from "../shared/quiz-utils.js";
import { getQuestionType, normalizeQuestion } from "../core/scoring.js";
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

  activePreviewQuestions = (questions || []).map((q, i) => normalizeQuestion(q, i));
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
      const tipe = getQuestionType(q);
      let qContent = "";
      if (tipe === "pg") {
        qContent = Object.entries(q.pilihan || {})
          .map(
            ([k, val]) => `
          <label class="opt-label">
            <input type="radio" name="prev_ans_${q.id}" value="${k}" ${
              previewAnswers[q.id] === k ? "checked" : ""
            } data-action="prev-ans-pg" data-qid="${escAttr(q.id)}" data-val="${k}">
            <span style="color:var(--ink)"><strong>${k}.</strong> ${escAttr(val)}</span>
          </label>`
          )
          .join("");
      } else if (tipe === "bs") {
        const cur = previewAnswers[q.id];
        qContent = `
          <div class="bs-group">
            <button type="button" class="bs-btn ${cur === "true" ? "active-benar" : ""}" data-action="prev-ans-bs" data-qid="${escAttr(q.id)}" data-val="true">✓ BENAR</button>
            <button type="button" class="bs-btn ${cur === "false" ? "active-salah" : ""}" data-action="prev-ans-bs" data-qid="${escAttr(q.id)}" data-val="false">✕ SALAH</button>
          </div>`;
      } else if (tipe === "match") {
        qContent = `<div id="prev_match_${q.id}">${generatePreviewMatchHTML(q)}</div>`;
      } else if (tipe === "essay") {
        const curText = previewAnswers[q.id] || "";
        qContent = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px">
            <span class="badge badge-essay">Dinilai Manual Guru</span>
            <span class="tabular-nums" style="font-size:12px; color:var(--ink-2)" id="prevchar_${q.id}">${curText.length} karakter terisi</span>
          </div>
          <textarea placeholder="Ketikkan uraian jawaban Anda di sini..." data-action="prev-ans-essay" data-qid="${escAttr(
            q.id
          )}">${escAttr(curText)}</textarea>`;
      }

      return `
        <div class="q-card" data-qtype="${tipe}" style="background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:16px; margin-bottom:14px">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
            <span class="badge ${
              tipe === "match"
                ? "badge-match"
                : tipe === "bs"
                ? "badge-bs"
                : tipe === "essay"
                ? "badge-essay"
                : "badge-pg"
            }">Soal ${idx + 1} · ${tipe.toUpperCase()}</span>
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
    rightOptions: q._shuffledRight || (q._shuffledRight = shuffle(q.kanan || [], rnd))
  });
}

function renderPreviewMatch(qid) {
  const wrap = document.getElementById("prev_match_" + qid);
  const q = activePreviewQuestions.find((x) => x.id === qid);
  if (wrap && q) wrap.innerHTML = generatePreviewMatchHTML(q);
}

export function initQPreview() {
  const modal = document.getElementById("modal-preview-q");
  if (!modal) return;

  modal.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === "close-preview-modal") {
      closePreviewModal();
    } else if (action === "toggle-preview-viewport") {
      togglePreviewViewport();
    } else if (action === "prev-ans-bs") {
      const qid = btn.dataset.qid;
      previewAnswers[qid] = btn.dataset.val;
      renderPreviewContent();
      applyViewport();
    } else if (action === "match-select-premise") {
      const qid = btn.dataset.qid;
      const premise = btn.dataset.premise;
      previewSelectedPremise[qid] =
        previewSelectedPremise[qid] === premise ? null : premise;
      renderPreviewMatch(qid);
    } else if (action === "match-select-option") {
      const qid = btn.dataset.qid;
      const opt = btn.dataset.opt;
      const selP = previewSelectedPremise[qid];
      if (!selP) return;
      if (!previewAnswers[qid]) previewAnswers[qid] = {};
      Object.keys(previewAnswers[qid]).forEach((p) => {
        if (previewAnswers[qid][p] === opt) delete previewAnswers[qid][p];
      });
      previewAnswers[qid][selP] = opt;
      previewSelectedPremise[qid] = null;
      renderPreviewMatch(qid);
    } else if (action === "match-unpair") {
      e.stopPropagation();
      const qid = btn.dataset.qid;
      const premise = btn.dataset.premise;
      if (previewAnswers[qid]) delete previewAnswers[qid][premise];
      renderPreviewMatch(qid);
    }
  });

  modal.addEventListener("change", (e) => {
    const target = e.target;
    if (target.dataset.action === "prev-ans-pg") {
      previewAnswers[target.dataset.qid] = target.value;
    }
  });

  modal.addEventListener("input", (e) => {
    const target = e.target;
    if (target.dataset.action === "prev-ans-essay") {
      const qid = target.dataset.qid;
      previewAnswers[qid] = target.value;
      const c = document.getElementById("prevchar_" + qid);
      if (c) c.textContent = target.value.length + " karakter terisi";
    }
  });
}
