// DOM and String Sanitization Utilities
export function escAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function $(id) {
  return document.getElementById(id);
}

export function $$(sel) {
  return Array.from(document.querySelectorAll(sel));
}
