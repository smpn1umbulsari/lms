// Student Tugas (Assignments, Deadline Enforcement, Offline Queue & Submission Mode)
import {
  db,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  serverTimestamp
} from "../core/firebase.js";
import { escAttr } from "../core/dom.js";
import { embedsHTML } from "../core/media.js";
import { showToast } from "../core/toast.js";
import { tsToMs } from "../shared/quiz-utils.js";

let activeAssignment = null;
let activeSubData = null;
const QUEUE_KEY = "situri_pending_submissions";

export function getPendingSubmissions() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); }
  catch (e) { return []; }
}

export function savePendingSubmission(item) {
  const list = getPendingSubmissions().filter((x) => x.subId !== item.subId);
  list.push({ ...item, queuedAt: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
}

export function removePendingSubmission(subId) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(getPendingSubmissions().filter((x) => x.subId !== subId)));
}

async function writeSubmissionDoc(item, isUpdate) {
  const now = serverTimestamp();
  const ref = doc(db, "submissions", item.subId);
  if (isUpdate) {
    await updateDoc(ref, { teks: item.teks, link: item.link, updatedAt: now });
  } else {
    await setDoc(ref, { uid: item.uid, assignmentId: item.assignmentId, teks: item.teks, link: item.link, submittedAt: now, updatedAt: now });
  }
}

export async function flushPendingSubmissions() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  const list = getPendingSubmissions();
  if (!list.length) return 0;

  let synced = 0;
  for (const item of list) {
    try {
      await writeSubmissionDoc(item, !!item.wasExisting);
      removePendingSubmission(item.subId);
      synced++;
    } catch (err) {
      console.warn("Gagal sinkronkan tugas tertunda:", item.subId, err);
    }
  }
  if (synced > 0) showToast(`✓ ${synced} tugas tertunda berhasil dikirim ke server.`, "ok");
  return synced;
}

