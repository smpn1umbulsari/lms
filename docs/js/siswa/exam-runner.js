// Student CBT Exam Runner
import { db, doc, getDoc, setDoc, serverTimestamp, Timestamp } from "../core/firebase.js";
import { escAttr } from "../core/dom.js";
import { fnv1a, mulberry32, shuffle } from "../shared/quiz-utils.js";

let examState = null;
let autoSaveTimer = null;
let selectedPremise = {};

function saveLocalBackup() {
  if (!examState) return;
  try {
    sessionStorage.setItem("lms_attempt_" + examState.startId, JSON.stringify(examState.answers));
  } catch (e) {}
}

function updateConnectionIndicator() {
  const ind = document.getElementById("ex-save-indicator");
  if (!ind) return;
  if (!navigator.onLine) {
    ind.textContent = "Mode Offline: Jawaban aman di HP";
    ind.style.color = "var(--warn)";
  } else {
    ind.textContent = "Semua jawaban tersimpan ✓";
    ind.style.color = "var(--ok)";
  }
}
window.addEventListener("online", updateConnectionIndicator);
window.addEventListener("offline", updateConnectionIndicator);

export async function startQuiz(quizId, currentUser, userProfile, quizzesMeta, onFinish) {
  const meta = quizzesMeta[quizId];
  if (!meta) return;
  const startId = `${currentUser.uid}_${quizId}_1`;
  const sref = doc(db, "starts", startId);
  let sSnap = await getDoc(sref).catch(() => null);

  if (!sSnap || !sSnap.exists()) {
    const closeAt = meta.closeAt;
    const expireAt = new Timestamp(closeAt.seconds + 30 * 86400, closeAt.nanoseconds);
    await setDoc(sref, {
      uid: currentUser.uid, quizId, attemptNo: 1, startedAt: serverTimestamp(),
      duration: meta.duration, closeAt: meta.closeAt, maxAttempts: 1,
      quizVersion: meta.version, keyVersion: 1, expireAt
    });
    sSnap = await getDoc(sref);
  }

  const startData = sSnap.data();
  const deadlineMs = (startData.startedAt ? startData.startedAt.toMillis() : Date.now()) + startData.duration * 60000;
  const qDoc = (await getDoc(doc(db, "quizzes", quizId))).data();
  const mode = qDoc.mode || "latihan";

  let localBackup = {};
  try {
    const raw = sessionStorage.getItem("lms_attempt_" + startId);
    if (raw) localBackup = JSON.parse(raw);
  } catch (e) {}

  const aSnap = await getDoc(doc(db, "attempts", startId)).catch(() => null);
  const cloudAnswers = aSnap && aSnap.exists() && aSnap.data().answers ? aSnap.data().answers : {};
  const savedAnswers = { ...cloudAnswers, ...localBackup };
  const submitSeq = aSnap && aSnap.exists() && aSnap.data().submitSeq ? aSnap.data().submitSeq : 0;
  const seed = fnv1a(`${currentUser.uid}_${quizId}_${meta.version}`);
  const rnd = mulberry32(seed);

  selectedPremise = {};
  examState = {
    quizId, startId, mode, deadlineMs, submitSeq,
    questions: shuffle(qDoc.questions || [], rnd), answers: savedAnswers,
    expireAt: startData.expireAt, locked: false, currentUser, onFinish
  };

  document.getElementById("sec-dashboard")?.classList.add("hidden");
  document.getElementById("sec-exam")?.classList.remove("hidden");
  const exTitle = document.getElementById("ex-title");
  if (exTitle) exTitle.textContent = qDoc.judul || quizId;

  setupAnswerHandlers();
  renderExam();
  startExamTimer();
  updateConnectionIndicator();
}

function setupAnswerHandlers() {
  window._onAns = (qid, val) => {
    if (!examState || examState.locked) return;
    examState.answers[qid] = val;
    saveLocalBackup();
    updateExamPalette();
    scheduleAutoSave();
  };

  window._onSelectPremise = (qid, premise) => {
    if (!examState || examState.locked) return;
    selectedPremise[qid] = selectedPremise[qid] === premise ? null : premise;
    renderMatchQuestion(qid);
  };

  window._onSelectOption = (qid, option) => {
    if (!examState || examState.locked) return;
    const curPremise = selectedPremise[qid];
    if (curPremise) {
      if (!examState.answers[qid]) examState.answers[qid] = {};
      examState.answers[qid][curPremise] = option;
      selectedPremise[qid] = null;
      saveLocalBackup();
      updateExamPalette();
      scheduleAutoSave();
      renderMatchQuestion(qid);
    }
  };

  window._onUnpair = (qid, premise, e) => {
    if (e) e.stopPropagation();
    if (!examState || examState.locked) return;
    if (examState.answers[qid]) {
      delete examState.answers[qid][premise];
      saveLocalBackup();
      updateExamPalette();
      scheduleAutoSave();
      renderMatchQuestion(qid);
    }
  };
}

