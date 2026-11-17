// Quiz Builder Live Preview Utility
import { escAttr } from "../core/dom.js";
import { showToast } from "../core/toast.js";

let isPhoneViewport = false;
let previewAnswers = {};
let previewSelectedPremise = {};
let activePreviewQuestions = [];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function openPreviewModal(questions, metadata = {}) {
  if (!questions || !questions.length) {
    showToast("Tambahkan minimal 1 butir soal sebelum melihat pratinjau!", "warn");
    return;
  }

  activePreviewQuestions = questions;
  previewAnswers = {};
  previewSelectedPremise = {};
  isPhoneViewport = false;

  const modal = document.getElementById("modal-preview-q");
  const dialog = document.getElementById("preview-dialog-box");
  const modeLbl = document.getElementById("preview-mode-lbl");

  if (dialog) dialog.style.maxWidth = "820px";
  if (modeLbl) modeLbl.textContent = "Mode HP (375px)";

  renderPreviewContent(metadata);
  modal?.classList.remove("hidden");
}

export function closePreviewModal() {
  const modal = document.getElementById("modal-preview-q");
  modal?.classList.add("hidden");
}

export function togglePreviewViewport() {
  isPhoneViewport = !isPhoneViewport;
  const dialog = document.getElementById("preview-dialog-box");
  const modeLbl = document.getElementById("preview-mode-lbl");
  if (dialog) {
    dialog.style.maxWidth = isPhoneViewport ? "420px" : "820px";
  }
  if (modeLbl) {
    modeLbl.textContent = isPhoneViewport ? "Mode Laptop / Penuh" : "Mode HP (375px)";
  }
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
          <label class="opt-label" style="display:flex; align-items:center; gap:8px; padding:8px 12px; margin-bottom:6px; background:var(--paper); border:1px solid var(--line); border-radius:8px; cursor:pointer">
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
          <div class="bs-group" style="display:flex; gap:10px; margin-top:8px">
            <button type="button" class="btn ${
              cur === "true" ? "btn-primary" : "btn-secondary"
            }" style="flex:1" onclick="window._onPrevAns('${q.id}', 'true')">✓ BENAR</button>
            <button type="button" class="btn ${
              cur === "false" ? "btn-primary" : "btn-secondary"
            }" style="flex:1" onclick="window._onPrevAns('${q.id}', 'false')">✕ SALAH</button>
          </div>`;
      } else if (q.tipe === "match") {
        qContent = `<div id="prev_match_${q.id}">${generatePreviewMatchHTML(q)}</div>`;
      } else if (q.tipe === "essay") {
        qContent = `
          <div style="margin-top:8px">
            <textarea placeholder="Siswa akan mengetik jawaban uraian di sini..." rows="3" style="width:100%; resize:vertical" oninput="window._onPrevAns('${
              q.id
            }', this.value)"></textarea>
          </div>`;
      }

      return `
        <div class="q-card" style="background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:16px; margin-bottom:14px">
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
  const curMap = previewAnswers[q.id] || {};
  const activeLeft = previewSelectedPremise[q.id];
  const rightOptions =
    q._shuffledRight || (q._shuffledRight = shuffle(q.kanan || []));

  const leftCards = (q.kiri || [])
    .map((leftItem, lIdx) => {
      const paired = curMap[leftItem];
      const isSel = activeLeft === leftItem;
      return `
      <div class="match-card ${isSel ? "is-selected" : ""} ${
        paired ? "is-paired" : ""
      }" onclick="window._onPrevSelectPremise('${q.id}', '${escAttr(leftItem)}')">
        <div style="font-weight:600; color:var(--ink)"><span class="badge badge-match" style="margin-right:6px">A${
          lIdx + 1
        }</span>${escAttr(leftItem)}</div>
        ${
          paired
            ? `<div class="match-card-meta"><span style="color:var(--ok); font-weight:600">↳ ${escAttr(
                paired
              )}</span><button type="button" class="match-unpair-btn" title="Hapus" onclick="window._onPrevUnpair('${
                q.id
              }', '${escAttr(leftItem)}', event)">✕</button></div>`
            : isSel
            ? `<div class="match-card-meta" style="color:var(--accent)">Pilih respon di Kolom B...</div>`
            : ""
        }
      </div>`;
    })
    .join("");

  const rightCards = rightOptions
    .map((opt, rIdx) => {
      const pairedPremise = Object.keys(curMap).find((k) => curMap[k] === opt);
      return `
      <div class="match-card ${
        pairedPremise ? "is-paired" : ""
      }" onclick="window._onPrevSelectOption('${q.id}', '${escAttr(opt)}')">
        <div style="font-weight:500; color:var(--ink)"><span class="badge badge-neutral" style="margin-right:6px">B${
          rIdx + 1
        }</span>${escAttr(opt)}</div>
        ${
          pairedPremise
            ? `<div class="match-card-meta"><span style="color:var(--ok); font-weight:600">✓ Pasangan (${escAttr(
                pairedPremise
              )})</span></div>`
            : ""
        }
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

export function initQPreview() {
  window._closePreviewModal = closePreviewModal;
  window._togglePreviewViewport = togglePreviewViewport;

  window._onPrevAns = (qid, val) => {
    previewAnswers[qid] = val;
    const q = activePreviewQuestions.find((x) => x.id === qid);
    if (q && q.tipe === "bs") {
      renderPreviewContent();
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
