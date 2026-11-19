// Unified Single-Door Authentication, Role Routing & NIS Binding Helper
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
import { SCHOOL_EMAIL_DOMAIN, isDev } from "../core/env.js";
import { showToast } from "../core/toast.js";

function updateAuthDateAndNetwork() {
  const dateEl = document.getElementById("auth-today-date");
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
  }
  const syncNet = () => {
    const badge = document.getElementById("net-status-badge");
    const txt = document.getElementById("net-status-text");
    const ico = document.getElementById("net-status-icon");
    if (!badge || !txt) return;
    if (navigator.onLine) {
      badge.className = "net-pill net-online";
      txt.textContent = "Terhubung";
      if (ico) ico.textContent = "cloud_done";
    } else {
      badge.className = "net-pill net-offline";
      txt.textContent = "Mode Offline — Tersimpan Lokal";
      if (ico) ico.textContent = "cloud_off";
    }
  };
  syncNet();
  window.addEventListener("online", syncNet);
  window.addEventListener("offline", syncNet);
}

function renderDemoAccountsBox() {
  const box = document.getElementById("auth-chips-box");
  if (!box) return;
  if (!isDev) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  box.classList.remove("hidden");
  box.innerHTML = `
    <span class="text-xs text-muted">Akun Uji Lokal:</span>
    <button type="button" class="auth-demo-chip" data-action="fill-demo" data-email="1001" data-pass="siswa123">Siswa (1001)</button>
    <button type="button" class="auth-demo-chip" data-action="fill-demo" data-email="guru@${SCHOOL_EMAIL_DOMAIN}" data-pass="admin123">Guru</button>
    <button type="button" class="auth-demo-chip" data-action="fill-demo" data-email="admin@${SCHOOL_EMAIL_DOMAIN}" data-pass="admin123">Admin</button>
  `;
}

async function tryActivateOrRouteStaff(user) {
  const adminSnap = await getDoc(doc(db, "admins", user.uid)).catch(() => null);
  if (adminSnap?.exists()) return true;

  const emailKey = (user.email || "").trim().toLowerCase();
  if (!emailKey) return false;
  const invSnap = await getDoc(doc(db, "guruInvites", emailKey)).catch(() => null);
  if (invSnap?.exists() && invSnap.data().aktif === true) {
    const inv = invSnap.data();
    await setDoc(doc(db, "admins", user.uid), {
      email: emailKey,
      nama: inv.nama || emailKey.split("@")[0],
      nip: inv.nip || "",
      mapel: inv.mapel || "",
      role: "guru",
      activatedAt: serverTimestamp()
    });
    return true;
  }
  return false;
}

export function initStudentAuth({ onEnterDashboard, onSignedOut }) {
  updateAuthDateAndNetwork();
  renderDemoAccountsBox();

  let signedInUser = null;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      signedInUser = null;
      onSignedOut?.();
      document.body.classList.add("auth-mode");
      document.getElementById("student-topbar")?.classList.add("hidden");
      document.getElementById("user-info")?.classList.add("hidden");
      document.getElementById("sec-login")?.classList.remove("hidden");
      document.getElementById("sec-nis")?.classList.add("hidden");
      document.getElementById("sec-dashboard")?.classList.add("hidden");
      document.getElementById("sec-exam")?.classList.add("hidden");
      document.getElementById("sec-result")?.classList.add("hidden");
      document.getElementById("mobile-student-nav")?.classList.add("hidden");
      return;
    }

    signedInUser = user;
    if (await tryActivateOrRouteStaff(user)) {
      showToast("Akun Guru/Admin terdeteksi. Membuka Portal Mengajar...", "ok");
      setTimeout(() => { window.location.href = "admin.html"; }, 350);
      return;
    }

    const udoc = await getDoc(doc(db, "users", user.uid)).catch(() => null);
    if (udoc?.exists()) {
      onEnterDashboard(user, udoc.data());
      return;
    }

    // Siswa baru perlu menautkan profil dengan data NIS dari operator sekolah
    document.body.classList.add("auth-mode");
    document.getElementById("sec-login")?.classList.add("hidden");
    document.getElementById("sec-nis")?.classList.remove("hidden");
    document.getElementById("nis-err")?.classList.add("hidden");
    const nisIn = document.getElementById("input-nis");
    const suffix = `@${SCHOOL_EMAIL_DOMAIN}`;
    if (nisIn && user.email?.toLowerCase().endsWith(suffix)) {
      nisIn.value = user.email.slice(0, -suffix.length);
    }
  });

  const submitLogin = async () => {
    const raw = (document.getElementById("l-email")?.value || "").trim();
    const pass = document.getElementById("l-pass")?.value || "";
    const errBox = document.getElementById("login-err");
    if (errBox) errBox.classList.add("hidden");
    if (!raw || !pass) {
      if (errBox) { errBox.textContent = "Masukkan NIS/Email dan Kata Sandi."; errBox.classList.remove("hidden"); }
      return;
    }
    const email = raw.includes("@") ? raw : `${raw.toLowerCase()}@${SCHOOL_EMAIL_DOMAIN}`;
    const btn = document.getElementById("btn-login");
    if (btn) btn.disabled = true;
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (e) {
      if (errBox) {
        errBox.textContent = "Login gagal: periksa NIS/Email atau kata sandi Anda.";
        errBox.classList.remove("hidden");
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  document.getElementById("btn-login")?.addEventListener("click", submitLogin);
  document.getElementById("l-pass")?.addEventListener("keydown", (e) => { if (e.key === "Enter") submitLogin(); });

  document.getElementById("btn-submit-nis")?.addEventListener("click", async () => {
    if (!signedInUser) return;
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
      if (!sSnap.exists()) throw new Error("NIS tidak ditemukan dalam data siswa sekolah.");
      const sData = sSnap.data();
      if (sData.claimedBy && sData.claimedBy !== signedInUser.uid) {
        throw new Error("NIS ini sudah tertaut ke akun lain. Minta Operator/Admin melepas ikatan NIS.");
      }
      await setDoc(doc(db, "users", signedInUser.uid), {
        nis, nama: sData.nama, kelas: sData.kelas, createdAt: serverTimestamp()
      });
      if (!sData.claimedBy) {
        await updateDoc(sRef, { claimedBy: signedInUser.uid });
      }
      showToast(`Selamat datang, ${sData.nama}!`, "ok");
      onEnterDashboard(signedInUser, { nis, nama: sData.nama, kelas: sData.kelas });
    } catch (e) {
      if (errBox) { errBox.textContent = e.message; errBox.classList.remove("hidden"); }
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  document.querySelectorAll("#btn-logout, #btn-nis-logout, .btn-logout-icon").forEach((b) => {
    b.addEventListener("click", () => signOut(auth));
  });
}