export function updateExamPalette() {
  const pal = document.getElementById("ex-palette");
  if (!pal || !examState) return;
  let answeredCount = 0;
  pal.innerHTML = examState.questions.map((q, idx) => {
    const ans = examState.answers[q.id];
    const isAns = ans !== undefined && ans !== "" && (typeof ans !== "object" || Object.keys(ans).length > 0);
    if (isAns) answeredCount++;
    return `
      <button type="button" class="q-pal-btn ${isAns ? "answered" : ""}" onclick="document.getElementById('qcard_${q.id}')?.scrollIntoView({behavior:'smooth', block:'center'})">
        <strong class="tabular-nums" style="font-size:12.5px">0${idx + 1} ${isAns ? "✓" : ""}</strong>
        <span class="badge badge-${q.tipe}" style="font-size:10px; padding:1px 6px">${q.tipe.toUpperCase()}</span>
      </button>
    `;
  }).join("");

  const bar = document.getElementById("ex-progress-bar");
  if (bar && examState.questions.length) {
    const pct = Math.round((answeredCount / examState.questions.length) * 100);
    bar.style.width = `${Math.max(10, pct)}%`;
  }
}

function generateMatchHTML(q) {
  const curMap = examState.answers[q.id] || {};
  const activeLeft = selectedPremise[q.id];
  const rnd = mulberry32(fnv1a(q.id));
  const rightOptions = shuffle(q.kanan || [], rnd);

  const leftCards = (q.kiri || []).map((leftItem, lIdx) => {
    const paired = curMap[leftItem];
    const isSel = activeLeft === leftItem;
    return `
      <div class="match-card ${isSel ? "is-selected" : ""} ${paired ? "is-paired" : ""}" onclick="window._onSelectPremise('${q.id}', '${escAttr(leftItem)}')">
        <div style="font-weight:600; color:var(--ink)"><span class="badge badge-match" style="margin-right:6px">A${lIdx + 1}</span>${escAttr(leftItem)}</div>
        ${paired ? `<div class="match-card-meta"><span style="color:var(--ok); font-weight:600">↳ ${escAttr(paired)}</span><button type="button" class="match-unpair-btn" title="Hapus" onclick="window._onUnpair('${q.id}', '${escAttr(leftItem)}', event)">✕</button></div>` : (isSel ? `<div class="match-card-meta" style="color:var(--accent)">Pilih respon di Kolom B...</div>` : "")}
      </div>`;
  }).join("");

  const rightCards = rightOptions.map((opt, rIdx) => {
    const pairedPremise = Object.keys(curMap).find((k) => curMap[k] === opt);
    return `
      <div class="match-card ${pairedPremise ? "is-paired" : ""}" onclick="window._onSelectOption('${q.id}', '${escAttr(opt)}')">
        <div style="font-weight:500; color:var(--ink)"><span class="badge badge-neutral" style="margin-right:6px">B${rIdx + 1}</span>${escAttr(opt)}</div>
        ${pairedPremise ? `<div class="match-card-meta"><span style="color:var(--ok); font-weight:600">✓ Pasangan (${escAttr(pairedPremise)})</span></div>` : ""}
      </div>`;
  }).join("");

  return `
    <div style="margin-bottom:6px; font-size:12px; color:var(--ink-2)">Ketuk kartu di <strong>Kolom A</strong>, lalu ketuk jawaban pasangannya di <strong>Kolom B</strong>:</div>
    <div class="match-board">
      <div><div class="match-col-title">Kolom A (Premis)</div>${leftCards}</div>
      <div><div class="match-col-title">Kolom B (Pilihan)</div>${rightCards}</div>
    </div>`;
}

function renderMatchQuestion(qid) {
  const wrap = document.getElementById("match_wrap_" + qid);
  const q = examState?.questions.find((x) => x.id === qid);
  if (wrap && q) wrap.innerHTML = generateMatchHTML(q);
}

