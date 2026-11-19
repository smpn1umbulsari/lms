// Admin Koreksi & Penilaian Siswa (Bobot Dinamis, Identitas Lengkap, Prefill Aman, Paginasi)
import {
  auth,
  db,
  doc,
  documentId,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  limit,
  startAfter,
  getCountFromServer,
  writeBatch,
  Timestamp
} from "../core/firebase.js";
import { escAttr } from "../core/dom.js";
import { showToast, showConfirmDialog } from "../core/toast.js";
import { gradeAttempt, getBobot } from "../core/scoring.js";
import { renderItemAnalysis } from "./koreksi-stats.js";
import { renderStudentCard, profileOf } from "./koreksi-render.js";
import { initKoreksiImport } from "./koreksi-import.js";

export { renderItemAnalysis };

const PAGE_SIZE = 50;
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const state = {
  quizId: "",
  quizDoc: null,
  keys: {},
  attempts: [],
  filtered: [],
  totalCount: 0,
  lastSnap: null,
  hasMore: false,
  userMap: new Map(),
  resultMap: new Map(),
  draftScores: {},
  draftNotes: {},
  dirtyIds: new Set(),
  activeIdx: 0
};

export function getCurrentAttempts() {
  return state.attempts;
}

export async function populateGradingQuizSelect(selectedCode = "") {
  const sel = document.getElementById("gr-code");
  if (!sel) return;
  const prev = selectedCode || sel.value;
  try {
    const snap = await getDocs(collection(db, "quizzes"));
    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(a.judul || a.id).localeCompare(String(b.judul || b.id)));
    sel.innerHTML = `<option value="">-- Pilih Paket Ujian (${list.length}) --</option>` +
      list.map((q) => {
        const cls = Array.isArray(q.classes) ? q.classes.join(", ") : q.classes || "-";
        return `<option value="${escAttr(q.id)}">${escAttr(q.judul || q.id)} (${escAttr(cls)}) [${escAttr(q.id)}]</option>`;
      }).join("");
    if (prev && list.some((q) => q.id === prev)) sel.value = prev;
  } catch (e) {
    console.warn("Gagal memuat daftar ujian:", e);
  }
}

export function stepStudent(dir) {
  if (!state.filtered.length) return;
  state.activeIdx = (state.activeIdx + dir + state.filtered.length) % state.filtered.length;
  const cards = document.querySelectorAll("#gr-cards .q-card");
  cards[state.activeIdx]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  const counter = document.getElementById("gr-student-counter");
  if (counter) counter.textContent = `${state.activeIdx + 1} / ${state.filtered.length}`;
}

async function resolveProfiles(attempts, classes = []) {
  for (const part of chunk([...new Set(classes)].filter(Boolean), 10)) {
    const snap = await getDocs(query(collection(db, "users"), where("kelas", "in", part))).catch(() => null);
    snap?.docs.forEach((d) => state.userMap.set(d.id, { uid: d.id, ...d.data() }));
  }
  const missingUids = [...new Set(attempts.map((a) => a.uid).filter((u) => u && !state.userMap.has(u)))];
  for (const part of chunk(missingUids, 10)) {
    const snap = await getDocs(query(collection(db, "users"), where(documentId(), "in", part))).catch(() => null);
    snap?.docs.forEach((d) => state.userMap.set(d.id, { uid: d.id, ...d.data() }));
  }
}

async function loadExistingResults(attemptIds) {
  for (const part of chunk(attemptIds, 10)) {
    const snap = await getDocs(query(collection(db, "results"), where(documentId(), "in", part))).catch(() => null);
    snap?.docs.forEach((d) => state.resultMap.set(d.id, d.data()));
  }
}

function updateClassFilterOptions() {
  const sel = document.getElementById("gr-filter-kelas");
  if (!sel) return;
  const prev = sel.value;
  const classes = [...new Set(state.attempts.map((a) => profileOf(a.uid, state.userMap).kelas).filter((c) => c && c !== "-"))].sort();
  sel.innerHTML = `<option value="">Semua Kelas</option>` + classes.map((c) => `<option value="${escAttr(c)}">${escAttr(c)}</option>`).join("");
  if (prev && classes.includes(prev)) sel.value = prev;
}

