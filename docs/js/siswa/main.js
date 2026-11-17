// Student Portal Main Entry Point
import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  limit,
  getDocs,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  serverTimestamp
} from "../core/firebase.js";
import { initTheme } from "../core/theme.js";
import { initToast, showToast } from "../core/toast.js";
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

export function setLoginRole(role) {
  const btnSiswa = document.getElementById("btn-role-siswa");
  const btnGuru = document.getElementById("btn-role-guru");
  const title = document.getElementById("auth-title");
  const sub = document.getElementById("auth-sub");
  const lblEmail = document.getElementById("lbl-email");
  const inEmail = document.getElementById("l-email");
  const inPass = document.getElementById("l-pass");
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
      chipContainer.innerHTML = `
        <span style="font-size:11px; color:var(--ink-3); align-self:center">Akun Uji Coba:</span>
        <button type="button" class="auth-demo-chip" onclick="document.getElementById('l-email').value='guru@smpn1umbulsari.sch.id'; document.getElementById('l-pass').value='admin123';">
          🎓 Guru Pengampu
        </button>
        <button type="button" class="auth-demo-chip" onclick="document.getElementById('l-email').value='admin@smpn1umbulsari.sch.id'; document.getElementById('l-pass').value='admin123';">
          🛡️ Admin Utama
        </button>
      `;
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
      chipContainer.innerHTML = `
        <span style="font-size:11px; color:var(--ink-3); align-self:center">Akun Uji Coba:</span>
        <button type="button" class="auth-demo-chip" onclick="document.getElementById('l-email').value='siswa@smpn1umbulsari.sch.id'; document.getElementById('l-pass').value='siswa123';">
          👤 Siswa Kelas 7 (c1)
        </button>
      `;
    }
  }
}
window._setLoginRole = setLoginRole;

// Render Student Dashboard & Information
function renderStudentUI(profile) {
  const uName = document.getElementById("u-name");
  const uClass = document.getElementById("u-class");
  const uAvatar = document.getElementById("u-avatar");
  const heroName = document.getElementById("hero-student-name");

  if (uName) uName.textContent = profile.nama;
  if (uClass) uClass.textContent = `(${profile.kelas})`;
  if (uAvatar) uAvatar.textContent = profile.nama ? profile.nama.charAt(0).toUpperCase() : "S";
  if (heroName) heroName.textContent = `${profile.nama} · Kelas ${profile.kelas}`;

  document.body.classList.remove("auth-mode");
  document.getElementById("student-topbar")?.classList.remove("hidden");
  document.getElementById("user-info")?.classList.remove("hidden");
  document.getElementById("sec-login")?.classList.add("hidden");
  document.getElementById("sec-nis")?.classList.add("hidden");
  document.getElementById("sec-dashboard")?.classList.remove("hidden");
  document.getElementById("mobile-student-nav")?.classList.remove("hidden");

  refreshAllData();
}

