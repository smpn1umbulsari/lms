// Student Portal Main Entry Point
import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  serverTimestamp
} from "../core/firebase.js";
import { initTheme } from "../core/theme.js";
import { initToast, showToast } from "../core/toast.js";
import { initDemoChips, isDev } from "../core/env.js";
import { loadMateri, initMateriSearch } from "./materi.js";
import { loadTugas, initTugasHandlers } from "./tugas.js";
import { loadAsesmen } from "./asesmen.js";
import { startQuiz, initExamRunnerControls } from "./exam-runner.js";
import { loadNilai, initNilaiHandlers } from "./nilai.js";

let currentUser = null;
let userProfile = null;
let nilaiLoaded = false;

// Initialize theme and toast
initTheme();
initToast();
initDemoChips();
initMateriSearch();
initExamRunnerControls();
initNilaiHandlers();
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

  const tabLabels = {
    "tab-materi": "Materi Pembelajaran",
    "tab-tugas": "Penugasan Siswa",
    "tab-asesmen": "Asesmen & CBT",
    "sec-nilai": "Rekapitulasi Nilai"
  };
  const crumbEl = document.getElementById("crumb-section");
  if (crumbEl) crumbEl.textContent = tabLabels[tabId] || "Portal Belajar";

  if (tabId === "sec-nilai" && !nilaiLoaded && currentUser && userProfile) {
    loadNilai(currentUser, userProfile).then((ok) => {
      if (ok) nilaiLoaded = true;
    });
  }
}

document.querySelectorAll(".tab-btn, .mobile-nav-btn").forEach((b) => {
  b.addEventListener("click", () => activateStudentTab(b.dataset.tab));
});

document.addEventListener("click", (e) => {
  const switchBtn = e.target.closest("[data-action='switch-tab']");
  if (switchBtn && switchBtn.dataset.tab) {
    activateStudentTab(switchBtn.dataset.tab);
  }
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

function enterStudentDashboard() {
  const uName = document.getElementById("u-name");
  const uClass = document.getElementById("u-class");
  const uAvatar = document.getElementById("u-avatar");
  const heroName = document.getElementById("hero-student-name");

  if (uName) uName.textContent = userProfile.nama;
  if (uClass) uClass.textContent = `(${userProfile.kelas})`;
  if (uAvatar) uAvatar.textContent = (userProfile.nama || "S").charAt(0).toUpperCase();
  if (heroName) heroName.textContent = `${userProfile.nama} Â· Kelas ${userProfile.kelas}`;

  document.body.classList.remove("auth-mode");
  document.getElementById("student-topbar")?.classList.remove("hidden");
  document.getElementById("user-info")?.classList.remove("hidden");
  document.getElementById("sec-login")?.classList.add("hidden");
  document.getElementById("sec-nis")?.classList.add("hidden");
  document.getElementById("sec-dashboard")?.classList.remove("hidden");
  document.getElementById("mobile-student-nav")?.classList.remove("hidden");

  refreshAllData();
}

export function setLoginRole(role) {
  const btnSiswa = document.getElementById("btn-role-siswa");
  const btnGuru = document.getElementById("btn-role-guru");
  const title = document.getElementById("auth-title");
  const sub = document.getElementById("auth-sub");
  const lblEmail = document.getElementById("lbl-email");
  const inEmail = document.getElementById("l-email");
  const btnSubmit = document.getElementById("btn-login");
  const chipContainer = document.getElementById("auth-chips-box");

  if (role === "guru") {
    btnSiswa?.classList.remove("active");
    btnGuru?.classList.add("active");
    if (title) title.textContent = "Login Guru & Pendidik";
    if (sub) sub.textContent = "Sistem Manajemen Pembelajaran SMPN 1 Umbulsari";
    if (lblEmail) lblEmail.textContent = "Email Guru / Admin";
    if (inEmail) inEmail.placeholder = "guru@smpn1umbulsari.sch.id";
    if (btnSubmit) btnSubmit.textContent = "Masuk sebagai Guru →";
    if (chipContainer) {
      if (isDev) {
        chipContainer.classList.remove("hidden");
        chipContainer.innerHTML = `
          <span style="font-size:11px; color:var(--ink-3); align-self:center">Akun Uji Coba:</span>
          <button type="button" class="auth-demo-chip" data-action="fill-demo" data-email="guru@smpn1umbulsari.sch.id" data-pass="admin123">
            🎓 Guru Pengampu
          </button>
          <button type="button" class="auth-demo-chip" data-action="fill-demo" data-email="admin@smpn1umbulsari.sch.id" data-pass="admin123">
            🛡️ Admin Utama
          </button>
        `;
      } else {
        chipContainer.classList.add("hidden");
        chipContainer.innerHTML = "";
      }
    }
  } else {
    btnGuru?.classList.remove("active");
    btnSiswa?.classList.add("active");
    if (title) title.textContent = "Masuk Siswa";
    if (sub) sub.textContent = "Portal Pembelajaran Digital & CBT SMPN 1 Umbulsari";
    if (lblEmail) lblEmail.textContent = "Email Siswa (NISN)";
    if (inEmail) inEmail.placeholder = "nisn@smpn1umbulsari.sch.id";
    if (btnSubmit) btnSubmit.textContent = "Masuk sebagai Siswa →";
    if (chipContainer) {
      if (isDev) {
        chipContainer.classList.remove("hidden");
        chipContainer.innerHTML = `
          <span style="font-size:11px; color:var(--ink-3); align-self:center">Akun Uji Coba:</span>
          <button type="button" class="auth-demo-chip" data-action="fill-demo" data-email="siswa@smpn1umbulsari.sch.id" data-pass="siswa123">
            👤 Siswa Kelas 7 (c1)
          </button>
        `;
      } else {
        chipContainer.classList.add("hidden");
        chipContainer.innerHTML = "";
      }
    }
  }
}
document.querySelectorAll("[data-action='set-role']").forEach((btn) => {
  btn.addEventListener("click", () => setLoginRole(btn.dataset.role));
});

// Auth State Changed
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    nilaiLoaded = false;

    // Smart Role Check: If user is an Admin, redirect to admin.html
    const adminSnap = await getDoc(doc(db, "admins", user.uid)).catch(() => null);
    if (adminSnap && adminSnap.exists()) {
      showToast("Akun Guru terdeteksi. Mengarahkan ke Portal Guru...", "ok");
      setTimeout(() => {
        window.location.href = "admin.html";
      }, 600);
      return;
    }

    const udoc = await getDoc(doc(db, "users", user.uid));
    if (udoc.exists()) {
      userProfile = udoc.data();
      enterStudentDashboard();
    } else {
      document.body.classList.add("auth-mode");
      document.getElementById("sec-login")?.classList.add("hidden");
      document.getElementById("sec-nis")?.classList.remove("hidden");
      document.getElementById("nis-err")?.classList.add("hidden");
    }
  } else {
    currentUser = null;
    userProfile = null;
    nilaiLoaded = false;
    document.body.classList.add("auth-mode");
    document.getElementById("student-topbar")?.classList.add("hidden");
    document.getElementById("user-info")?.classList.add("hidden");
    document.getElementById("sec-login")?.classList.remove("hidden");
    document.getElementById("sec-nis")?.classList.add("hidden");
    document.getElementById("sec-dashboard")?.classList.add("hidden");
    document.getElementById("sec-exam")?.classList.add("hidden");
    document.getElementById("mobile-student-nav")?.classList.add("hidden");
  }
});