function renderFilteredCards() {
  const kFilter = (document.getElementById("gr-filter-kelas")?.value || "").toLowerCase();
  const qFilter = (document.getElementById("gr-filter-nama")?.value || "").trim().toLowerCase();
  state.filtered = state.attempts.filter((att) => {
    const prof = profileOf(att.uid, state.userMap);
    if (kFilter && String(prof.kelas || "").toLowerCase() !== kFilter) return false;
    if (qFilter && !`${prof.nama} ${prof.nis} ${prof.kelas}`.toLowerCase().includes(qFilter)) return false;
    return true;
  });

  state.activeIdx = 0;
  const counter = document.getElementById("gr-student-counter");
  if (counter) counter.textContent = state.filtered.length ? `1 / ${state.filtered.length}` : "0 / 0";
  const countBadge = document.getElementById("gr-count-badge");
  if (countBadge) countBadge.textContent = `${state.attempts.length} / ${state.totalCount} Lembar`;

  const container = document.getElementById("gr-cards");
  if (!container) return;
  if (!state.attempts.length) {
    container.innerHTML = "<p style='color:var(--ink-3); padding:12px 0'>Belum ada siswa yang mengirimkan ujian ini.</p>";
  } else if (!state.filtered.length) {
    container.innerHTML = "<p style='color:var(--ink-3); padding:12px 0'>Tidak ada siswa yang cocok dengan filter.</p>";
  } else {
    container.innerHTML = state.filtered.map((att, i) => renderStudentCard(att, i, state)).join("");
  }

  const bar = document.getElementById("gr-paging-bar");
  const info = document.getElementById("gr-paging-info");
  const btnMore = document.getElementById("btn-gr-more");
  if (bar && info && btnMore) {
    bar.classList.toggle("hidden", state.attempts.length === 0);
    info.textContent = `Menampilkan ${state.attempts.length} dari ${state.totalCount} lembar jawaban`;
    btnMore.classList.toggle("hidden", !state.hasMore);
  }
}

export async function fetchAttemptsForGrading(append = false) {
  const code = (document.getElementById("gr-code")?.value || "").trim();
  if (!code) return showToast("Pilih paket ujian terlebih dahulu!", "warn");

  if (!append) {
    state.quizId = code;
    state.attempts = [];
    state.resultMap.clear();
    state.draftScores = {};
    state.draftNotes = {};
    state.dirtyIds.clear();
    state.lastSnap = null;
  }

  const attQuery = append && state.lastSnap
    ? query(collection(db, "attempts"), where("quizId", "==", code), startAfter(state.lastSnap), limit(PAGE_SIZE))
    : query(collection(db, "attempts"), where("quizId", "==", code), limit(PAGE_SIZE));

  const tasks = [getDocs(attQuery)];
  if (!append) {
    tasks.push(
      getDoc(doc(db, "quizKeys", code)).catch(() => null),
      getDoc(doc(db, "quizzes", code)),
      getCountFromServer(query(collection(db, "attempts"), where("quizId", "==", code))).catch(() => null)
    );
  }

  const [attSnap, keySnap, qSnap, cntSnap] = await Promise.all(tasks);
  if (!append) {
    if (!qSnap?.exists()) return showToast(`Paket soal ${code} tidak ditemukan!`, "warn");
    state.quizDoc = qSnap.data();
    state.keys = keySnap?.exists() ? keySnap.data().keys || {} : {};
    state.totalCount = cntSnap ? cntSnap.data().count : attSnap.docs.length;
  }

  const newAtts = attSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  state.lastSnap = attSnap.docs[attSnap.docs.length - 1] || state.lastSnap;
  state.hasMore = attSnap.docs.length === PAGE_SIZE && state.attempts.length + newAtts.length < state.totalCount;
  state.attempts = [...state.attempts, ...newAtts];

  await Promise.all([
    resolveProfiles(newAtts, state.quizDoc?.classes || []),
    loadExistingResults(newAtts.map((a) => a.id))
  ]);

  updateClassFilterOptions();
  renderFilteredCards();
  renderItemAnalysis(state.quizDoc, state.attempts, state.keys);
  document.getElementById("gr-eval-panel")?.classList.remove("hidden");
}

function readAttemptInputs(att) {
  const prevRes = state.resultMap.get(att.id);
  const essayScores = {};
  const essayNotes = {};
  (state.quizDoc?.questions || []).forEach((q) => {
    if (q.tipe !== "essay") return;
    const keyDraft = `${att.id}__${q.id}`;
    const rawS = keyDraft in state.draftScores ? state.draftScores[keyDraft] : prevRes?.essayScores?.[q.id] ?? "";
    const maxW = getBobot(q);
    if (rawS !== "" && rawS !== null && rawS !== undefined && Number.isFinite(Number(rawS))) {
      essayScores[q.id] = Math.min(maxW, Math.max(0, Number(rawS)));
    }
    const rawN = keyDraft in state.draftNotes ? state.draftNotes[keyDraft] : prevRes?.essayNotes?.[q.id] ?? "";
    if (String(rawN).trim()) essayNotes[q.id] = String(rawN).trim().slice(0, 1000);
  });
  return { essayScores, essayNotes };
}

