// Student Tugas (Assignments & Submissions) Feature
import {
  db,
  doc,
  getDoc,
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

export async function loadTugas(currentUser, userProfile) {
  if (!userProfile?.kelas) return;
  const qSnap = await getDocs(
    query(collection(db, "assignments"), where("classes", "array-contains", userProfile.kelas))
  );
  const list = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
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
    const subDoc = await getDoc(doc(db, "submissions", `${currentUser.uid}__${t.id}`));
    const isSubmitted = subDoc.exists();
    const subData = isSubmitted ? subDoc.data() : null;
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
      <span class="badge ${isSubmitted ? "badge-ok" : "badge-warn"}">${isSubmitted ? "✓ Sudah Dikumpul" : "Belum Dikumpul"}</span>
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
  document.getElementById("sub-status").textContent = subData ? "Jawaban tersimpan sebelumnya." : "";
  document.getElementById("btn-sub-save").textContent = subData ? "Perbarui Jawaban" : "Kirim Tugas Sekarang";
  document.getElementById("sub-modal").classList.remove("hidden");
  document.getElementById("sub-modal").scrollIntoView({ behavior: "smooth" });
}

export function initTugasHandlers(getCurrentUser, onSubmitted) {
  document.getElementById("btn-sub-cancel")?.addEventListener("click", () => {
    document.getElementById("sub-modal")?.classList.add("hidden");
  });

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
    document.getElementById("sub-status").textContent = "✓ Berhasil disimpan!";
    setTimeout(() => {
      document.getElementById("sub-modal")?.classList.add("hidden");
      if (typeof onSubmitted === "function") onSubmitted();
    }, 1000);
  });
}