// Login, NIS Activation & Logout
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

document.getElementById("btn-submit-nis")?.addEventListener("click", async () => {
  if (!currentUser) return;
  const nis = (document.getElementById("input-nis")?.value || "").trim();
  const errBox = document.getElementById("nis-err");
  const btn = document.getElementById("btn-submit-nis");
  if (errBox) errBox.classList.add("hidden");
  if (!nis) {
    if (errBox) { errBox.textContent = "Masukkan Nomor Induk Siswa (NIS)."; errBox.classList.remove("hidden"); }
    return;
  }
  if (btn) btn.disabled = true;
  try {
    const sRef = doc(db, "siswa", nis);
    const sSnap = await getDoc(sRef);
    if (!sSnap.exists()) throw new Error("NIS tidak ditemukan dalam roster sekolah.");
    const sData = sSnap.data();
    if (sData.claimedBy && sData.claimedBy !== currentUser.uid) {
      throw new Error("NIS ini sudah diklaim oleh akun lain. Hubungi proktor sekolah.");
    }
    await setDoc(doc(db, "users", currentUser.uid), {
      nis,
      nama: sData.nama,
      kelas: sData.kelas,
      createdAt: serverTimestamp()
    });
    if (!sData.claimedBy) {
      await updateDoc(sRef, { claimedBy: currentUser.uid });
    }
    userProfile = { nis, nama: sData.nama, kelas: sData.kelas };
    showToast(`Selamat datang, ${sData.nama}!`, "ok");
    enterStudentDashboard();
  } catch (e) {
    if (errBox) { errBox.textContent = e.message; errBox.classList.remove("hidden"); }
  } finally {
    if (btn) btn.disabled = false;
  }
});

document.querySelectorAll("#btn-logout, #btn-nis-logout, .btn-logout-icon").forEach((b) => {
  b.addEventListener("click", () => signOut(auth));
});
