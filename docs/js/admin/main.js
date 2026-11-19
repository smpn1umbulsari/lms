// Admin Portal Main Entry Point
import {
  auth,
  db,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "../core/firebase.js";
import { initTheme } from "../core/theme.js";
import { initToast, showToast } from "../core/toast.js";
import { initForgotPassword } from "../core/auth-reset.js";
import { initDemoChips } from "../core/env.js";
import { registerServiceWorker } from "../core/pwa.js";
import { initGlobalErrorObserver } from "../core/error-handler.js";
import { loadRingkasan, updateActivityFeed } from "./ringkasan.js";
import { loadMateriTable, initMateriHandlers, getMateriData } from "./materi.js";
import { loadTugasTable, initTugasHandlers, getTugasData } from "./tugas.js";
import { loadAsesmenTable, initAsesmenHandlers, getAsesmenData } from "./asesmen.js";
import { initQBuilder, renderQBuilder } from "./qbuilder.js";
import { initQPreview } from "./qpreview.js";
import { initKoreksi, populateGradingQuizSelect, fetchAttemptsForGrading } from "./koreksi.js";
import { initCSVExport } from "./export-csv.js";
import { initImportExport } from "./import-export.js";

// Initialize core utilities
initTheme();
initToast();
initForgotPassword();
initGlobalErrorObserver();
initDemoChips();
registerServiceWorker();

// Quick Class Chip Helper
export function toggleQuickClass(inputId, clsName) {
  const el = document.getElementById(inputId);
  if (!el) return;
  const parts = el.value.split(",").map((s) => s.trim()).filter(Boolean);
  const idx = parts.findIndex((p) => p.toLowerCase() === clsName.toLowerCase());
  if (idx >= 0) parts.splice(idx, 1);
  else parts.push(clsName);
  el.value = parts.join(", ");
}

document.querySelectorAll("[data-action='toggle-class']").forEach((btn) => {
  btn.addEventListener("click", () => {
    toggleQuickClass(btn.dataset.target, btn.dataset.class);
  });
});

export function log(m) {
  const el = document.getElementById("log");
  if (el) el.textContent = `[${new Date().toLocaleTimeString()}] ${m}\n` + el.textContent;
  showToast(m);
}
window.log = log;

const loadedAdminTabs = new Set();

export function invalidateAdminTab(tabId) {
  if (tabId) loadedAdminTabs.delete(tabId);
  else loadedAdminTabs.clear();
}

function refreshActivity() {
  updateActivityFeed(getMateriData(), getTugasData(), getAsesmenData());
}

// Router & Tab Switching
export function switchAdminTab(tabId, forceReload = false) {
  document
    .querySelectorAll(".nav-btn, .mobile-nav-btn, .mobile-nav-item")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId));
  document
    .querySelectorAll(".tab-pane")
    .forEach((p) => p.classList.toggle("hidden", p.id !== tabId));

  const toggleInput = document.getElementById("sidebar-toggle");
  if (toggleInput) toggleInput.checked = false;

  const labels = {
    "sec-ringkasan": "Ringkasan Dashboard",
    "sec-materi": "Materi Pembelajaran",
    "sec-tugas": "Penugasan Siswa",
    "sec-asesmen": "Asesmen & Bank Soal",
    "sec-grading": "Penilaian & Koreksi",
    "sec-import": "Import / Export Excel"
  };
  const titleEl = document.getElementById("current-page-title");
  if (titleEl) titleEl.textContent = "Portal Guru · " + (labels[tabId] || "Dashboard");
  const crumbEl = document.getElementById("crumb-section");
  if (crumbEl) crumbEl.textContent = labels[tabId] || "Portal Guru";

  if (tabId === "sec-ringkasan") {
    loadRingkasan();
  } else if (tabId === "sec-materi" && (forceReload || !loadedAdminTabs.has("sec-materi"))) {
    loadMateriTable(() => {
      loadedAdminTabs.add("sec-materi");
      refreshActivity();
    });
  } else if (tabId === "sec-tugas" && (forceReload || !loadedAdminTabs.has("sec-tugas"))) {
    loadTugasTable(() => {
      loadedAdminTabs.add("sec-tugas");
      refreshActivity();
    });
  } else if (tabId === "sec-asesmen" && (forceReload || !loadedAdminTabs.has("sec-asesmen"))) {
    loadAsesmenTable(() => {
      loadedAdminTabs.add("sec-asesmen");
      refreshActivity();
    });
  } else if (tabId === "sec-grading" && (forceReload || !loadedAdminTabs.has("sec-grading"))) {
    populateGradingQuizSelect().then(() => loadedAdminTabs.add("sec-grading"));
  }
}
window.switchAdminTab = switchAdminTab;

document.querySelectorAll(".nav-btn, .mobile-nav-btn, .mobile-nav-item").forEach((b) => {
  b.addEventListener("click", () => switchAdminTab(b.dataset.tab));
});

