// Student Portal Main Entry Point
import { db, doc, getDoc } from "../core/firebase.js";
import { mountPartials } from "../core/partials.js";
import { initTheme } from "../core/theme.js";
import { initToast, showToast } from "../core/toast.js";
import { initForgotPassword } from "../core/auth-reset.js";
import { registerServiceWorker } from "../core/pwa.js";
import { initGlobalErrorObserver } from "../core/error-handler.js";
import { initStudentAuth } from "./auth.js";
import { loadMateri, initMateriSearch } from "./materi.js";
import { loadTugas, initTugasHandlers } from "./tugas.js";
import { loadAsesmen, fetchStudentQuizStatuses, applyHeroCta } from "./asesmen.js";
import { startQuiz, initExamRunnerControls, getActiveExamId } from "./exam-runner.js";
import { loadNilai, initNilaiHandlers } from "./nilai.js";
import { flushPendingAttempts } from "./exam-sync.js";

let currentUser = null;
let userProfile = null;
let cachedClassMeta = null;
const loadedStudentTabs = new Set();

async function getClassMeta() {
  if (cachedClassMeta && cachedClassMeta.id === userProfile?.kelas) return cachedClassMeta;
  if (!userProfile?.kelas) return null;
  try {
    const snap = await getDoc(doc(db, "classes", userProfile.kelas));
    if (snap.exists()) {
      cachedClassMeta = { id: userProfile.kelas, ...snap.data() };
      return cachedClassMeta;
    }
  } catch (e) {
    console.warn("Gagal memuat data kelas:", e);
  }
  return null;
}

function launchStudentQuiz(qid, quizzesMeta, meta) {
  startQuiz(qid, currentUser, userProfile, quizzesMeta, () => {
    loadedStudentTabs.delete("sec-nilai");
    loadedStudentTabs.delete("tab-asesmen");
    loadAsesmen(currentUser, userProfile, (id, m) => launchStudentQuiz(id, m, meta), meta, activateStudentTab);
  });
}

export async function loadStudentTab(tabId) {
  if (!currentUser || !userProfile) return;
  const meta = await getClassMeta();
  if (meta?.quizzes) {
    const stAs = document.getElementById("st-count-asesmen");
    if (stAs) stAs.textContent = Object.keys(meta.quizzes).length;
    if (tabId !== "tab-asesmen") {
      fetchStudentQuizStatuses(currentUser.uid, meta.quizzes).then((stMap) => {
        applyHeroCta(meta.quizzes, stMap, (qid, qm) => launchStudentQuiz(qid, qm, meta), activateStudentTab);
      });
    }
  }

  if (tabId === "tab-materi" && !loadedStudentTabs.has("tab-materi")) {
    await loadMateri(userProfile, meta);
    loadedStudentTabs.add("tab-materi");
  } else if (tabId === "tab-tugas" && !loadedStudentTabs.has("tab-tugas")) {
    await loadTugas(currentUser, userProfile);
    loadedStudentTabs.add("tab-tugas");
  } else if (tabId === "tab-asesmen" && !loadedStudentTabs.has("tab-asesmen")) {
    await loadAsesmen(currentUser, userProfile, (qid, qm) => launchStudentQuiz(qid, qm, meta), meta, activateStudentTab);
    loadedStudentTabs.add("tab-asesmen");
  } else if (tabId === "sec-nilai" && !loadedStudentTabs.has("sec-nilai")) {
    const ok = await loadNilai(currentUser, userProfile);
    if (ok) loadedStudentTabs.add("sec-nilai");
  }
}

export function activateStudentTab(tabId) {
  document.querySelectorAll(".tab-btn, .mobile-nav-btn").forEach((t) =>
    t.classList.toggle("active", t.dataset.tab === tabId)
  );
  document.querySelectorAll(".tab-content").forEach((c) =>
    c.classList.toggle("hidden", c.id !== tabId)
  );
  const tabLabels = {
    "tab-materi": "Materi Pelajaran",
    "tab-tugas": "Tugas Sekolah",
    "tab-asesmen": "Daftar Ujian",
    "sec-nilai": "Daftar Nilai"
  };
  const crumbEl = document.getElementById("crumb-section");
  if (crumbEl) crumbEl.textContent = tabLabels[tabId] || "Portal Belajar";
  loadStudentTab(tabId);
}

function enterStudentDashboard(user, profile) {
  currentUser = user;
  userProfile = profile;
  const uName = document.getElementById("u-name");
  const uClass = document.getElementById("u-class");
  const uAvatar = document.getElementById("u-avatar");
  const heroName = document.getElementById("hero-student-name");

  if (uName) uName.textContent = userProfile.nama;
  if (uClass) uClass.textContent = `(${userProfile.kelas})`;
  if (uAvatar) uAvatar.textContent = (userProfile.nama || "S").charAt(0).toUpperCase();
  if (heroName) heroName.textContent = `${userProfile.nama} · Kelas ${userProfile.kelas}`;

  document.body.classList.remove("auth-mode");
  document.getElementById("student-topbar")?.classList.remove("hidden");
  document.getElementById("user-info")?.classList.remove("hidden");
  document.getElementById("sec-login")?.classList.add("hidden");
  document.getElementById("sec-nis")?.classList.add("hidden");
  document.getElementById("sec-dashboard")?.classList.remove("hidden");
  document.getElementById("mobile-student-nav")?.classList.remove("hidden");

  flushPendingAttempts(currentUser, () => {
    loadedStudentTabs.delete("tab-asesmen");
    loadedStudentTabs.delete("sec-nilai");
  });

  const activeQuizId = getActiveExamId();
  if (activeQuizId) {
    getClassMeta().then((meta) => {
      if (meta?.quizzes?.[activeQuizId]) {
        showToast("Melanjutkan sesi ujian aktif...", "ok");
        launchStudentQuiz(activeQuizId, meta.quizzes, meta);
      } else {
        loadStudentTab("tab-materi");
      }
    });
    return;
  }
  loadStudentTab("tab-materi");
}

async function boot() {
  initTheme();
  initToast();
  initGlobalErrorObserver();
  registerServiceWorker();
  await mountPartials();

  initForgotPassword();
  initMateriSearch();
  initExamRunnerControls();
  initNilaiHandlers();
  initTugasHandlers(
    () => currentUser,
    () => {
      loadedStudentTabs.delete("sec-nilai");
      loadTugas(currentUser, userProfile);
    }
  );

  document.querySelectorAll(".tab-btn, .mobile-nav-btn").forEach((b) => {
    b.addEventListener("click", () => activateStudentTab(b.dataset.tab));
  });

  document.addEventListener("click", (e) => {
    const switchBtn = e.target.closest("[data-action='switch-tab']");
    if (switchBtn?.dataset.tab) activateStudentTab(switchBtn.dataset.tab);
  });

  initStudentAuth({
    onEnterDashboard: enterStudentDashboard,
    onSignedOut: () => {
      currentUser = null;
      userProfile = null;
      cachedClassMeta = null;
      loadedStudentTabs.clear();
    }
  });
}

boot().catch((err) => {
  console.error(err);
  showToast("Gagal memuat komponen portal siswa", "err");
});
