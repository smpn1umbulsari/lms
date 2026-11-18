// Student Tugas (Assignments & Submissions) Feature
import {
  db,
  doc,
  getDocs,
  setDoc,
  collection,
  query,
  where,
  serverTimestamp
} from "../core/firebase.js";
import { escAttr } from "../core/dom.js";
import { embedsHTML } from "../core/media.js";
import { showToast } from "../core/toast.js";

let activeAssignment = null;
const QUEUE_KEY = "situri_pending_submissions";

export function getPendingSubmissions() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

export function savePendingSubmission(item) {
  const list = getPendingSubmissions().filter((x) => x.subId !== item.subId);
  list.push({ ...item, queuedAt: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
}

export function removePendingSubmission(subId) {
  const list = getPendingSubmissions().filter((x) => x.subId !== subId);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
}

export async function flushPendingSubmissions() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  const list = getPendingSubmissions();
  if (!list.length) return 0;

  let synced = 0;
  for (const item of list) {
    try {
      const now = serverTimestamp();
      await setDoc(
        doc(db, "submissions", item.subId),
        {
          uid: item.uid,
          assignmentId: item.assignmentId,
          teks: item.teks,
          link: item.link,
          submittedAt: now,
          updatedAt: now
        },
        { merge: true }
      );
      removePendingSubmission(item.subId);
      synced++;
    } catch (err) {
      console.warn("Gagal sinkronkan tugas tertunda:", item.subId, err);
    }
  }
  if (synced > 0) {
    showToast(`✓ ${synced} tugas tersimpan offline berhasil disinkronkan ke server!`, "ok");
  }
  return synced;
}

export async function loadTugas(currentUser, userProfile) {
  if (!userProfile?.kelas) return;
  const [qSnap, subSnap] = await Promise.all([
    getDocs(
      query(collection(db, "assignments"), where("classes", "array-contains", userProfile.kelas))
    ),
    getDocs(
      query(collection(db, "submissions"), where("uid", "==", currentUser.uid))
    )
  ]);
  const list = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const subMap = new Map();
  subSnap.docs.forEach((sd) => {
    const s = sd.data();
    if (s.assignmentId) subMap.set(s.assignmentId, s);
    subMap.set(sd.id, s);
  });

  // Gabungkan submission lokal yang masih mengantre offline
  const pending = getPendingSubmissions().filter((x) => x.uid === currentUser.uid);
  pending.forEach((p) => {
    if (!subMap.has(p.assignmentId)) {
      subMap.set(p.assignmentId, { ...p, isOfflinePending: true });
    }
  });

  const stTug = document.getElementById("st-count-tugas");
  if (stTug) stTug.textContent = list.length;
  const el = document.getElementById("tugas-list");
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `<div class="notice notice-warn">Belum ada penugasan untuk kelas Anda.</div>`;
    return;
  }

  el.innerHTML = "";
  for (const t of list) {
    const subData = subMap.get(t.id) || subMap.get(`${currentUser.uid}__${t.id}`) || null;
    const isPendingOffline = subData?.isOfflinePending;
    const isSubmitted = !!subData;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div>
        <h3>${escAttr(t.judul)}</h3>
        <p style="font-size:13px; color:var(--ink-2); margin:6px 0">${escAttr((t.instruksi || "").slice(0, 85))}...</p>
      </div>
    `;
    const _m = document.createElement("div");
    _m.innerHTML = embedsHTML(t);
    if (_m.innerHTML.trim()) card.appendChild(_m);
    const meta = document.createElement("div");
    meta.className = "card-meta";
    meta.innerHTML = `
      <span class="badge ${isPendingOffline ? "badge-warn" : isSubmitted ? "badge-ok" : "badge-warn"}">
        ${isPendingOffline ? "⏳ Antrean Offline" : isSubmitted ? "✓ Sudah Dikumpul" : "Belum Dikumpul"}
      </span>
      <span class="tabular-nums" style="font-size:12px; color:var(--ink-2)">Batas: ${
        t.dueAt ? new Date(t.dueAt.toDate()).toLocaleDateString("id-ID") : "-"
      }</span>
    `;
    card.appendChild(meta);
    if (subData && subData.nilai !== undefined) {
      const nDiv = document.createElement("div");
      nDiv.style.cssText =
        "margin-top:8px; font-weight:700; color:var(--ok); font-variant-numeric:tabular-nums";
      nDiv.textContent = `Nilai: ${subData.nilai}/100`;
      card.appendChild(nDiv);
    }
    card.onclick = (e) => {
      if (e.target.closest("a") || e.target.closest("iframe") || e.target.closest("object")) return;
      openTugasModal(t, subData);
    };
    el.appendChild(card);
  }
}

export function openTugasModal(tugas, subData) {
  activeAssignment = tugas;
  document.getElementById("sub-title").textContent = `Tugas: ${tugas.judul}`;
  document.getElementById("sub-instruksi").textContent = tugas.instruksi;
  let tAttach = document.getElementById("sub-tugas-attach");
  if (!tAttach) {
    tAttach = document.createElement("div");
    tAttach.id = "sub-tugas-attach";
    document.getElementById("sub-instruksi").after(tAttach);
  }
  tAttach.innerHTML = embedsHTML(tugas);
  document.getElementById("sub-teks").value = subData ? subData.teks || "" : "";
  document.getElementById("sub-link").value = subData ? subData.link || "" : "";
  const stEl = document.getElementById("sub-status");
  if (stEl) {
    if (subData?.isOfflinePending) {
      stEl.textContent = "⏳ Jawaban tersimpan di memori perangkat (Antrean Offline).";
      stEl.classList.remove("hidden");
    } else if (subData) {
      stEl.textContent = "✓ Jawaban tersimpan sebelumnya di server.";
      stEl.classList.remove("hidden");
    } else {
      stEl.textContent = "";
      stEl.classList.add("hidden");
    }
  }
  document.getElementById("btn-sub-save").textContent = subData ? "Perbarui Jawaban" : "Kirim Tugas Sekarang";
  document.getElementById("sub-modal").classList.remove("hidden");
  document.getElementById("sub-teks")?.focus();
}

export function initTugasHandlers(getCurrentUser, onSubmitted) {
  const subModal = document.getElementById("sub-modal");
  document.getElementById("btn-sub-cancel")?.addEventListener("click", () => {
    subModal?.classList.add("hidden");
  });

  subModal?.addEventListener("click", (e) => {
    if (e.target === subModal || e.target.closest("[data-action='close-sub-modal']")) {
      subModal.classList.add("hidden");
    }
  });

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
      flushPendingSubmissions().then((synced) => {
        if (synced > 0 && typeof onSubmitted === "function") {
          onSubmitted();
        }
      });
    });
    if (navigator.onLine) {
      flushPendingSubmissions();
    }
  }

  document.getElementById("btn-sub-save")?.addEventListener("click", async () => {
    const user = getCurrentUser();
    if (!activeAssignment || !user) return;
    const teks = document.getElementById("sub-teks").value.trim();
    const link = document.getElementById("sub-link").value.trim();
    if (!teks && !link) {
      showToast("Isi minimal catatan teks atau link tugas!", "warn");
      return;
    }
    const subId = `${user.uid}__${activeAssignment.id}`;
    const payload = {
      subId,
      uid: user.uid,
      assignmentId: activeAssignment.id,
      teks,
      link
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      savePendingSubmission(payload);
      const stEl = document.getElementById("sub-status");
      if (stEl) {
        stEl.textContent = "⏳ Disimpan lokal (Offline). Otomatis dikirim saat online!";
        stEl.classList.remove("hidden");
      }
      showToast("Koneksi offline: Tugas disimpan di perangkat & otomatis dikirim saat online.", "warn");
      setTimeout(() => {
        subModal?.classList.add("hidden");
        if (typeof onSubmitted === "function") onSubmitted();
      }, 1200);
      return;
    }

    try {
      const now = serverTimestamp();
      await setDoc(
        doc(db, "submissions", subId),
        {
          uid: user.uid,
          assignmentId: activeAssignment.id,
          teks,
          link,
          submittedAt: now,
          updatedAt: now
        },
        { merge: true }
      );
      removePendingSubmission(subId);
      const stEl = document.getElementById("sub-status");
      if (stEl) {
        stEl.textContent = "✓ Berhasil disimpan!";
        stEl.classList.remove("hidden");
      }
      showToast("Tugas berhasil dikumpulkan!", "ok");
      setTimeout(() => {
        subModal?.classList.add("hidden");
        if (typeof onSubmitted === "function") onSubmitted();
      }, 1000);
    } catch (err) {
      console.warn("Gagal simpan ke Firestore, simpan ke antrean lokal:", err);
      savePendingSubmission(payload);
      showToast("Koneksi terganggu: Jawaban diamankan ke antrean offline.", "warn");
      setTimeout(() => {
        subModal?.classList.add("hidden");
        if (typeof onSubmitted === "function") onSubmitted();
      }, 1200);
    }
  });
}
