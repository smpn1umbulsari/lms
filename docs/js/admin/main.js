// Admin Portal Main Entry Point (Unified Single-Door Redirect + Tab Orchestration)
import { auth, db, doc, getDoc, onAuthStateChanged, signOut } from "../core/firebase.js";
import { mountPartials } from "../core/partials.js";
import { initTheme } from "../core/theme.js";
import { initToast, showToast } from "../core/toast.js";
import { registerServiceWorker } from "../core/pwa.js";
import { initGlobalErrorObserver } from "../core/error-handler.js";
import { isSuperAdminDoc } from "./import/roster-diff.js";
import { loadRingkasan, updateActivityFeed } from "./ringkasan.js";
import { loadMateriTable, initMateriHandlers, getMateriData } from "./materi.js";
import { loadTugasTable, initTugasHandlers, getTugasData } from "./tugas.js";
import { loadAsesmenTable, initAsesmenHandlers, getAsesmenData } from "./asesmen.js";
import { initQBuilder, renderQBuilder } from "./qbuilder.js";
import { initQPreview } from "./qpreview.js";
import { initKoreksi, populateGradingQuizSelect, fetchAttemptsForGrading } from "./koreksi.js";
import { initCSVExport } from "./export-csv.js";
import { initImportExport } from "./import-export.js";

export function toggleQuickClass(inputId, clsName) {
  const el = document.getElementById(inputId);
  if (!el) return;
  const parts = el.value.split(",").map((s) => s.trim()).filter(Boolean);
  const idx = parts.findIndex((p) => p.toLowerCase() === clsName.toLowerCase());
  if (idx >= 0) parts.splice(idx, 1);
  else parts.push(clsName);
  el.value = parts.join(", ");
}

export function log(m) {
  const el = document.getElementById("log");
  if (el) el.textContent = `[${new Date().toLocaleTimeString()}] ${m}\n` + el.textContent;
  showToast(m);
}

const loadedAdminTabs = new Set();

export function invalidateAdminTab(tabId) {
  if (tabId) loadedAdminTabs.delete(tabId);
  else loadedAdminTabs.clear();
}

function refreshActivity() {
  updateActivityFeed(getMateriData(), getTugasData(), getAsesmenData());
}

export function switchAdminTab(tabId, forceReload = false) {
  document.querySelectorAll(".nav-btn, .mobile-nav-btn, .mobile-nav-item").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === tabId)
  );
  document.querySelectorAll(".tab-pane").forEach((p) =>
    p.classList.toggle("hidden", p.id !== tabId)
  );
  const toggleInput = document.getElementById("sidebar-toggle");
  if (toggleInput) toggleInput.checked = false;

  const labels = {
    "sec-ringkasan": "Ringkasan",
    "sec-materi": "Materi Pelajaran",
    "sec-tugas": "Tugas Siswa",
    "sec-asesmen": "Ujian & Buat Soal",
    "sec-grading": "Koreksi & Nilai",
    "sec-import": "Data Siswa, Guru & Excel"
  };
  const titleEl = document.getElementById("current-page-title");
  if (titleEl) titleEl.textContent = "Portal Guru · " + (labels[tabId] || "Beranda");
  const crumbEl = document.getElementById("crumb-section");
  if (crumbEl) crumbEl.textContent = labels[tabId] || "Portal Guru";

  if (tabId === "sec-ringkasan") {
    loadRingkasan();
  } else if (tabId === "sec-materi" && (forceReload || !loadedAdminTabs.has("sec-materi"))) {
    loadMateriTable(() => { loadedAdminTabs.add("sec-materi"); refreshActivity(); });
  } else if (tabId === "sec-tugas" && (forceReload || !loadedAdminTabs.has("sec-tugas"))) {
    loadTugasTable(() => { loadedAdminTabs.add("sec-tugas"); refreshActivity(); });
  } else if (tabId === "sec-asesmen" && (forceReload || !loadedAdminTabs.has("sec-asesmen"))) {
    loadAsesmenTable(() => { loadedAdminTabs.add("sec-asesmen"); refreshActivity(); });
  } else if (tabId === "sec-grading" && (forceReload || !loadedAdminTabs.has("sec-grading"))) {
    populateGradingQuizSelect().then(() => loadedAdminTabs.add("sec-grading"));
  }
}

