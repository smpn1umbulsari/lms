// Student Asesmen (Status Jendela Jujur + Hero CTA Akurat)
import { db, doc, getDoc, getDocs, collection, query, where } from "../core/firebase.js";
import { escAttr } from "../core/dom.js";
import { getQuizStatus, tsToMs } from "../shared/quiz-utils.js";

function fmtDateTime(v) {
  const ms = tsToMs(v);
  if (!ms) return "-";
  return new Date(ms).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function applyHeroCta(quizzesMeta, statusByQid, onStartQuiz, onFallbackTab) {
  const heroBtn = document.getElementById("hero-cta-btn");
  const ctaTitle = document.getElementById("hero-cta-title");
  const ctaMeta = document.getElementById("hero-cta-meta");
  const ctaBadge = document.getElementById("hero-cta-badge");
  const keys = Object.keys(quizzesMeta || {});
  const runnableQid = keys.find((qid) => statusByQid[qid]?.canStart);

  if (runnableQid) {
    const q = quizzesMeta[runnableQid];
    const st = statusByQid[runnableQid];
    if (ctaBadge) { ctaBadge.textContent = st.label; ctaBadge.className = `badge ${st.badgeClass}`; }
    if (ctaTitle) ctaTitle.textContent = q.judul || runnableQid;
    if (ctaMeta) ctaMeta.textContent = `Durasi ${q.duration} Menit · Tutup ${fmtDateTime(q.closeAt)}`;
    if (heroBtn) {
      heroBtn.innerHTML = `<span>${escAttr(st.buttonLabel)}</span><span class="material-symbols-outlined" style="font-size:17px">arrow_forward</span>`;
      heroBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onStartQuiz?.(runnableQid, quizzesMeta);
      };
    }
    return;
  }

  const upcomingQid = keys.find((qid) => statusByQid[qid]?.code === "belum_dibuka");
  if (upcomingQid) {
    const q = quizzesMeta[upcomingQid];
    if (ctaBadge) { ctaBadge.textContent = "Jadwal Berikutnya"; ctaBadge.className = "badge badge-neutral"; }
    if (ctaTitle) ctaTitle.textContent = q.judul || upcomingQid;
    if (ctaMeta) ctaMeta.textContent = `Dibuka: ${fmtDateTime(q.openAt)} · Tutup: ${fmtDateTime(q.closeAt)}`;
  } else {
    if (ctaBadge) { ctaBadge.textContent = "Agenda Belajar"; ctaBadge.className = "badge badge-neutral"; }
    if (ctaTitle) ctaTitle.textContent = "Pelajari Materi & Kerjakan Tugas Kelas Anda";
    if (ctaMeta) ctaMeta.textContent = keys.length ? "Tidak ada ujian terbuka saat ini" : "Belum ada jadwal ujian aktif";
  }

  if (heroBtn) {
    heroBtn.innerHTML = `<span>Buka Daftar Ujian</span><span class="material-symbols-outlined" style="font-size:17px">arrow_forward</span>`;
    heroBtn.onclick = () => onFallbackTab?.("tab-asesmen");
  }
}

export async function fetchStudentQuizStatuses(uid, quizzesMeta) {
  const keys = Object.keys(quizzesMeta || {});
  if (!uid || !keys.length) return {};
  const [stSnap, attSnap, resSnap] = await Promise.all([
    getDocs(query(collection(db, "starts"), where("uid", "==", uid))).catch(() => ({ docs: [] })),
    getDocs(query(collection(db, "attempts"), where("uid", "==", uid))).catch(() => ({ docs: [] })),
    getDocs(query(collection(db, "results"), where("uid", "==", uid))).catch(() => ({ docs: [] }))
  ]);

  const startsByQ = {};
  stSnap.docs.forEach((d) => { const x = d.data(); if (x.quizId) (startsByQ[x.quizId] ||= []).push(x); });
  const attsByQ = {};
  attSnap.docs.forEach((d) => { const x = d.data(); if (x.quizId) (attsByQ[x.quizId] ||= []).push(x); });
  const resSet = new Set(resSnap.docs.map((d) => d.data()?.quizId).filter(Boolean));

  const nowMs = Date.now();
  const out = {};
  keys.forEach((qid) => {
    const stList = startsByQ[qid] || [];
    const attList = attsByQ[qid] || [];
    const submittedCount = attList.filter((a) => a.submittedAt != null).length;
    const latestStart = stList.sort((a, b) => (b.attemptNo || 1) - (a.attemptNo || 1))[0];
    const deadlineMs = latestStart?.startedAt ? tsToMs(latestStart.startedAt) + Number(latestStart.duration || 60) * 60000 : 0;
    out[qid] = getQuizStatus(quizzesMeta[qid], nowMs, {
      started: stList.length > submittedCount,
      submitted: submittedCount > 0,
      submittedCount,
      deadlineMs,
      graded: resSet.has(qid)
    });
  });
  return out;
}

export async function loadAsesmen(currentUser, userProfile, onStartQuiz, classMeta = null, onFallbackTab = null) {
  if (!userProfile?.kelas) return;
  let quizzesMeta = classMeta?.quizzes;
  if (!quizzesMeta) {
    try {
      const metaSnap = await getDoc(doc(db, "classes", userProfile.kelas));
      quizzesMeta = metaSnap.exists() && metaSnap.data().quizzes ? metaSnap.data().quizzes : {};
    } catch (e) { quizzesMeta = {}; }
  }

  const keys = Object.keys(quizzesMeta);
  const stAs = document.getElementById("st-count-asesmen");
  if (stAs) stAs.textContent = keys.length;

  const statusByQid = await fetchStudentQuizStatuses(currentUser?.uid, quizzesMeta);
  applyHeroCta(quizzesMeta, statusByQid, onStartQuiz, onFallbackTab);

  const el = document.getElementById("asesmen-list");
  if (!el) return;
  if (!keys.length) {
    el.innerHTML = `<div class="notice notice-warn">Belum ada ujian atau latihan yang dijadwalkan.</div>`;
    return;
  }

  el.innerHTML = keys.map((qid) => {
    const q = quizzesMeta[qid];
    const st = statusByQid[qid] || getQuizStatus(q, Date.now());
    const btnAttr = st.canStart ? `data-qid="${escAttr(qid)}"` : "disabled aria-disabled=\"true\"";
    return `
      <div class="card">
        <div>
          <span class="badge badge-pg" style="margin-bottom:6px">${q.mode === "ujian" ? "Ujian Resmi" : "Latihan"}</span>
          <h3>${escAttr(q.judul || qid)}</h3>
          <p class="tabular-nums" style="font-size:12.5px; color:var(--ink-2)">
            Durasi: ${q.duration} menit · Buka: ${escAttr(fmtDateTime(q.openAt))} · Tutup: ${escAttr(fmtDateTime(q.closeAt))}
          </p>
        </div>
        <div class="card-meta">
          <span class="badge ${st.badgeClass}">${escAttr(st.label)}</span>
          <button type="button" class="btn ${st.canStart ? "btn-primary" : "btn-secondary"}" style="min-height:34px; padding:6px 14px; font-size:12.5px" ${btnAttr}>${escAttr(st.buttonLabel)}</button>
        </div>
      </div>`;
  }).join("");

  el.querySelectorAll("button[data-qid]").forEach((btn) => {
    btn.onclick = () => onStartQuiz?.(btn.getAttribute("data-qid"), quizzesMeta);
  });
}
