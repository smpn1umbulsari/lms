// Student Asesmen (Quiz List & Launcher) Feature
import { db, doc, getDoc } from "../core/firebase.js";
import { escAttr } from "../core/dom.js";

export async function loadAsesmen(currentUser, userProfile, onStartQuiz, classMeta = null) {
  if (!userProfile?.kelas) return;
  let quizzesMeta = classMeta?.quizzes;
  if (!quizzesMeta) {
    try {
      const metaSnap = await getDoc(doc(db, "classes", userProfile.kelas));
      quizzesMeta = metaSnap.exists() && metaSnap.data().quizzes ? metaSnap.data().quizzes : {};
    } catch (e) {
      quizzesMeta = {};
    }
  }
  const el = document.getElementById("asesmen-list");
  const keys = Object.keys(quizzesMeta);
  const stAs = document.getElementById("st-count-asesmen");
  if (stAs) stAs.textContent = keys.length;

  if (keys.length) {
    const firstQid = keys[0];
    const firstQ = quizzesMeta[firstQid];
    const ctaTitle = document.getElementById("hero-cta-title");
    const ctaMeta = document.getElementById("hero-cta-meta");
    if (ctaTitle) ctaTitle.textContent = firstQ.judul || `Asesmen Terjadwal (${firstQid})`;
    if (ctaMeta) ctaMeta.textContent = `Durasi ${firstQ.duration} Menit · Siap Dikerjakan`;
  }

  if (!el) return;
  if (!keys.length) {
    el.innerHTML = `<div class="notice notice-warn">Belum ada asesmen yang dijadwalkan.</div>`;
    return;
  }

  el.innerHTML = keys
    .map((qid) => {
      const q = quizzesMeta[qid];
      return `
      <div class="card">
        <div>
          <span class="badge badge-pg" style="margin-bottom:6px">CBT Online</span>
          <h3>${escAttr(q.judul || qid)}</h3>
          <p class="tabular-nums" style="font-size:12.5px; color:var(--ink-2)">Kode: <code>${escAttr(
            qid
          )}</code> · Durasi: ${q.duration} menit · Versi ${q.version}</p>
        </div>
        <div class="card-meta">
          <span class="badge badge-bs">Siap</span>
          <button class="btn btn-primary" style="min-height:34px; padding:6px 14px; font-size:12.5px" data-qid="${escAttr(
            qid
          )}">Mulai Kerjakan</button>
        </div>
      </div>
    `;
    })
    .join("");

  el.querySelectorAll("button[data-qid]").forEach((btn) => {
    btn.onclick = () => {
      const qid = btn.getAttribute("data-qid");
      if (typeof onStartQuiz === "function") {
        onStartQuiz(qid, quizzesMeta);
      }
    };
  });
}
