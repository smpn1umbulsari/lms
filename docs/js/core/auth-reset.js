// Password Reset Workflow for SITURI LMS
import { auth, sendPasswordResetEmail } from "./firebase.js";
import { showToast, showPromptDialog } from "./toast.js";

export async function handleForgotPassword(defaultEmail = "") {
  const emailInput = document.getElementById("l-email");
  const currentVal = (defaultEmail || emailInput?.value || "").trim();

  // Akun Siswa NIS murni (angka tanpa domain atau @situri.local)
  if (currentVal && (!currentVal.includes("@") || currentVal.endsWith("@situri.local"))) {
    showToast(
      "Akun Siswa (NIS) dikelola oleh Wali Kelas / Admin. Hubungi pihak sekolah untuk reset sandi.",
      "warn"
    );
    return;
  }

  const email = await showPromptDialog({
    title: "Atur Ulang Kata Sandi",
    message: "Masukkan alamat email akun Guru / Admin Anda untuk menerima tautan pemulihan kata sandi:",
    placeholder: "nama@sekolah.sch.id",
    defaultValue: currentVal,
    confirmText: "Kirim Tautan Reset",
    cancelText: "Batal"
  });

  if (!email) return;

  if (!email.includes("@") || email.endsWith("@situri.local")) {
    showToast("Format email tidak valid (khusus akun Guru/Admin).", "warn");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showToast("Tautan reset sandi telah dikirim ke email Anda! Periksa kotak masuk.", "ok");
  } catch (err) {
    console.warn("Gagal mengirim email reset sandi:", err);
    if (err.code === "auth/user-not-found") {
      showToast("Email tidak ditemukan dalam sistem akun LMS.", "warn");
    } else if (err.code === "auth/invalid-email") {
      showToast("Format alamat email tidak valid.", "warn");
    } else {
      showToast("Gagal mengirim tautan reset: " + (err.message || err.code), "error");
    }
  }
}

export function initForgotPassword() {
  document.querySelectorAll("[data-action='forgot-password']").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      handleForgotPassword();
    });
  });
}
