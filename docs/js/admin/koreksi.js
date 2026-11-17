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
  if (!code) return showToast("Masukkan kode kuis!", "warn");

  const [keySnap, qSnap, attSnap] = await Promise.all([
    getDoc(doc(db, "quizKeys", code)),
    getDoc(doc(db, "quizzes", code)),
    getDocs(query(collection(db, "attempts"), where("quizId", "==", code)))
  ]);

  if (!keySnap.exists()) return showToast("quizKeys tidak ditemukan untuk kuis ini!", "warn");
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
    renderItemAnalysis(activeQuizDoc, currentAttempts, loadedKeys);
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

  renderItemAnalysis(activeQuizDoc, currentAttempts, loadedKeys);
  document.getElementById("gr-eval-panel")?.classList.remove("hidden");
}

export function renderItemAnalysis(quizDoc, attempts, keys) {
  const container = document.getElementById("gr-item-analysis");
  if (!container) return;
  if (!attempts.length || !quizDoc?.questions?.length) {
    container.innerHTML = "";
    return;
  }

  const total = attempts.length;
  const analysis = quizDoc.questions.map((q, idx) => {
    if (q.tipe === "essay") {
      return {
        no: idx + 1,
        tipe: "ESSAY",
        teks: q.teks || "",
        correctCount: null,
        pct: null,
        level: "Koreksi Manual",
        badge: "badge-essay",
        isRemedial: false
      };
    }

    let correctCount = 0;
    attempts.forEach((att) => {
      const ans = (att.answers || {})[q.id];
      if (q.tipe === "pg" || q.tipe === "bs") {
        if (ans && ans === keys[q.id]) correctCount++;
      } else if (q.tipe === "match") {
        const correctM = keys[q.id] || {};
        if (
          Object.keys(correctM).length &&
          Object.keys(correctM).every((k) => (ans || {})[k] === correctM[k])
        ) {
          correctCount++;
        }
      }
    });

    const pct = Math.round((correctCount / total) * 100);
    let level = "Sedang";
    let badge = "badge-pg";
    let isRemedial = false;

    if (pct >= 70) {
      level = "Mudah";
      badge = "badge-ok";
    } else if (pct < 30) {
      level = "Sukar / Remedial";
      badge = "badge-err";
      isRemedial = true;
    }

    return {
      no: idx + 1,
      tipe: q.tipe.toUpperCase(),
      teks: q.teks || "",
      correctCount,
      pct,
      level,
      badge,
      isRemedial
    };
  });

  const remedialItems = analysis.filter((a) => a.isRemedial);
  let remedialAlert = "";
  if (remedialItems.length > 0) {
    const listNos = remedialItems.map((r) => `No. ${r.no} (${r.pct}%)`).join(", ");
    remedialAlert = `
      <div style="padding:10px 14px; margin-bottom:14px; background:rgba(217,45,32,0.08); border-left:4px solid var(--err); border-radius:8px; font-size:12.5px; color:var(--ink)">
        <strong>⚠️ Peringatan Remedial:</strong> Butir soal <strong>${listNos}</strong> dijawab benar oleh &lt; 30% siswa. Disarankan mengadakan pendalaman materi pada butir ini.
      </div>
    `;
  }

  container.innerHTML = `
    <div style="background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:16px; margin-bottom:16px">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px">
        <div>
          <h3 style="font-size:14px; font-weight:600; color:var(--ink)">Analisis Butir Soal & Tingkat Kesulitan</h3>
          <p style="font-size:11.5px; color:var(--ink-2); margin-top:2px">Berdasarkan ${total} lembar jawaban siswa yang masuk</p>
        </div>
        <span class="badge badge-neutral">${quizDoc.questions.length} Butir Soal</span>
      </div>
      ${remedialAlert}
      <div style="overflow-x:auto">
        <table style="width:100%; border-collapse:collapse; font-size:12.5px; text-align:left">
          <thead>
            <tr style="border-bottom:1px solid var(--line); color:var(--ink-2)">
              <th style="padding:6px 8px">No</th>
              <th style="padding:6px 8px">Tipe</th>
              <th style="padding:6px 8px">Ringkasan Butir Soal</th>
              <th style="padding:6px 8px; text-align:center">Benar</th>
              <th style="padding:6px 8px; text-align:center">% Benar</th>
              <th style="padding:6px 8px; text-align:center">Tingkat Kesulitan</th>
            </tr>
          </thead>
          <tbody>
            ${analysis
              .map(
                (a) => `
              <tr style="border-bottom:1px solid var(--line-light, var(--line))">
                <td style="padding:8px; font-weight:600; color:var(--ink)">${a.no}</td>
                <td style="padding:8px"><span class="badge ${
                  a.tipe === "MATCH"
                    ? "badge-match"
                    : a.tipe === "BS"
                    ? "badge-bs"
                    : a.badge
                }">${a.tipe}</span></td>
                <td style="padding:8px; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ink)" title="${escAttr(
                  a.teks
                )}">
                  ${escAttr(a.teks)}
                </td>
                <td style="padding:8px; text-align:center; color:var(--ink)">${
                  a.pct !== null ? `${a.correctCount}/${total}` : "-"
                }</td>
                <td style="padding:8px; text-align:center; font-weight:600; color:var(--ink)">${
                  a.pct !== null ? `${a.pct}%` : "-"
                }</td>
                <td style="padding:8px; text-align:center"><span class="badge ${a.badge}">${
                  a.level
                }</span></td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
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
  showToast(`Nilai ujian ${code} sukses dipublikasikan untuk ${currentAttempts.length} siswa!`, "ok");
}

export function initKoreksi() {
  window._stepStudent = stepStudent;
  document.getElementById("btn-gr-fetch")?.addEventListener("click", fetchAttemptsForGrading);
  document.getElementById("btn-gr-publish")?.addEventListener("click", publishBatchGrades);
}