document.addEventListener("click", (e) => {
  const switchBtn = e.target.closest("[data-action='switch-tab']");
  if (switchBtn && switchBtn.dataset.tab) {
    switchAdminTab(switchBtn.dataset.tab);
  }
  const expBtn = e.target.closest("[data-action='export-tugas-csv']");
  if (expBtn) {
    document.getElementById("btn-export-tugas-csv")?.click();
  }
});

// Initialize Handlers
initMateriHandlers(refreshActivity);
initTugasHandlers(refreshActivity);
initAsesmenHandlers(refreshActivity, async (code) => {
  switchAdminTab("sec-grading");
  await populateGradingQuizSelect(code);
  loadedAdminTabs.add("sec-grading");
  await fetchAttemptsForGrading(false);
});
initQBuilder((code) => {
  log(`Asesmen ${code} tersimpan.`);
  loadedAdminTabs.delete("sec-asesmen");
  loadedAdminTabs.delete("sec-grading");
  loadAsesmenTable(() => {
    loadedAdminTabs.add("sec-asesmen");
    refreshActivity();
  });
  loadRingkasan();
});
initQPreview();
initKoreksi();
initCSVExport();
initImportExport();
renderQBuilder();

// Role Switcher on Admin Login
export function setAdminLoginRole(role) {
  if (role === "siswa") {
    showToast("Mengarahkan ke Portal Siswa...", "ok");
    setTimeout(() => {
      window.location.href = "index.html";
    }, 400);
  }
}
document.querySelectorAll("[data-action='set-role']").forEach((btn) => {
  btn.addEventListener("click", () => setAdminLoginRole(btn.dataset.role));
});

// Auth State Changed
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const adminSnap = await getDoc(doc(db, "admins", user.uid)).catch(() => null);
    if (!adminSnap || !adminSnap.exists()) {
      const emailKey = (user.email || "").trim().toLowerCase();
      const inviteSnap = emailKey ? await getDoc(doc(db, "guruInvites", emailKey)).catch(() => null) : null;
      if (inviteSnap && inviteSnap.exists() && inviteSnap.data().aktif === true) {
        const inv = inviteSnap.data();
        await setDoc(doc(db, "admins", user.uid), {
          email: emailKey,
          nama: inv.nama || emailKey.split("@")[0],
          nip: inv.nip || "",
          mapel: inv.mapel || "",
          role: "guru",
          activatedAt: serverTimestamp()
        });
        showToast("Akun Guru berhasil diaktivasi!", "ok");
      } else {
        showToast("Akun Siswa terdeteksi. Mengarahkan ke Portal Siswa...", "ok");
        setTimeout(() => {
          window.location.href = "index.html";
        }, 700);
        return;
      }
    }
    document.body.classList.remove("auth-mode");
    document.getElementById("sec-auth")?.classList.add("hidden");
    document.getElementById("app-content")?.classList.remove("hidden");
    document.getElementById("sidebar")?.classList.remove("hidden");
    document.getElementById("mobile-nav")?.classList.remove("hidden");
    document.getElementById("admin-topbar")?.classList.remove("hidden");

    const uDisplay = document.getElementById("u-display");
    if (uDisplay) uDisplay.textContent = user.email;
    const hEmail = document.getElementById("header-user-email");
    if (hEmail) hEmail.textContent = user.email;
    const hAvatar = document.getElementById("header-avatar");
    if (hAvatar && user.email) hAvatar.textContent = user.email.charAt(0).toUpperCase();
    const sAvatar = document.getElementById("sidebar-avatar");
    if (sAvatar && user.email) sAvatar.textContent = user.email.charAt(0).toUpperCase();

    loadedAdminTabs.clear();
    loadRingkasan();
  } else {
    loadedAdminTabs.clear();
    document.body.classList.add("auth-mode");
    document.getElementById("sec-auth")?.classList.remove("hidden");
    document.getElementById("app-content")?.classList.add("hidden");
    document.getElementById("sidebar")?.classList.add("hidden");
    document.getElementById("mobile-nav")?.classList.add("hidden");
    document.getElementById("admin-topbar")?.classList.add("hidden");
  }
});

// Login and Logout
document.getElementById("btn-login")?.addEventListener("click", async () => {
  const email = (document.getElementById("l-email")?.value || "").trim();
  const pass = document.getElementById("l-pass")?.value || "";
  const errEl = document.getElementById("auth-err");
  if (errEl) errEl.classList.add("hidden");
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    if (errEl) {
      errEl.textContent = "Login gagal: " + e.message;
      errEl.classList.remove("hidden");
    }
    showToast("Login gagal. Periksa kembali email & kata sandi.", "error");
  }
});

document.querySelectorAll("#btn-logout, #btn-header-logout, .btn-logout-icon").forEach((b) => {
  b.addEventListener("click", () => signOut(auth));
});
