// Student Materi (Materials) Feature
import { db, collection, query, where, getDocs } from "../core/firebase.js";
import { escAttr } from "../core/dom.js";
import { urlsOf, embedsHTML } from "../core/media.js";

export async function loadMateri(userProfile) {
  if (!userProfile?.kelas) return;
  const cacheKey = `lms_mat_${userProfile.kelas}`;
  let list = JSON.parse(localStorage.getItem(cacheKey) || "null");
  if (!list) {
    const qSnap = await getDocs(
      query(collection(db, "materials"), where("classes", "array-contains", userProfile.kelas))
    );
    list = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    localStorage.setItem(cacheKey, JSON.stringify(list));
  }
  const stMat = document.getElementById("st-count-materi");
  if (stMat) stMat.textContent = list.length;
  const el = document.getElementById("materi-list");
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `<div class="notice notice-warn">Belum ada materi untuk kelas ${userProfile.kelas}.</div>`;
    return;
  }
  el.innerHTML = "";

  for (const m of list) {
    const card = document.createElement("div");
    card.className = "card";
    const hasMedia = urlsOf(m).length > 0;
    card.innerHTML = `
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px">
          <span class="badge ${hasMedia ? "badge-pg" : "badge-bs"}">${hasMedia ? "Teks & Media Embed" : "Modul Ringkasan"}</span>
          <span style="font-size:11.5px; color:var(--ink-3)">Kelas ${escAttr(userProfile.kelas)}</span>
        </div>
        <h3>${escAttr(m.judul)}</h3>
        <p style="font-size:13px; color:var(--ink-2); margin:6px 0">${escAttr((m.deskripsi || "").slice(0, 95))}...</p>
      </div>
    `;
    const _m = document.createElement("div");
    _m.innerHTML = embedsHTML(m);
    if (_m.innerHTML.trim()) card.appendChild(_m);

    const meta = document.createElement("div");
    meta.className = "card-meta";
    meta.innerHTML = `
      <span class="badge badge-pg">Materi</span>
      <span style="font-weight:600; color:var(--accent)">Buka Modul →</span>
    `;
    card.appendChild(meta);

    card.onclick = (e) => {
      if (e.target.closest("a") || e.target.closest("iframe") || e.target.closest("object")) return;
      openMateri(m);
    };
    el.appendChild(card);
  }
}

export function openMateri(m) {
  if (!m) return;
  const win = window.open("", "_blank");
  win.document.write(`
    <html style="background:#f8fafc; color:#0f172a; font:15px 'Inter', system-ui, sans-serif; padding:2rem"><head>
    <title>${escAttr(m.judul)}</title>
    <style>
      .embed-video{aspect-ratio:16/9;width:100%;height:auto;border:0;border-radius:10px;background:#000}
      .embed-pdf{width:100%;height:70vh;min-height:360px;border:0;border-radius:10px;background:#f1f5f9}
      .embed-link{display:inline-block;word-break:break-all;color:#1d4ed8;font-weight:600}
      .embed-wrap{margin:.75rem 0}
    </style>
    </head><body style="max-width:720px; margin:0 auto; background:#ffffff; padding:28px; border:1px solid #e2e8f0; border-radius:14px">
    <h1 style="color:#0f172a; font-size:22px; margin-bottom:8px">${escAttr(m.judul)}</h1>
    <hr style="border:0; border-top:1px solid #e2e8f0; margin:1rem 0">
    ${embedsHTML(m)}
    <div style="white-space:pre-wrap; line-height:1.65; color:#334155">${escAttr(m.deskripsi)}</div>
    </body></html>
  `);
}

export function initMateriSearch() {
  document.getElementById("material-search")?.addEventListener("input", (e) => {
    const q = (e.target.value || "").trim().toLowerCase();
    document.querySelectorAll("#materi-list .card").forEach((card) => {
      const txt = (card.textContent || "").toLowerCase();
      card.style.display = !q || txt.includes(q) ? "" : "none";
    });
  });
}
