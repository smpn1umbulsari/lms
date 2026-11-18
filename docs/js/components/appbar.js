// Unified Appbar Generator Component — SITURI LMS
// Menghasilkan header institusional terpadu untuk Siswa dan Guru

import { escAttr } from "../core/dom.js";

export function renderAppbar(container, options = {}) {
  const el = typeof container === "string" ? document.getElementById(container) : container;
  if (!el) return;

  const {
    institution = "SMPN 1 Umbulsari",
    role = "Guru",
    defaultCrumb = "Ringkasan",
    semester = "Semester Ganjil 2026/2027",
    avatarId = "header-avatar",
    avatarInitial = "G",
    userDisplayId = "header-user-email",
    userDefaultText = "Portal Guru",
    userSubtext = "Kurikulum Merdeka",
    logoutId = "btn-header-logout",
    isStudent = false,
    classBadgeId = "u-class"
  } = options;

  const userBlockHtml = isStudent
    ? `
      <div id="user-info" class="hidden flex items-center gap-8 border-l-line" style="padding-left:6px">
        <div class="avatar-circle avatar-circle-sm" id="${escAttr(avatarId)}">${escAttr(avatarInitial)}</div>
        <div class="hide-mobile flex flex-col">
          <div class="flex items-center gap-4">
            <span id="u-name" class="font-semibold text-ink leading-tight truncate" style="font-size:12px; max-width:130px">-</span>
            <span id="${escAttr(classBadgeId)}" class="badge badge-pg" style="font-size:10px; padding:1px 5px">(-)</span>
          </div>
          <span class="text-xs text-subtle" style="font-size:10.5px">${escAttr(userSubtext)}</span>
        </div>
      </div>
    `
    : `
      <div style="display:flex; align-items:center; gap:8px; padding-left:6px; border-left:1px solid var(--line)">
        <div class="avatar-circle avatar-circle-sm" id="${escAttr(avatarId)}">${escAttr(avatarInitial)}</div>
        <div class="hide-mobile flex flex-col">
          <span id="${escAttr(userDisplayId)}" class="font-semibold text-ink leading-tight truncate" style="font-size:12px; max-width:130px">${escAttr(userDefaultText)}</span>
          <span class="text-xs text-subtle" style="font-size:10.5px">${escAttr(userSubtext)}</span>
        </div>
      </div>
    `;

  el.innerHTML = `
    <div class="appbar-crumbs">
      <div class="brand-mark brand-mark-sm">U</div>
      <div class="flex flex-col min-w-0">
        <div class="flex items-center gap-6">
          <strong class="truncate text-ink">${escAttr(institution)}</strong>
          <span class="badge badge-neutral text-xs" style="font-size:10px; padding:2px 6px">${escAttr(role)}</span>
        </div>
        <span id="crumb-section" class="hide-mobile text-xs text-subtle">${escAttr(defaultCrumb)}</span>
      </div>
    </div>
    <div class="appbar-right">
      <div class="semester-pill hide-mobile">
        <span class="dot-live"></span>
        <span>${escAttr(semester)}</span>
      </div>
      <button type="button" id="btn-theme-toggle" class="icon-action-btn" aria-label="Ganti Mode Terang / Gelap" title="Ganti Mode Terang / Gelap">
        <span class="material-symbols-outlined" id="theme-icon">dark_mode</span>
      </button>
      ${userBlockHtml}
      <button type="button" id="${escAttr(logoutId)}" class="icon-action-btn btn-logout-icon" title="Keluar" aria-label="Keluar">
        <span class="material-symbols-outlined text-danger" style="font-size:19px">logout</span>
      </button>
    </div>
  `;
}
