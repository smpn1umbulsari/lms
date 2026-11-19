// Student CBT Exam Runner (IndexedDB Queue + Throttled Sync + Verified Server ACK + Timer Warnings)
import { db, doc, getDoc, setDoc, serverTimestamp, Timestamp } from "../core/firebase.js";
import { escAttr } from "../core/dom.js";
import { fnv1a, mulberry32, shuffle } from "../shared/quiz-utils.js";
import { showConfirmDialog, showToast } from "../core/toast.js";
import { hitungSkor, getBobot } from "../core/scoring.js";
import { matchBoardHTML } from "../core/match-board.js";
import { putLocalAttempt, getLocalAttempt, deleteLocalAttempt } from "../core/attempt-queue.js";
import { syncAttemptToServer, createThrottledSyncer, toLocalRecord } from "./exam-sync.js";

let examState = null;
let syncer = null;
let selectedPremise = {};

function setSaveStatus(text, kind = "ok") {
  const ind = document.getElementById("ex-save-indicator");
  if (!ind) return;
  ind.textContent = !navigator.onLine ? "Mode Offline: Jawaban aman di HP" : text;
  ind.style.color = !navigator.onLine || kind === "warn" ? "var(--warn)" : kind === "error" ? "var(--danger)" : "var(--ok)";
}

window.addEventListener("online", () => examState && setSaveStatus("Koneksi kembali ✓", "ok"));
window.addEventListener("offline", () => examState && setSaveStatus("Mode Offline: Jawaban aman di HP", "warn"));

async function resolveAttemptSlot(uid, quizId, meta) {
  const maxAttempts = Math.min(3, Math.max(1, Number(meta.maxAttempts || 1)));
  for (let n = 1; n <= maxAttempts; n++) {
    const startId = `${uid}_${quizId}_${n}`;
    const sSnap = await getDoc(doc(db, "starts", startId)).catch(() => null);
    if (!sSnap || !sSnap.exists()) return { attemptNo: n, startId, sSnap: null, aSnap: null };
    const aSnap = await getDoc(doc(db, "attempts", startId)).catch(() => null);
    const submitted = aSnap?.exists() && aSnap.data()?.submittedAt != null;
    if (!submitted) return { attemptNo: n, startId, sSnap, aSnap };
  }
  return null;
}

export async function startQuiz(quizId, currentUser, userProfile, quizzesMeta, onFinish) {
  const meta = quizzesMeta[quizId];
  if (!meta) return;

  const slot = await resolveAttemptSlot(currentUser.uid, quizId, meta);
  if (!slot) return showToast("Anda sudah menyelesaikan semua percobaan ujian ini.", "warn");

  let { attemptNo, startId, sSnap, aSnap } = slot;
  if (!sSnap || !sSnap.exists()) {
    const closeAt = meta.closeAt;
    const expireAt = new Timestamp(closeAt.seconds + 30 * 86400, closeAt.nanoseconds);
    await setDoc(doc(db, "starts", startId), {
      uid: currentUser.uid, quizId, attemptNo, startedAt: serverTimestamp(),
      duration: meta.duration, closeAt: meta.closeAt, maxAttempts: Math.min(3, Math.max(1, Number(meta.maxAttempts || 1))),
      quizVersion: meta.version, keyVersion: 1, expireAt
    });
    sSnap = await getDoc(doc(db, "starts", startId));
  }

  const startData = sSnap.data();
  const deadlineMs = (startData.startedAt ? startData.startedAt.toMillis() : Date.now()) + startData.duration * 60000;
  const qDoc = (await getDoc(doc(db, "quizzes", quizId))).data();
  const localRec = await getLocalAttempt(startId);
  const cloudAnswers = aSnap?.exists() && aSnap.data()?.answers ? aSnap.data().answers : {};
  const savedAnswers = { ...cloudAnswers, ...(localRec?.answers || {}) };
  const submitSeq = Math.max(aSnap?.exists() ? aSnap.data().submitSeq || 0 : 0, localRec?.submitSeq || 0);
  const rnd = mulberry32(fnv1a(`${currentUser.uid}_${quizId}_${meta.version}`));

  selectedPremise = {};
  syncer?.destroy();
  examState = {
    quizId, startId, attemptNo, uid: currentUser.uid, mode: qDoc.mode || meta.mode || "latihan",
    deadlineMs, submitSeq, warned5m: false, warned1m: false,
    questions: shuffle(qDoc.questions || [], rnd), answers: savedAnswers,
    expireAt: startData.expireAt, expireAtSec: startData.expireAt?.seconds || 0, expireAtNs: startData.expireAt?.nanoseconds || 0,
    locked: false, currentUser, onFinish
  };
  syncer = createThrottledSyncer(() => examState, setSaveStatus);

  document.getElementById("sec-dashboard")?.classList.add("hidden");
  document.getElementById("sec-result")?.classList.add("hidden");
  document.getElementById("sec-exam")?.classList.remove("hidden");
  const exTitle = document.getElementById("ex-title");
  if (exTitle) exTitle.textContent = qDoc.judul || quizId;
  try { sessionStorage.setItem("lms_active_quiz", quizId); } catch (e) {}

  renderExam();
  startExamTimer();
  setSaveStatus("Semua jawaban tersimpan ✓", "ok");
}

