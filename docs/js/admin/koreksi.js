// Admin Koreksi & Penilaian Siswa
import {
  db,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  writeBatch,
  Timestamp
} from "../core/firebase.js";
import { escAttr } from "../core/dom.js";
import { showToast } from "../core/toast.js";

let currentAttempts = [];
let loadedKeys = {};
let activeQuizDoc = null;
let activeStudentIdx = 0;

export function getCurrentAttempts() {
  return currentAttempts;
}

export function stepStudent(dir) {
  if (!currentAttempts.length) return;
  activeStudentIdx =
    (activeStudentIdx + dir + currentAttempts.length) % currentAttempts.length;
  const cards = document.querySelectorAll("#gr-cards .q-card");
  if (cards[activeStudentIdx]) {
    cards[activeStudentIdx].scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  const counter = document.getElementById("gr-student-counter");
  if (counter) counter.textContent = `${activeStudentIdx + 1} / ${currentAttempts.length}`;
}

export async function fetchAttemptsForGrading() {
  const code = document.getElementById("gr-code").value.trim();
  if (!code) return alert("Masukkan kode kuis!");

  const [keySnap, qSnap, attSnap] = await Promise.all([
    getDoc(doc(db, "quizKeys", code)),
    getDoc(doc(db, "quizzes", code)),
    getDocs(query(collection(db, "attempts"), where("quizId", "==", code)))
  ]);

  if (!keySnap.exists()) return alert("quizKeys tidak ditemukan untuk kuis ini!");
  loadedKeys = keySnap.data().keys || {};
  activeQuizDoc = qSnap.data();
  currentAttempts = attSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  activeStudentIdx = 0;

  const countBadge = document.getElementById("gr-count-badge");
  if (countBadge) countBadge.textContent = `${currentAttempts.length} Lembar`;
  const counter = document.getElementById("gr-student-counter");
  if (counter) {
    counter.textContent = currentAttempts.length ? `1 / ${currentAttempts.length}` : "0 / 0";
  }

  const container = document.getElementById("gr-cards");
  if (!currentAttempts.length) {
    container.innerHTML =
      "<p style='color:var(--ink-3); padding:12px 0'>Belum ada siswa yang mengirimkan ujian ini.</p>";
    document.getElementById("gr-eval-panel")?.classList.remove("hidden");
    return;
  }

  container.innerHTML = currentAttempts
    .map((att, aIdx) => {
      let autoScore = 0;
      let essayInputs = "";
      (activeQuizDoc.questions || []).forEach((q) => {
        const studentAns = (att.answers || {})[q.id];
        if (q.tipe === "pg" && studentAns === loadedKeys[q.id]) autoScore += 25;
        if (q.tipe === "bs" && studentAns === loadedKeys[q.id]) autoScore += 25;
        if (q.tipe === "match") {
          const correctM = loadedKeys[q.id] || {};
          const isMatchAll =
            Object.keys(correctM).length &&
            Object.keys(correctM).every((k) => (studentAns || {})[k] === correctM[k]);
          if (isMatchAll) autoScore += 25;
        }
        if (q.tipe === "essay") {
          essayInputs += `
          <div style="margin-top:12px; padding:14px; background:var(--paper); border:1px solid var(--line); border-left:3px solid var(--badge-essay); border-radius:10px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px">
              <span class="badge badge-essay">ESSAY MANUAL</span>
              <span style="font-size:11.5px; color:var(--ink-3)">Maks. 25 Poin</span>
            </div>
            <div style="font-weight:500; color:var(--ink); margin-bottom:6px">${escAttr(
              q.teks
            )}</div>
            <div style="padding:10px; background:var(--surface); border:1px solid var(--line); border-radius:8px; color:var(--ink); margin-bottom:10px">
              <span style="font-size:11.5px; color:var(--ink-3); display:block; margin-bottom:2px">Lembar Jawaban Siswa:</span>
              ${escAttr(studentAns) || "<em>Tidak dijawab</em>"}
            </div>
            <div class="row" style="align-items:center">
              <div style="max-width:140px">
                <label for="essay_${att.id}_${q.id}">Skor Essay (0 - 25)</label>
                <input type="number" id="essay_${att.id}_${
            q.id
          }" value="20" min="0" max="25" style="margin-bottom:0">
              </div>
              <div>
                <label>Catatan Masukan Guru (Opsional)</label>
                <input type="text" placeholder="Berikan umpan balik konstruktif..." style="margin-bottom:0">
              </div>
            </div>
          </div>
        `;
        }
      });

      return `
      <div class="q-card" data-qtype="pg" style="margin-bottom:14px">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px">
          <div style="display:flex; align-items:center; gap:10px">
            <div class="avatar-circle" style="background:var(--surface-high); color:var(--ink)">${String(
              aIdx + 1
            ).padStart(2, "0")}</div>
            <div>
              <h3 style="font-size:14.5px; font-weight:600; color:var(--ink)">Siswa: <code>${escAttr(
                att.uid.slice(0, 8)
              )}</code></h3>
              <span style="font-size:12px; color:var(--ink-2)">Attempt No. ${
                att.attemptNo || 1
              }</span>
            </div>
          </div>
          <span class="badge badge-ok tabular-nums">Auto-Graded (PG/BS/Match): ${autoScore} Poin</span>
        </div>
        ${essayInputs}
      </div>
    `;
    })
    .join("");

  document.getElementById("gr-eval-panel")?.classList.remove("hidden");
}

export async function publishBatchGrades() {
  const code = document.getElementById("gr-code").value.trim();
  if (!code || !currentAttempts.length) return;
  const batch = writeBatch(db);

  currentAttempts.forEach((att) => {
    let autoScore = 0;
    let essayTotal = 0;
    (activeQuizDoc.questions || []).forEach((q) => {
      const studentAns = (att.answers || {})[q.id];
      if (q.tipe === "pg" && studentAns === loadedKeys[q.id]) autoScore += 25;
      if (q.tipe === "bs" && studentAns === loadedKeys[q.id]) autoScore += 25;
      if (q.tipe === "match") {
        const correctM = loadedKeys[q.id] || {};
        if (
          Object.keys(correctM).length &&
          Object.keys(correctM).every((k) => (studentAns || {})[k] === correctM[k])
        ) {
          autoScore += 25;
        }
      }
      if (q.tipe === "essay") {
        const el = document.getElementById(`essay_${att.id}_${q.id}`);
        essayTotal += el ? parseInt(el.value, 10) || 0 : 0;
      }
    });

    const totalScore = autoScore + essayTotal;
    const resRef = doc(db, "results", att.id);
    batch.set(resRef, {
      uid: att.uid,
      quizId: code,
      totalScore,
      autoGradedScore: autoScore,
      essayScore: essayTotal,
      isFullyGraded: true,
      gradedAt: Timestamp.now(),
      revisionNo: 1
    });
  });

  await batch.commit();
  alert(`Berhasil menerbitkan nilai batch untuk ${currentAttempts.length} siswa!`);
  showToast(`Nilai ujian ${code} sukses dipublikasikan.`);
}

export function initKoreksi() {
  window._stepStudent = stepStudent;
  document.getElementById("btn-gr-fetch")?.addEventListener("click", fetchAttemptsForGrading);
  document.getElementById("btn-gr-publish")?.addEventListener("click", publishBatchGrades);
}
