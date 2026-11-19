// Alat Khusus Admin Utama: Lepas Ikatan NIS (Pemulihan Akun) & Backup Database Lengkap (JSON)
import { showConfirmDialog, showToast } from "../../core/toast.js";
import { canManageUsers } from "./roster-save.js";
import { esc } from "./excel-core.js";

const BACKUP_COLS = [
  "classes", "siswa", "guruInvites", "materials", "assignments",
  "quizzes", "quizKeys", "submissions", "attempts", "results"
];

export function initAccountTools(fb) {
  const nisInput = document.getElementById("reset-nis-input");
  const checkBtn = document.getElementById("btn-reset-nis-check");
  const execBtn = document.getElementById("btn-reset-nis-exec");
  const infoBox = document.getElementById("reset-nis-info");
  const backupBtn = document.getElementById("btn-backup-full-json");

  let loadedSiswa = null;

  checkBtn?.addEventListener("click", async () => {
    const nis = (nisInput?.value || "").trim();
    if (!nis) return showToast("Masukkan NIS siswa terlebih dahulu.", "warn");
    try {
      const sSnap = await fb.getDoc(fb.doc(fb.db, "siswa", nis));
      if (!sSnap.exists()) {
        loadedSiswa = null;
        if (execBtn) execBtn.disabled = true;
        if (infoBox) {
          infoBox.classList.remove("hidden");
          infoBox.innerHTML = `<span class="badge badge-danger">NIS ${esc(nis)} tidak ditemukan di data siswa.</span>`;
        }
        return;
      }
      const d = sSnap.data();
      loadedSiswa = { nis, ...d };
      const claimed = !!d.claimedBy;
      if (infoBox) {
        infoBox.classList.remove("hidden");
        infoBox.innerHTML = `
          <div><strong>${esc(d.nama)}</strong> (${esc(d.kelas)}) · Status:
          <span class="badge ${claimed ? "badge-warn" : "badge-ok"}">${claimed ? "Sudah Tertaut" : "Belum Diklaim"}</span></div>
          ${claimed ? `<div class="text-xs text-muted">ID Akun Tertaut: <code>${esc(d.claimedBy)}</code></div>` : ""}
        `;
      }
      if (execBtn) execBtn.disabled = !claimed;
    } catch (e) {
      showToast("Gagal memeriksa NIS: " + e.message, "error");
    }
  });

  execBtn?.addEventListener("click", async () => {
    if (!loadedSiswa?.claimedBy) return;
    if (!(await canManageUsers(fb))) {
      return showToast("Akses ditolak: hanya Admin Utama yang dapat melepas ikatan NIS.", "error");
    }
    const ok = await showConfirmDialog({
      title: "Lepas Ikatan Akun Siswa?",
      message: `Siswa ${loadedSiswa.nama} (NIS ${loadedSiswa.nis}) akan dilepas dari akun lama (${loadedSiswa.claimedBy}) agar bisa masuk ulang atau memakai akun baru.`,
      confirmText: "Ya, Lepas Ikatan NIS",
      isDanger: true
    });
    if (!ok) return;

    execBtn.disabled = true;
    try {
      const oldUid = loadedSiswa.claimedBy;
      await fb.updateDoc(fb.doc(fb.db, "siswa", loadedSiswa.nis), { claimedBy: null });
      await fb.deleteDoc(fb.doc(fb.db, "users", oldUid)).catch(() => null);
      showToast(`Ikatan NIS ${loadedSiswa.nis} berhasil dilepas.`, "ok");
      loadedSiswa.claimedBy = null;
      if (infoBox) {
        infoBox.innerHTML = `<div><strong>${esc(loadedSiswa.nama)}</strong> (${esc(loadedSiswa.kelas)}) · <span class="badge badge-ok">Siap Diklaim Ulang</span></div>`;
      }
    } catch (e) {
      execBtn.disabled = false;
      showToast("Gagal melepas ikatan NIS: " + e.message, "error");
    }
  });

  backupBtn?.addEventListener("click", async () => {
    if (!(await canManageUsers(fb))) {
      return showToast("Khusus Admin Utama untuk mengunduh cadangan database lengkap.", "warn");
    }
    backupBtn.disabled = true;
    backupBtn.textContent = "Menyiapkan Cadangan JSON...";
    try {
      const out = { exportedAt: new Date().toISOString(), app: "SITURI LMS", collections: {} };
      for (const col of BACKUP_COLS) {
        const snap = await fb.getDocs(fb.collection(fb.db, col)).catch(() => ({ docs: [] }));
        out.collections[col] = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
      }
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `SITURI_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Cadangan lengkap JSON berhasil diunduh.", "ok");
    } catch (e) {
      showToast("Gagal membuat cadangan JSON: " + e.message, "error");
    } finally {
      backupBtn.disabled = false;
      backupBtn.textContent = "Unduh Cadangan Lengkap (.json)";
    }
  });
}
