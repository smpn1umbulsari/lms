// Student Portal Main Entry Point
import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  serverTimestamp
} from "../core/firebase.js";
import { initTheme } from "../core/theme.js";
import { initToast } from "../core/toast.js";
import { loadMateri, initMateriSearch } from "./materi.js";
import { loadTugas, initTugasHandlers } from "./tugas.js";
import { loadAsesmen } from "./asesmen.js";
import { startQuiz, initExamRunnerControls } from "./exam-runner.js";
import { loadNilai } from "./nilai.js";

let currentUser = null;
let userProfile = null;
let nilaiLoaded = false;

// Initialize theme and toast
initTheme();
initToast();
initMateriSearch();
initExamRunnerControls();
initTugasHandlers(
  () => currentUser,
  () => {
    nilaiLoaded = false;
    loadTugas(currentUser, userProfile);
  }
);

// Tab Navigation
export function activateStudentTab(tabId) {
  document
    .querySelectorAll(".tab-btn")
    .forEach((t) => t.classList.toggle("active", t.dataset.tab === tabId));
  document
    .querySelectorAll(".mobile-nav-btn")
    .forEach((t) => t.classList.toggle("active", t.dataset.tab === tabId));
  document
    .querySelectorAll(".tab-content")
    .forEach((c) => c.classList.toggle("hidden", c.id !== tabId));

  if (tabId === "sec-nilai" && !nilaiLoaded && currentUser && userProfile) {
    loadNilai(currentUser, userProfile).then((ok) => {
      if (ok) nilaiLoaded = true;
    });
  }
}

document.querySelectorAll(".tab-btn").forEach((b) => {
  b.onclick = () => activateStudentTab(b.dataset.tab);
});
document.querySelectorAll(".mobile-nav-btn").forEach((b) => {
  b.onclick = () => activateStudentTab(b.dataset.tab);
});

function refreshAllData() {
  if (!currentUser || !userProfile) return;
  loadMateri(userProfile);
  loadTugas(currentUser, userProfile);
  loadAsesmen(currentUser, userProfile, (qid, quizzesMeta) => {
    startQuiz(qid, currentUser, userProfile, quizzesMeta, () => {
      nilaiLoaded = false;
      loadAsesmen(currentUser, userProfile);
    });
  });
}

// Auth State Changed
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    nilaiLoaded = false;
    const udoc = await getDoc(doc(db, "users", user.uid));
    if (udoc.exists()) {
      userProfile = udoc.data();
    } else {
      userProfile = { nama: user.email.split("@")[0], kelas: "c1" };
      await setDoc(doc(db, "users", user.uid), {
        ...userProfile,
        createdAt: serverTimestamp()
      });
    }

    const uName = document.getElementById("u-name");
    const uClass = document.getElementById("u-class");
    const uAvatar = document.getElementById("u-avatar");
    const heroName = document.getElementById("hero-student-name");

    if (uName) uName.textContent = userProfile.nama;
    if (uClass) uClass.textContent = `(${userProfile.kelas})`;
    if (uAvatar) uAvatar.textContent = userProfile.nama.charAt(0).toUpperCase();
    if (heroName) heroName.textContent = `${userProfile.nama} · Kelas ${userProfile.kelas}`;

    document.getElementById("user-info")?.classList.remove("hidden");
    document.getElementById("sec-login")?.classList.add("hidden");
    document.getElementById("sec-dashboard")?.classList.remove("hidden");
    document.getElementById("mobile-student-nav")?.classList.remove("hidden");

    refreshAllData();
  } else {
    currentUser = null;
    userProfile = null;
    nilaiLoaded = false;
    document.getElementById("user-info")?.classList.add("hidden");
    document.getElementById("sec-login")?.classList.remove("hidden");
    document.getElementById("sec-dashboard")?.classList.add("hidden");
    document.getElementById("sec-exam")?.classList.add("hidden");
    document.getElementById("mobile-student-nav")?.classList.add("hidden");
  }
});

// Login & Logout
document.getElementById("btn-login")?.addEventListener("click", async () => {
  const email = (document.getElementById("l-email")?.value || "").trim();
  const pass = document.getElementById("l-pass")?.value || "";
  const errBox = document.getElementById("login-err");
  if (errBox) errBox.classList.add("hidden");
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    if (errBox) {
      errBox.textContent = "Login gagal: " + e.message;
      errBox.classList.remove("hidden");
    }
  }
});

document.getElementById("btn-logout")?.addEventListener("click", () => signOut(auth));