export async function publishBatchGrades() {
  if (!state.quizId || !state.attempts.length) return showToast("Muat lembar jawaban terlebih dahulu!", "warn");
  const targets = state.attempts.filter((a) => state.dirtyIds.has(a.id) || !state.resultMap.has(a.id));
  if (!targets.length) return showToast("Tidak ada perubahan nilai untuk disimpan.", "warn");

  const gradedBy = auth.currentUser?.uid || "";
  const payloads = targets.map((att) => {
    const { essayScores, essayNotes } = readAttemptInputs(att);
    const graded = gradeAttempt(state.quizDoc.questions || [], att.answers || {}, state.keys, essayScores);
    const nextRev = (Number(state.resultMap.get(att.id)?.revisionNo) || 0) + 1;
    return {
      attId: att.id,
      missingCount: graded.missingEssays.length,
      data: {
        uid: att.uid, quizId: state.quizId, attemptNo: att.attemptNo || 1,
        points: graded.totalPoints, maxScore: graded.maxScore, pct: graded.pct, totalScore: graded.pct,
        autoGradedScore: graded.autoPoints, essayScore: graded.essayPoints,
        essayScores, essayNotes, isFullyGraded: graded.missingEssays.length === 0,
        gradedBy, gradedAt: Timestamp.now(), revisionNo: nextRev
      }
    };
  });

  const ungradedEssays = payloads.filter((p) => p.missingCount > 0).length;
  const warn = ungradedEssays ? `\n\n⚠ Perhatian: ${ungradedEssays} siswa masih memiliki nilai Uraian kosong (dihitung 0 sementara).` : "";
  const ok = await showConfirmDialog({
    title: "Simpan & Bagikan Nilai?",
    message: `Sistem akan menyimpan/memperbarui nilai ${payloads.length} siswa untuk ujian ${state.quizId}.${warn}`,
    confirmText: "Ya, Simpan Nilai"
  });
  if (!ok) return;

  for (const part of chunk(payloads, 400)) {
    const batch = writeBatch(db);
    part.forEach((p) => batch.set(doc(db, "results", p.attId), p.data, { merge: true }));
    await batch.commit();
  }
  payloads.forEach((p) => { state.resultMap.set(p.attId, p.data); state.dirtyIds.delete(p.attId); });
  renderFilteredCards();
  showToast(`Nilai ujian ${state.quizId} tersimpan untuk ${payloads.length} siswa.`, "ok");
}

function handleCardInput(e) {
  const input = e.target;
  const attId = input.dataset?.attId;
  const qid = input.dataset?.qid;
  if (!attId || !qid) return;
  if (input.classList.contains("gr-essay-input")) state.draftScores[`${attId}__${qid}`] = input.value;
  if (input.classList.contains("gr-note-input")) state.draftNotes[`${attId}__${qid}`] = input.value;
  state.dirtyIds.add(attId);

  const att = state.attempts.find((a) => a.id === attId);
  const badge = document.getElementById("live_score_" + attId);
  if (att && badge) {
    const { essayScores } = readAttemptInputs(att);
    const g = gradeAttempt(state.quizDoc?.questions || [], att.answers || {}, state.keys, essayScores);
    badge.textContent = `Nilai: ${g.pct}/100 (${g.totalPoints}/${g.maxScore} poin)`;
  }
}

export function initKoreksi() {
  document.querySelectorAll("[data-action='step-student']").forEach((b) =>
    b.addEventListener("click", () => { const s = parseInt(b.dataset.step, 10); if (!isNaN(s)) stepStudent(s); })
  );
  document.getElementById("gr-cards")?.addEventListener("input", handleCardInput);
  document.getElementById("gr-filter-kelas")?.addEventListener("change", renderFilteredCards);
  document.getElementById("gr-filter-nama")?.addEventListener("input", renderFilteredCards);
  document.getElementById("btn-gr-refresh-list")?.addEventListener("click", () => populateGradingQuizSelect());
  document.getElementById("btn-gr-fetch")?.addEventListener("click", () => fetchAttemptsForGrading(false));
  document.getElementById("btn-gr-more")?.addEventListener("click", () => fetchAttemptsForGrading(true));
  document.getElementById("btn-gr-publish")?.addEventListener("click", publishBatchGrades);
  initKoreksiImport();
}
