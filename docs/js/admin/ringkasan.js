// Admin Ringkasan Dashboard & Activity Feed
import {
  db,
  collection,
  getCountFromServer
} from "../core/firebase.js";
import { escAttr } from "../core/dom.js";

export async function loadRingkasan() {
  const items = [
    { col: "materials", id: "rk-materi" },
    { col: "assignments", id: "rk-tugas" },
    { col: "quizzes", id: "rk-asesmen" },
    { col: "submissions", id: "rk-kiriman" }
  ];
  await Promise.all(
    items.map(async ({ col, id }) => {
      try {
        const snap = await getCountFromServer(collection(db, col));
        const el = document.getElementById(id);
        if (el) el.textContent = snap.data().count;
      } catch (e) {
        console.error(`Gagal memuat count ${col}:`, e);
      }
    })
  );
}

export function updateActivityFeed(materiData = [], tugasData = [], asesmenData = []) {
  const feed = document.getElementById("rk-activity-feed");
  if (!feed) return;
  const rows = [];
  materiData.slice(0, 2).forEach((m) => {
    const d = m.data || m;
    rows.push(`
      <div class="list-row">
        <div class="list-row-main">
          <span class="status-dot" style="background:var(--badge-pg)"></span>
          <div>
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap">
              <strong style="font-weight:500; color:var(--ink)">${escAttr(d.judul || "-")}</strong>
              <span class="badge badge-pg">MATERI</span>
            </div>
            <div style="font-size:12px; color:var(--ink-2)">Kelas ${(d.classes || []).join(", ") || "-"}</div>
          </div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-action="switch-tab" data-tab="sec-materi">Lihat</button>
      </div>
    `);
  });
  tugasData.slice(0, 2).forEach((t) => {
    const d = t.data || t;
    rows.push(`
      <div class="list-row">
        <div class="list-row-main">
          <span class="status-dot" style="background:var(--badge-match)"></span>
          <div>
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap">
              <strong style="font-weight:500; color:var(--ink)">${escAttr(d.judul || "-")}</strong>
              <span class="badge badge-match">TUGAS</span>
            </div>
            <div style="font-size:12px; color:var(--ink-2)">Kelas ${(d.classes || []).join(", ") || "-"}</div>
          </div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-action="switch-tab" data-tab="sec-tugas">Lihat</button>
      </div>
    `);
  });
  asesmenData.slice(0, 2).forEach((q) => {
    const d = q.data || q;
    rows.push(`
      <div class="list-row">
        <div class="list-row-main">
          <span class="status-dot" style="background:var(--badge-bs)"></span>
          <div>
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap">
              <strong style="font-weight:500; color:var(--ink)">${escAttr(d.judul || q.id)}</strong>
              <span class="badge badge-bs">CBT ${(d.mode || "latihan").toUpperCase()}</span>
            </div>
            <div style="font-size:12px; color:var(--ink-2)">Kode: <code>${escAttr(q.id)}</code> · Kelas ${(d.classes || []).join(", ") || "-"}</div>
          </div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-action="switch-tab" data-tab="sec-asesmen">Lihat</button>
      </div>
    `);
  });

  if (rows.length) {
    feed.innerHTML = rows.join("");
  } else {
    feed.innerHTML = `<div style="padding:16px 4px; color:var(--ink-3); font-size:13px">Belum ada aktivitas materi, tugas, atau asesmen. Buat materi atau ujian pertama Anda.</div>`;
  }
}

export function updateClassOptions(selectEl, items, onFilter) {
  if (!selectEl) return;
  const currentVal = selectEl.value;
  const set = new Set();
  items.forEach((item) => {
    const d = item.data || item;
    let cls = d.classes || [];
    if (typeof cls === "string") cls = cls.split(",").map((x) => x.trim());
    if (Array.isArray(cls)) {
      cls.forEach((c) => {
        const trimmed = String(c || "").trim();
        if (trimmed) set.add(trimmed);
      });
    }
  });
  const sorted = Array.from(set).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );
  selectEl.innerHTML =
    '<option value="">Semua Kelas</option>' +
    sorted.map((c) => `<option value="${escAttr(c)}">${escAttr(c)}</option>`).join("");
  if (currentVal && set.has(currentVal)) {
    selectEl.value = currentVal;
  }
  if (!selectEl._hasFilterListener) {
    selectEl._hasFilterListener = true;
    selectEl.onchange = () => {
      if (typeof onFilter === "function") onFilter();
    };
  }
}