function setAnswer(qid, val) {
  if (!examState || examState.locked) return;
  examState.answers[qid] = val;
  updateExamPalette();
  syncer?.markDirty();
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
      <button type="button" class="q-pal-btn ${isAns ? "answered" : ""}" data-action="jump-q" data-qid="${q.id}">
        <strong class="tabular-nums" style="font-size:12.5px">0${idx + 1} ${isAns ? "✓" : ""}</strong>
        <span class="badge badge-${q.tipe}" style="font-size:10px; padding:1px 6px">${q.tipe.toUpperCase()}</span>
      </button>`;
  }).join("");
  const bar = document.getElementById("ex-progress-bar");
  if (bar && examState.questions.length) bar.style.width = `${Math.max(10, Math.round((answeredCount / examState.questions.length) * 100))}%`;
}

function generateMatchHTML(q) {
  const rnd = mulberry32(fnv1a(q.id));
  return matchBoardHTML(q, { answers: examState.answers, selected: selectedPremise, rightOptions: shuffle(q.kanan || [], rnd) });
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
        <label class="opt-label"><input type="radio" name="ans_${q.id}" value="${k}" ${examState.answers[q.id] === k ? "checked" : ""} data-action="ans-pg" data-qid="${q.id}">
        <span><strong>${k}.</strong> ${escAttr(val)}</span></label>`).join("");
    } else if (q.tipe === "bs") {
      const cur = examState.answers[q.id];
      qContent = `<div class="bs-group">
        <div class="bs-btn ${cur === "true" ? "active-benar" : ""}" data-action="ans-bs" data-qid="${q.id}" data-val="true">✓ BENAR</div>
        <div class="bs-btn ${cur === "false" ? "active-salah" : ""}" data-action="ans-bs" data-qid="${q.id}" data-val="false">✕ SALAH</div></div>`;
    } else if (q.tipe === "match") {
      qContent = `<div id="match_wrap_${q.id}">${generateMatchHTML(q)}</div>`;
    } else if (q.tipe === "essay") {
      const curText = examState.answers[q.id] || "";
      qContent = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px">
        <span class="badge badge-essay">Dinilai Guru</span>
        <span class="tabular-nums" style="font-size:12px; color:var(--ink-2)" id="char_${q.id}">${curText.length} karakter terisi</span></div>
        <textarea placeholder="Ketikkan uraian jawaban Anda di sini..." data-action="ans-essay" data-qid="${q.id}">${escAttr(curText)}</textarea>`;
    }
    return `
      <div class="q-item ${q.tipe === "essay" ? "essay-border" : ""}" data-qtype="${q.tipe}" id="qcard_${q.id}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
          <span style="font-weight:600; color:var(--ink)">Soal No. ${idx + 1}</span>
          <span style="display:flex; align-items:center; gap:8px">
            <span class="tabular-nums" style="font-size:11.5px; color:var(--ink-3)">${getBobot(q)} Poin</span>
            <span class="badge badge-${q.tipe}">${q.tipe.toUpperCase()}</span>
          </span>
        </div>
        <div style="margin-bottom:14px; line-height:1.6; color:var(--ink); font-weight:500">${escAttr(q.teks)}</div>
        ${qContent}
      </div>`;
  }).join("");
  updateExamPalette();
}

function startExamTimer() {
  const clock = document.getElementById("ex-timer");
  const tick = () => {
    if (!examState || examState.locked) return;
    const left = examState.deadlineMs - Date.now();
    if (left <= 0) {
      if (clock) { clock.textContent = "00:00"; clock.classList.add("warn"); }
      finishExam();
      return;
    }
    if (!examState.warned5m && left <= 5 * 60000) {
      examState.warned5m = true;
      showToast("Perhatian: Sisa waktu ujian tinggal 5 menit.", "warn");
    }
    if (!examState.warned1m && left <= 60000) {
      examState.warned1m = true;
      showToast("Sisa waktu 1 menit! Lembar akan otomatis dikirim saat waktu habis.", "error");
    }
    const s = Math.floor(left / 1000), m = Math.floor(s / 60), ss = s % 60;
    if (clock) {
      clock.textContent = `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
      clock.classList.toggle("warn", left < 300000);
    }
  };
  tick();
  examState.timerId = setInterval(tick, 1000);
}