export function renderExam() {
  const container = document.getElementById("ex-questions");
  if (!container || !examState) return;

  container.innerHTML = examState.questions.map((q, idx) => {
    let qContent = "";
    if (q.tipe === "pg") {
      qContent = Object.entries(q.pilihan || {}).map(([k, val]) => `
        <label class="opt-label">
          <input type="radio" name="ans_${q.id}" value="${k}" ${examState.answers[q.id] === k ? "checked" : ""} onchange="window._onAns('${q.id}', '${k}')">
          <span><strong>${k}.</strong> ${escAttr(val)}</span>
        </label>`).join("");
    } else if (q.tipe === "bs") {
      const cur = examState.answers[q.id];
      qContent = `
        <div class="bs-group">
          <div class="bs-btn ${cur === "true" ? "active-benar" : ""}" onclick="window._onAns('${q.id}', 'true')">✓ BENAR</div>
          <div class="bs-btn ${cur === "false" ? "active-salah" : ""}" onclick="window._onAns('${q.id}', 'false')">✕ SALAH</div>
        </div>`;
    } else if (q.tipe === "match") {
      qContent = `<div id="match_wrap_${q.id}">${generateMatchHTML(q)}</div>`;
    } else if (q.tipe === "essay") {
      const curText = examState.answers[q.id] || "";
      qContent = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px">
          <span class="badge badge-essay">Dinilai Manual Guru</span>
          <span class="tabular-nums" style="font-size:12px; color:var(--ink-2)" id="char_${q.id}">${curText.length} karakter terisi</span>
        </div>
        <textarea placeholder="Ketikkan uraian jawaban Anda di sini..." oninput="window._onAns('${q.id}', this.value); const c=document.getElementById('char_${q.id}'); if(c) c.textContent=this.value.length+' karakter terisi';">${escAttr(curText)}</textarea>`;
    }

    return `
      <div class="q-item ${q.tipe === "essay" ? "essay-border" : ""}" data-qtype="${q.tipe}" id="qcard_${q.id}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
          <span style="font-weight:600; color:var(--ink)">Soal No. ${idx + 1}</span>
          <span class="badge badge-${q.tipe}">${q.tipe.toUpperCase()}</span>
        </div>
        <div style="margin-bottom:14px; line-height:1.6; color:var(--ink); font-weight:500">${escAttr(q.teks)}</div>
        ${qContent}
      </div>`;
  }).join("");

  updateExamPalette();
}

function scheduleAutoSave() {
  const ind = document.getElementById("ex-save-indicator");
  if (ind && navigator.onLine) ind.textContent = "Menyimpan jawaban...";
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(saveAttemptToServer, 800);
}

async function saveAttemptToServer() {
  if (!examState || examState.locked) return;
  saveLocalBackup();
  if (!navigator.onLine) { updateConnectionIndicator(); return; }
  examState.submitSeq++;
  try {
    await setDoc(doc(db, "attempts", examState.startId), {
      uid: examState.currentUser.uid, quizId: examState.quizId, attemptNo: 1,
      answers: examState.answers, submitSeq: examState.submitSeq,
      updatedAt: serverTimestamp(), expireAt: examState.expireAt
    }, { merge: true });
    const ind = document.getElementById("ex-save-indicator");
    if (ind && navigator.onLine) { ind.textContent = "Semua jawaban tersimpan ✓"; ind.style.color = "var(--ok)"; }
  } catch (err) {
    console.warn("Auto-save tertunda:", err);
    updateConnectionIndicator();
  }
}

function startExamTimer() {
  const clock = document.getElementById("ex-timer");
  const tick = () => {
    if (!examState) return;
    const left = examState.deadlineMs - Date.now();
    if (left <= 0) {
      if (clock) { clock.textContent = "00:00"; clock.classList.add("warn"); }
      finishExam(); return;
    }
    const s = Math.floor(left / 1000), m = Math.floor(s / 60), ss = s % 60;
    if (clock) {
      clock.textContent = `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
      clock.classList.toggle("warn", left < 60000);
    }
  };
  tick();
  examState.timerId = setInterval(tick, 1000);
}

export async function finishExam() {
  if (!examState || examState.locked) return;
  examState.locked = true;
  clearInterval(examState.timerId);
  clearTimeout(autoSaveTimer);
  try { sessionStorage.removeItem("lms_attempt_" + examState.startId); } catch (e) {}

  await saveAttemptToServer();
  document.getElementById("sec-exam")?.classList.add("hidden");
  document.getElementById("sec-result")?.classList.remove("hidden");

  if (examState.mode === "ujian") {
    document.getElementById("res-score").textContent = "TERKIRIM";
    document.getElementById("res-desc").textContent = "Jawaban berhasil dikumpulkan. Soal essay sedang dalam antrean koreksi manual guru.";
  } else {
    let benar = 0;
    const total = examState.questions.length;
    examState.questions.forEach((q) => {
      if (q.tipe === "pg" && examState.answers[q.id] === q.kunci) benar++;
      if (q.tipe === "bs" && examState.answers[q.id] === q.kunci) benar++;
      if (q.tipe === "match" && q.kunci) {
        const studentM = examState.answers[q.id] || {};
        if (Object.keys(q.kunci).every((k) => q.kunci[k] === studentM[k])) benar++;
      }
    });
    const pct = total ? Math.round((benar / total) * 100) : 0;
    document.getElementById("res-score").textContent = `${pct}%`;
    document.getElementById("res-desc").textContent = `Skor Latihan: ${benar} dari ${total} butir benar (PG/BS/Match).`;
    await setDoc(doc(db, "progress", examState.currentUser.uid), {
      xp: pct, quizScores: { [examState.quizId]: pct }, updatedAt: serverTimestamp()
    }, { merge: true });
  }

  if (typeof examState.onFinish === "function") examState.onFinish();
}

export function initExamRunnerControls() {
  document.getElementById("btn-ex-finish")?.addEventListener("click", () => {
    if (confirm("Apakah Anda yakin ingin menyelesaikan dan mengirim ujian ini?")) finishExam();
  });
  document.getElementById("btn-res-back")?.addEventListener("click", () => {
    document.getElementById("sec-result")?.classList.add("hidden");
    document.getElementById("sec-dashboard")?.classList.remove("hidden");
    if (typeof examState?.onFinish === "function") examState.onFinish();
  });
}
