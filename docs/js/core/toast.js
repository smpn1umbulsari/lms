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

export function showPromptDialog({
  title = "Masukkan Data",
  message = "Silakan masukkan data:",
  placeholder = "",
  defaultValue = "",
  confirmText = "Kirim",
  cancelText = "Batal"
} = {}) {
  return new Promise((resolve) => {
    let modal = document.getElementById("lms-prompt-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "lms-prompt-modal";
      modal.className = "modal-backdrop hidden";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.innerHTML = `
        <div class="modal-dialog" style="max-width:440px">
          <div class="modal-header">
            <h2 id="lms-prompt-title" style="font-size:16px; font-weight:600; color:var(--ink)">Prompt</h2>
          </div>
          <div class="modal-body">
            <p id="lms-prompt-msg" style="font-size:13px; color:var(--ink-2); line-height:1.5; margin:0 0 10px"></p>
            <input type="text" id="lms-prompt-input" style="width:100%; margin:0" />
          </div>
          <div class="modal-footer" style="justify-content:flex-end; gap:8px">
            <button type="button" id="lms-prompt-cancel" class="btn btn-secondary btn-sm">Batal</button>
            <button type="button" id="lms-prompt-ok" class="btn btn-primary btn-sm">Kirim</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    const titleEl = document.getElementById("lms-prompt-title");
    const msgEl = document.getElementById("lms-prompt-msg");
    const inputEl = document.getElementById("lms-prompt-input");
    const btnCancel = document.getElementById("lms-prompt-cancel");
    const btnOk = document.getElementById("lms-prompt-ok");

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (inputEl) {
      inputEl.placeholder = placeholder;
      inputEl.value = defaultValue;
    }
    if (btnCancel) btnCancel.textContent = cancelText;
    if (btnOk) btnOk.textContent = confirmText;

    const cleanup = () => {
      modal.classList.add("hidden");
      btnCancel?.removeEventListener("click", onCancel);
      btnOk?.removeEventListener("click", onOk);
      inputEl?.removeEventListener("keydown", onKey);
    };

    const onCancel = () => {
      cleanup();
      resolve(null);
    };

    const onOk = () => {
      const val = inputEl?.value.trim() || "";
      cleanup();
      resolve(val);
    };

    const onKey = (e) => {
      if (e.key === "Enter") onOk();
      if (e.key === "Escape") onCancel();
    };

    btnCancel?.addEventListener("click", onCancel);
    btnOk?.addEventListener("click", onOk);
    inputEl?.addEventListener("keydown", onKey);
    modal.classList.remove("hidden");
    setTimeout(() => {
      inputEl?.focus();
      inputEl?.select();
    }, 50);
  });
}

export function initToast() {
  document.getElementById("toast-pill")?.addEventListener("click", () => {
    document.getElementById("toast-pill")?.classList.add("hidden");
  });
}
