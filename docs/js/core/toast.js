// Floating Toast & Non-Blocking Confirmation Modal Helper
let toastTimer = null;

export function showToast(msg, type = "info") {
  const pill = document.getElementById("toast-pill");
  const txt = document.getElementById("toast-text");
  if (!pill || !txt) {
    console.log(`[Toast ${type}]: ${msg}`);
    return;
  }
  txt.textContent = msg;

  const iconEl = pill.querySelector(".material-symbols-outlined");
  if (iconEl) {
    if (type === "ok" || type === "success") {
      iconEl.textContent = "check_circle";
      iconEl.style.color = "var(--ok)";
    } else if (type === "warn" || type === "warning") {
      iconEl.textContent = "warning";
      iconEl.style.color = "var(--warn)";
    } else if (type === "error" || type === "danger") {
      iconEl.textContent = "error";
      iconEl.style.color = "var(--danger)";
    } else {
      iconEl.textContent = "info";
      iconEl.style.color = "var(--accent)";
    }
  }

  pill.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => pill.classList.add("hidden"), 3200);
}

export function showConfirmDialog({
  title = "Konfirmasi Aksi",
  message = "Apakah Anda yakin ingin melanjutkan?",
  confirmText = "Lanjutkan",
  cancelText = "Batal",
  isDanger = false
} = {}) {
  return new Promise((resolve) => {
    let modal = document.getElementById("lms-confirm-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "lms-confirm-modal";
      modal.className = "modal-backdrop hidden";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.innerHTML = `
        <div class="modal-dialog" style="max-width:440px">
          <div class="modal-header">
            <h2 id="lms-confirm-title" style="font-size:16px; font-weight:600; color:var(--ink)">Konfirmasi</h2>
          </div>
          <div class="modal-body">
            <p id="lms-confirm-msg" style="font-size:13.5px; color:var(--ink-2); line-height:1.5; margin:0"></p>
          </div>
          <div class="modal-footer" style="justify-content:flex-end; gap:8px">
            <button type="button" id="lms-confirm-cancel" class="btn btn-secondary btn-sm">Batal</button>
            <button type="button" id="lms-confirm-ok" class="btn btn-sm">Lanjutkan</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const titleEl = document.getElementById("lms-confirm-title");
    const msgEl = document.getElementById("lms-confirm-msg");
    const btnCancel = document.getElementById("lms-confirm-cancel");
    const btnOk = document.getElementById("lms-confirm-ok");

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (btnCancel) btnCancel.textContent = cancelText;
    if (btnOk) {
      btnOk.textContent = confirmText;
      btnOk.className = `btn btn-sm ${isDanger ? "btn-danger" : "btn-primary"}`;
      if (isDanger) {
        btnOk.style.background = "var(--danger)";
        btnOk.style.color = "#ffffff";
        btnOk.style.border = "none";
      } else {
        btnOk.style.background = "";
        btnOk.style.color = "";
        btnOk.style.border = "";
      }
    }

    const cleanup = () => {
      modal.classList.add("hidden");
      btnCancel?.removeEventListener("click", onCancel);
      btnOk?.removeEventListener("click", onOk);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onOk = () => {
      cleanup();
      resolve(true);
    };

    btnCancel?.addEventListener("click", onCancel);
    btnOk?.addEventListener("click", onOk);
    modal.classList.remove("hidden");
  });
}

export function initToast() {
  window._showToast = showToast;
  window._showConfirmDialog = showConfirmDialog;
}