// Show NIS Input Screen
function showNisScreen() {
  document.body.classList.add("auth-mode");
  document.getElementById("student-topbar")?.classList.add("hidden");
  document.getElementById("user-info")?.classList.add("hidden");
  document.getElementById("sec-login")?.classList.add("hidden");
  document.getElementById("sec-dashboard")?.classList.add("hidden");
  document.getElementById("sec-exam")?.classList.add("hidden");
  document.getElementById("sec-result")?.classList.add("hidden");
  document.getElementById("mobile-student-nav")?.classList.add("hidden");

  const secNis = document.getElementById("sec-nis");
  if (secNis) secNis.classList.remove("hidden");

  const nisErr = document.getElementById("nis-err");
  if (nisErr) {
    nisErr.textContent = "";
    nisErr.classList.add("hidden");
  }
  const nisInput = document.getElementById("input-nis");
  if (nisInput) {
    nisInput.value = "";
    nisInput.focus();
  }
}

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
    if (udoc.exists() && udoc.data()?.nis) {
      userProfile = udoc.data();
      renderStudentUI(userProfile);
    } else {
      // ponytail: gerbang NIS hanya aktif kalau roster sudah diisi guru — tanpa data siswa semua akun terkunci
      const rosterProbe = await getDocs(query(collection(db, "siswa"), limit(1))).catch(() => null);
      if (rosterProbe && rosterProbe.empty) {
        const legacy = { nama: user.email.split("@")[0], kelas: "c1" };
        await setDoc(doc(db, "users", user.uid), legacy, { merge: true }).catch(() => {});
        userProfile = { ...legacy, ...(udoc.exists() ? udoc.data() : {}) };
        renderStudentUI(userProfile);
        showToast("Roster siswa belum diisi guru — masuk mode sementara.", "warn");
      } else {
        showNisScreen();
      }
    }
  } else {
    currentUser = null;
    userProfile = null;
    nilaiLoaded = false;
    document.body.classList.add("auth-mode");
    document.getElementById("student-topbar")?.classList.add("hidden");
    document.getElementById("user-info")?.classList.add("hidden");
    document.getElementById("sec-nis")?.classList.add("hidden");
    document.getElementById("sec-login")?.classList.remove("hidden");
    document.getElementById("sec-dashboard")?.classList.add("hidden");
    document.getElementById("sec-exam")?.classList.add("hidden");
    document.getElementById("sec-result")?.classList.add("hidden");
    document.getElementById("mobile-student-nav")?.classList.add("hidden");
  }
});

// Submit NIS Handler
async function handleNisSubmit() {
  if (!currentUser) return;
  const nisInput = document.getElementById("input-nis");
  const nis = (nisInput?.value || "").trim();
  const nisErr = document.getElementById("nis-err");
  const btnSubmit = document.getElementById("btn-submit-nis");

  if (nisErr) {
    nisErr.textContent = "";
    nisErr.classList.add("hidden");
  }

  if (!nis) {
    if (nisErr) {
      nisErr.textContent = "Silakan masukkan NIS.";
      nisErr.classList.remove("hidden");
    }
    return;
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Memverifikasi...";
  }

  try {
    const sSnap = await getDoc(doc(db, "siswa", nis));
    if (!sSnap.exists()) {
      if (nisErr) {
        nisErr.textContent = "NIS tidak terdaftar";
        nisErr.classList.remove("hidden");
      }
      return;
    }

    const roster = sSnap.data() || {};
    if (roster.claimedBy && roster.claimedBy !== currentUser.uid) {
      if (nisErr) {
        nisErr.textContent = "NIS sudah dipakai akun lain, hubungi guru";
        nisErr.classList.remove("hidden");
      }
      return;
    }

    // Bebas: setDoc users/{uid} LALU updateDoc siswa/{nis}
    const profileData = {
      nama: roster.nama,
      kelas: roster.kelas,
      nis,
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, "users", currentUser.uid), profileData);
    await updateDoc(doc(db, "siswa", nis), { claimedBy: currentUser.uid });

    userProfile = profileData;
    renderStudentUI(userProfile);
    showToast(`NIS terverifikasi. Selamat datang, ${roster.nama}!`, "ok");
  } catch (err) {
    if (nisErr) {
      nisErr.textContent = "Terjadi kesalahan: " + err.message;
      nisErr.classList.remove("hidden");
    }
    showToast("Gagal memproses NIS: " + err.message, "error");
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<span>Simpan & Lanjutkan</span><span class="material-symbols-outlined" style="font-size:18px">arrow_forward</span>`;
    }
  }
}

document.getElementById("btn-submit-nis")?.addEventListener("click", handleNisSubmit);
document.getElementById("input-nis")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    handleNisSubmit();
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

document.querySelectorAll("#btn-logout, #btn-nis-logout, .btn-logout-icon").forEach((b) => {
  b.addEventListener("click", () => signOut(auth));
});
