// Centralized Client-Side Error & Rejection Observer
import { showToast } from "./toast.js";

let isListening = false;

export function initGlobalErrorObserver() {
  if (isListening || typeof window === "undefined") return;
  isListening = true;

  window.addEventListener("error", (event) => {
    // Ignore third-party resize observer and benign extension errors
    if (
      event.message?.includes("ResizeObserver") ||
      event.filename?.startsWith("chrome-extension://") ||
      event.filename?.startsWith("moz-extension://")
    ) {
      return;
    }

    console.error("[SITURI Error Observer]", {
      message: event.message,
      file: event.filename,
      line: event.lineno,
      col: event.colno,
      stack: event.error?.stack
    });

    // Notify user with non-intrusive toast for uncaught runtime exceptions
    showToast("Terjadi kendala teknis pada browser. Silakan muat ulang jika berulang.", "error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg = reason?.message || String(reason);

    if (msg.includes("aborted")) {
      return;
    }

    console.error("[SITURI Unhandled Rejection]", {
      reason: msg,
      stack: reason?.stack
    });

    if (msg.includes("permission-denied") || reason?.code === "permission-denied") {
      showToast("Akses ke data ditolak. Pastikan Anda masuk dengan akun yang benar.", "error");
    } else if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("offline")) {
      showToast("Koneksi terputus. Bekerja dalam mode offline.", "warn");
    }
  });
}

export function reportError(error, context = "App") {
  console.warn(`[SITURI Diagnostic] [${context}]`, error);
}