export async function loadTugas(currentUser, userProfile) {
  if (!userProfile?.kelas) return;
  const [qSnap, subSnap] = await Promise.all([
    getDocs(query(collection(db, "assignments"), where("classes", "array-contains", userProfile.kelas))),
    getDocs(query(collection(db, "submissions"), where("uid", "==", currentUser.uid)))
  ]);
  const list = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const subMap = new Map();
  subSnap.docs.forEach((sd) => {
    const s = sd.data();
    s._exists = true;
    if (s.assignmentId) subMap.set(s.assignmentId, s);
    subMap.set(sd.id, s);
  });

  getPendingSubmissions()
    .filter((x) => x.uid === currentUser.uid)
    .forEach((p) => { if (!subMap.has(p.assignmentId)) subMap.set(p.assignmentId, { ...p, isOfflinePending: true }); });

  const stTug = document.getElementById("st-count-tugas");
  if (stTug) stTug.textContent = list.length;
  const el = document.getElementById("tugas-list");
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `<div class="notice notice-warn">Belum ada tugas untuk kelas Anda.</div>`;
    return;
  }

  const nowMs = Date.now();
  el.innerHTML = "";
  for (const t of list) {
    const subData = subMap.get(t.id) || subMap.get(`${currentUser.uid}__${t.id}`) || null;
    const isPastDue = !!(t.dueAt && tsToMs(t.dueAt) < nowMs);
    const isGraded = subData?.nilai !== undefined && subData?.nilai !== null && subData?.nilai !== "";
    const isPending = !!subData?.isOfflinePending;

    const statusBadge = isGraded
      ? `<span class="badge badge-ok">Sudah Dinilai: ${subData.nilai}/100</span>`
      : isPending
      ? `<span class="badge badge-warn">⏳ Antrean Offline</span>`
      : subData
      ? `<span class="badge badge-ok">✓ Sudah Dikumpul</span>`
      : isPastDue
      ? `<span class="badge badge-danger">Tenggat Lewat</span>`
      : `<span class="badge badge-warn">Belum Dikumpul</span>`;

    const dueStr = t.dueAt ? new Date(tsToMs(t.dueAt)).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Tanpa batas";
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div>
        <h3>${escAttr(t.judul)}</h3>
        <p style="font-size:13px; color:var(--ink-2); margin:6px 0">${escAttr((t.instruksi || "").slice(0, 85))}</p>
      </div>`;
    const _m = document.createElement("div");
    _m.innerHTML = embedsHTML(t);
    if (_m.innerHTML.trim()) card.appendChild(_m);

    const meta = document.createElement("div");
    meta.className = "card-meta";
    meta.innerHTML = `${statusBadge} <span class="tabular-nums" style="font-size:12px; color:var(--ink-2)">Batas: ${escAttr(dueStr)}</span>`;
    card.appendChild(meta);
    card.onclick = (e) => {
      if (e.target.closest("a") || e.target.closest("iframe") || e.target.closest("object")) return;
      openTugasModal(t, subData);
    };
    el.appendChild(card);
  }
}

export function openTugasModal(tugas, subData) {
  activeAssignment = tugas;
  activeSubData = subData;
  const isPastDue = !!(tugas.dueAt && tsToMs(tugas.dueAt) < Date.now());
  const isGraded = subData?.nilai !== undefined && subData?.nilai !== null && subData?.nilai !== "";
  const locked = isPastDue || isGraded;

  document.getElementById("sub-title").textContent = `Tugas: ${tugas.judul}`;
  document.getElementById("sub-instruksi").textContent = tugas.instruksi || "";
  let tAttach = document.getElementById("sub-tugas-attach");
  if (!tAttach) {
    tAttach = document.createElement("div");
    tAttach.id = "sub-tugas-attach";
    document.getElementById("sub-instruksi").after(tAttach);
  }
  tAttach.innerHTML = embedsHTML(tugas);

  const teksEl = document.getElementById("sub-teks");
  const linkEl = document.getElementById("sub-link");
  const saveBtn = document.getElementById("btn-sub-save");
  const stEl = document.getElementById("sub-status");

  if (teksEl) { teksEl.value = subData ? subData.teks || "" : ""; teksEl.disabled = locked; }
  if (linkEl) { linkEl.value = subData ? subData.link || "" : ""; linkEl.disabled = locked; }
  if (saveBtn) {
    saveBtn.disabled = locked;
    saveBtn.textContent = isGraded ? "Sudah Dinilai" : isPastDue ? "Tenggat Berakhir" : subData ? "Perbarui Jawaban" : "Kirim Tugas";
  }
  if (stEl) {
    stEl.classList.remove("hidden");
    if (isGraded) {
      const cat = subData.catatanGuru ? ` · Catatan guru: ${subData.catatanGuru}` : "";
      stEl.textContent = `Nilai Anda: ${subData.nilai}/100 (jawaban dikunci)${cat}`;
    } else if (isPastDue) stEl.textContent = "Batas waktu pengumpulan tugas ini telah berakhir.";
    else if (subData?.isOfflinePending) stEl.textContent = "⏳ Jawaban tersimpan di HP (antrean offline).";
    else if (subData) stEl.textContent = "✓ Jawaban tersimpan di server (bisa diperbarui sebelum tenggat).";
    else { stEl.textContent = ""; stEl.classList.add("hidden"); }
  }
  document.getElementById("sub-modal").classList.remove("hidden");
  if (!locked) teksEl?.focus();
}

export function initTugasHandlers(getCurrentUser, onSubmitted) {
  const subModal = document.getElementById("sub-modal");
  document.getElementById("btn-sub-cancel")?.addEventListener("click", () => subModal?.classList.add("hidden"));
  subModal?.addEventListener("click", (e) => {
    if (e.target === subModal || e.target.closest("[data-action='close-sub-modal']")) subModal.classList.add("hidden");
  });

  if (typeof window !== "undefined") {
    window.addEventListener("online", () => flushPendingSubmissions().then((n) => n > 0 && onSubmitted?.()));
    if (navigator.onLine) flushPendingSubmissions();
  }

  document.getElementById("btn-sub-save")?.addEventListener("click", async () => {
    const user = getCurrentUser();
    if (!activeAssignment || !user) return;
    if (activeAssignment.dueAt && tsToMs(activeAssignment.dueAt) < Date.now()) {
      return showToast("Maaf, batas waktu pengumpulan tugas ini telah lewat.", "error");
    }
    const teks = document.getElementById("sub-teks").value.trim();
    const link = document.getElementById("sub-link").value.trim();
    if (!teks && !link) return showToast("Isi minimal jawaban teks atau tautan tugas!", "warn");

    const subId = `${user.uid}__${activeAssignment.id}`;
    const wasExisting = !!activeSubData?._exists;
    const payload = { subId, uid: user.uid, assignmentId: activeAssignment.id, teks, link, wasExisting };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      savePendingSubmission(payload);
      showToast("Koneksi offline: Tugas diamankan di perangkat & otomatis dikirim saat online.", "warn");
      subModal?.classList.add("hidden");
      onSubmitted?.();
      return;
    }

    try {
      await writeSubmissionDoc(payload, wasExisting);
      removePendingSubmission(subId);
      showToast("Tugas berhasil dikumpulkan!", "ok");
      subModal?.classList.add("hidden");
      onSubmitted?.();
    } catch (err) {
      if (String(err?.message || "").includes("permission-denied")) {
        return showToast("Gagal mengirim: batas waktu lewat atau tugas sudah dinilai guru.", "error");
      }
      savePendingSubmission(payload);
      showToast("Koneksi terganggu: Jawaban diamankan ke antrean offline.", "warn");
      subModal?.classList.add("hidden");
      onSubmitted?.();
    }
  });
}