async function applyConfirmedResult(st) {
  await deleteLocalAttempt(st.startId);
  try { sessionStorage.removeItem("lms_active_quiz"); } catch (e) {}

  const badge = document.getElementById("res-badge");
  const scoreEl = document.getElementById("res-score");
  const descEl = document.getElementById("res-desc");
  const retryBtn = document.getElementById("btn-res-retry");
  if (retryBtn) retryBtn.classList.add("hidden");
  if (badge) { badge.className = "badge badge-ok"; badge.textContent = "Dikonfirmasi Server ✓"; }

  if (st.mode === "ujian") {
    if (scoreEl) { scoreEl.textContent = "TERKIRIM"; scoreEl.style.color = "var(--ok)"; }
    if (descEl) descEl.textContent = "Jawaban Anda telah diterima dan dikunci oleh server sekolah.";
  } else {
    const { dapat, total, benar, auto, pct } = hitungSkor(st.questions, st.answers);
    if (scoreEl) { scoreEl.textContent = `${pct}%`; scoreEl.style.color = "var(--ok)"; }
    if (descEl) {
      descEl.textContent = `Skor Latihan: ${dapat} dari ${total} poin (${benar} dari ${auto} butir benar).` +
        (st.questions.length > auto ? " Soal uraian dinilai guru." : "");
    }
    try {
      await setDoc(doc(db, "progress", st.currentUser.uid), {
        xp: pct, quizScores: { [st.quizId]: pct }, updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {}
  }
  st.onFinish?.();
}

function showPendingResult(st, errorMsg) {
  const badge = document.getElementById("res-badge");
  const scoreEl = document.getElementById("res-score");
  const descEl = document.getElementById("res-desc");
  const retryBtn = document.getElementById("btn-res-retry");
  if (badge) { badge.className = "badge badge-warn"; badge.textContent = "BELUM TERKIRIM — Jawaban Aman di HP"; }
  if (scoreEl) { scoreEl.textContent = "TERTUNDA"; scoreEl.style.color = "var(--warn)"; }
  if (descEl) descEl.textContent = `Gagal terhubung ke server (${errorMsg}). Jangan hapus data browser; tekan Kirim Ulang saat sinyal stabil.`;
  if (retryBtn) {
    retryBtn.classList.remove("hidden");
    retryBtn.onclick = async () => {
      retryBtn.disabled = true;
      retryBtn.textContent = "Mengirim ulang...";
      const res = await syncAttemptToServer(st, { markSubmitted: true });
      retryBtn.disabled = false;
      retryBtn.textContent = "Coba Kirim Ulang";
      if (res.ok && res.confirmed) await applyConfirmedResult(st);
      else showToast("Masih gagal mengirim: " + (res.error || "coba lagi"), "warn");
    };
  }
}

export async function finishExam() {
  if (!examState || examState.locked) return;
  examState.locked = true;
  clearInterval(examState.timerId);
  syncer?.destroy();

  const btn = document.getElementById("btn-ex-finish");
  if (btn) { btn.disabled = true; btn.textContent = "Mengirim ke server..."; }
  await putLocalAttempt(toLocalRecord(examState, true));
  const ack = await syncAttemptToServer(examState, { markSubmitted: true });
  if (btn) { btn.disabled = false; btn.textContent = "Selesaikan & Kirim"; }

  document.getElementById("sec-exam")?.classList.add("hidden");
  document.getElementById("sec-result")?.classList.remove("hidden");
  if (ack.ok && ack.confirmed) await applyConfirmedResult(examState);
  else showPendingResult(examState, ack.error || "Tidak ada konfirmasi server");
}

export function initExamRunnerControls() {
  const container = document.getElementById("ex-questions");
  container?.addEventListener("click", (e) => {
    const bs = e.target.closest("[data-action='ans-bs']");
    if (bs) {
      setAnswer(bs.dataset.qid, bs.dataset.val);
      bs.closest(".bs-group")?.querySelectorAll(".bs-btn").forEach((b) => {
        b.classList.toggle("active-benar", b.dataset.val === "true" && bs.dataset.val === "true");
        b.classList.toggle("active-salah", b.dataset.val === "false" && bs.dataset.val === "false");
      });
      return;
    }
    const selP = e.target.closest("[data-action='match-select-premise']");
    if (selP && examState && !examState.locked) {
      const qid = selP.dataset.qid, p = selP.dataset.premise;
      selectedPremise[qid] = selectedPremise[qid] === p ? null : p;
      renderMatchQuestion(qid);
      return;
    }
    const selO = e.target.closest("[data-action='match-select-option']");
    if (selO && examState && !examState.locked) {
      const qid = selO.dataset.qid, cur = selectedPremise[qid];
      if (cur) {
        (examState.answers[qid] ||= {})[cur] = selO.dataset.opt;
        selectedPremise[qid] = null;
        setAnswer(qid, examState.answers[qid]);
        renderMatchQuestion(qid);
      }
      return;
    }
    const unp = e.target.closest("[data-action='match-unpair']");
    if (unp && examState && !examState.locked) {
      e.stopPropagation();
      const qid = unp.dataset.qid;
      if (examState.answers[qid]) {
        delete examState.answers[qid][unp.dataset.premise];
        setAnswer(qid, examState.answers[qid]);
        renderMatchQuestion(qid);
      }
    }
  });

  container?.addEventListener("change", (e) => e.target.dataset.action === "ans-pg" && setAnswer(e.target.dataset.qid, e.target.value));
  container?.addEventListener("input", (e) => {
    if (e.target.dataset.action !== "ans-essay") return;
    setAnswer(e.target.dataset.qid, e.target.value);
    const c = document.getElementById("char_" + e.target.dataset.qid);
    if (c) c.textContent = e.target.value.length + " karakter terisi";
  });

  document.getElementById("ex-palette")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action='jump-q']");
    if (b?.dataset.qid) document.getElementById("qcard_" + b.dataset.qid)?.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  document.getElementById("btn-ex-finish")?.addEventListener("click", async () => {
    const ok = await showConfirmDialog({
      title: "Kirim Lembar Ujian?",
      message: "Pastikan seluruh soal sudah diperiksa. Setelah dikirim dan diterima server, jawaban terkunci.",
      confirmText: "Ya, Kirim Ujian"
    });
    if (ok) finishExam();
  });

  document.getElementById("btn-res-back")?.addEventListener("click", () => {
    document.getElementById("sec-result")?.classList.add("hidden");
    document.getElementById("sec-dashboard")?.classList.remove("hidden");
    examState?.onFinish?.();
  });
}

export function getActiveExamId() {
  try { return sessionStorage.getItem("lms_active_quiz"); } catch (e) { return null; }
}