async function boot() {
  initTheme();
  initToast();
  initGlobalErrorObserver();
  registerServiceWorker();
  await mountPartials();

  document.querySelectorAll("[data-action='toggle-class']").forEach((btn) => {
    btn.addEventListener("click", () => toggleQuickClass(btn.dataset.target, btn.dataset.class));
  });

  document.querySelectorAll(".nav-btn[data-tab], .mobile-nav-btn[data-tab], .mobile-nav-item[data-tab]").forEach((b) => {
    b.addEventListener("click", () => switchAdminTab(b.dataset.tab));
  });

  document.addEventListener("click", (e) => {
    const switchBtn = e.target.closest("[data-action='switch-tab']");
    if (switchBtn?.dataset.tab) switchAdminTab(switchBtn.dataset.tab);
    if (e.target.closest("[data-action='export-tugas-csv']")) {
      document.getElementById("btn-export-tugas-csv")?.click();
    }
  });

  initMateriHandlers(refreshActivity);
  initTugasHandlers(refreshActivity);
  initAsesmenHandlers(refreshActivity, async (code) => {
    switchAdminTab("sec-grading");
    await populateGradingQuizSelect(code);
    loadedAdminTabs.add("sec-grading");
    await fetchAttemptsForGrading(false);
  });
  initQBuilder((code) => {
    log(`Ujian ${code} tersimpan.`);
    loadedAdminTabs.delete("sec-asesmen");
    loadedAdminTabs.delete("sec-grading");
    loadAsesmenTable(() => { loadedAdminTabs.add("sec-asesmen"); refreshActivity(); });
    loadRingkasan();
  });
  initQPreview();
  initKoreksi();
  initCSVExport();
  initImportExport();
  renderQBuilder();

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace("index.html");
      return;
    }

    const adminSnap = await getDoc(doc(db, "admins", user.uid)).catch(() => null);
    if (!adminSnap?.exists()) {
      showToast("Halaman ini khusus Guru & Admin. Mengarahkan ke Portal Siswa...", "warn");
      setTimeout(() => { window.location.replace("index.html"); }, 500);
      return;
    }

    const adminData = adminSnap.data();
    const isSuper = isSuperAdminDoc(adminData);
    document.querySelectorAll(".superadmin-only").forEach((el) => el.classList.toggle("hidden", !isSuper));
    const roleBadge = document.querySelector(".sidebar-role-badge");
    if (roleBadge) roleBadge.textContent = isSuper ? "Admin Utama" : "Guru Pengampu";
    const topRole = document.getElementById("topbar-role-badge");
    if (topRole) topRole.textContent = isSuper ? "Admin" : "Guru";

    document.body.classList.remove("auth-mode");
    document.getElementById("app-content")?.classList.remove("hidden");
    document.getElementById("sidebar")?.classList.remove("hidden");
    document.getElementById("mobile-nav")?.classList.remove("hidden");
    document.getElementById("admin-topbar")?.classList.remove("hidden");

    const label = adminData.nama || user.email;
    const uDisplay = document.getElementById("u-display");
    if (uDisplay) uDisplay.textContent = label;
    const hEmail = document.getElementById("header-user-email");
    if (hEmail) hEmail.textContent = user.email;
    const initial = (label || "G").charAt(0).toUpperCase();
    const hAvatar = document.getElementById("header-avatar");
    if (hAvatar) hAvatar.textContent = initial;
    const sAvatar = document.getElementById("sidebar-avatar");
    if (sAvatar) sAvatar.textContent = initial;

    loadedAdminTabs.clear();
    loadRingkasan();
  });

  document.querySelectorAll("#btn-logout, #btn-header-logout, .btn-logout-icon").forEach((b) => {
    b.addEventListener("click", () => signOut(auth));
  });
}

boot().catch((err) => {
  console.error(err);
  showToast("Gagal memuat komponen halaman admin", "err");
});
