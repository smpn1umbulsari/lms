// Admin Manajemen Materi Pelajaran
import {
  db,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  Timestamp
} from "../core/firebase.js";
import { escAttr } from "../core/dom.js";
import { urlsOf, embedsHTML } from "../core/media.js";
import { updateClassOptions } from "./ringkasan.js";
import { showToast, showConfirmDialog } from "../core/toast.js";

let materiData = [];
let editingMat = null;
let editingMatCreated = null;

export function getMateriData() {
  return materiData;
}

export function renderMateriTable(rows) {
  const tbody = document.querySelector("#mat-table tbody");
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:24px; color:var(--ink-3)">Belum ada materi pembelajaran. Klik <strong>+ Tambah Materi</strong> untuk menerbitkan modul.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map((d) => {
      const m = d.data || d;
      const hasLinks = urlsOf(m).length > 0;
      const typeBadge = hasLinks
        ? `<span class="badge badge-pg">Teks & Media (${urlsOf(m).length})</span>`
        : `<span class="badge badge-neutral">Modul Teks</span>`;
      return `<tr>
      <td>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap">
          <strong style="color:var(--ink); font-size:13.5px">${escAttr(m.judul)}</strong>
          ${typeBadge}
        </div>
        ${
          m.deskripsi
            ? `<div style="font-size:12px; color:var(--ink-2); margin-top:3px; max-width:440px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${escAttr(
                m.deskripsi
              )}</div>`
            : ""
        }
      </td>
      <td><span class="badge badge-neutral">${(m.classes || []).join(", ")}</span></td>
      <td style="min-width:240px">${embedsHTML(m) || '<span style="color:var(--ink-3)">-</span>'}</td>
      <td style="text-align:right; white-space:nowrap">
        <button type="button" class="btn btn-secondary btn-sm" data-action="edit-materi" data-id="${escAttr(d.id)}">Edit</button>
        <button type="button" class="btn btn-danger btn-sm" style="margin-left:6px" data-action="delete-materi" data-id="${escAttr(
          d.id
        )}">Hapus</button>
      </td>
    </tr>`;
    })
    .join("");
}

export function filterMateri() {
  const q = (document.getElementById("materi-search")?.value || "").trim().toLowerCase();
  const k = (document.getElementById("materi-kelas")?.value || "").trim().toLowerCase();
  const filtered = materiData.filter((item) => {
    const d = item.data || item;
    if (q) {
      const judul = String(d.judul || "").toLowerCase();
      const teks = String(d.deskripsi || "").toLowerCase();
      const id = String(item.id || "").toLowerCase();
      if (!judul.includes(q) && !teks.includes(q) && !id.includes(q)) return false;
    }
    if (k) {
      let cls = d.classes || [];
      if (typeof cls === "string") cls = cls.split(",").map((x) => x.trim());
      if (!Array.isArray(cls)) cls = [];
      if (!cls.some((c) => String(c).trim().toLowerCase() === k)) return false;
    }
    return true;
  });
  renderMateriTable(filtered);
}

export async function deleteMateri(id, onDataChanged) {
  const ok = await showConfirmDialog({
    title: "Hapus Materi Pembelajaran?",
    message: "Materi ini akan dihapus permanen dari portal belajar siswa.",
    confirmText: "Ya, Hapus Materi",
    isDanger: true
  });
  if (!ok) return;
  const mat = materiData.find((x) => x.id === id);
  const cls = mat?.classes || [];
  await deleteDoc(doc(db, "materials", id));
  for (const k of cls) {
    try {
      await setDoc(doc(db, "classes", k), { materialsVersion: Timestamp.now().seconds }, { merge: true });
    } catch (e) {}
  }
  showToast("Materi berhasil dihapus.", "ok");
  loadMateriTable(onDataChanged);
}

export async function editMateri(id) {
  const snapDoc = await getDoc(doc(db, "materials", id));
  if (!snapDoc.exists()) return;
  const m = snapDoc.data();
  editingMat = id;
  editingMatCreated = m.createdAt || Timestamp.now();
  document.getElementById("m-judul").value = m.judul || "";
  document.getElementById("m-kelas").value = (m.classes || []).join(", ");
  document.getElementById("m-deskripsi").value = m.deskripsi || "";
  const links = m.links && m.links.length ? m.links : m.link ? [m.link] : [];
  document.getElementById("m-link").value = links[0] || "";
  const extra = document.getElementById("m-links-extra");
  extra.innerHTML = "";
  links.slice(1).forEach((u) => {
    const row = document.createElement("div");
    row.className = "link-row";
    row.innerHTML =
      '<input class="m-link-extra" placeholder="https://..."><button type="button" class="link-rm" aria-label="Hapus">×</button>';
    row.querySelector("input").value = u;
    extra.appendChild(row);
  });
  const prev = document.getElementById("m-link-preview");
  if (prev) prev.innerHTML = embedsHTML({ links });
  document.getElementById("btn-mat-save").textContent = "Update Materi";
  document.getElementById("mat-form-panel").classList.remove("hidden");
  document.getElementById("mat-form-panel").scrollIntoView({ behavior: "smooth" });
}

export async function loadMateriTable(onDataChanged) {
  const snap = await getDocs(collection(db, "materials"));
  materiData = snap.docs.map((d) => ({ id: d.id, data: d.data(), ...d.data() }));
  updateClassOptions(document.getElementById("materi-kelas"), materiData, filterMateri);

  const searchVal = document.getElementById("materi-search")?.value.trim();
  const kelasVal = document.getElementById("materi-kelas")?.value.trim();
  if (searchVal || kelasVal) {
    filterMateri();
  } else {
    renderMateriTable(materiData);
  }

  if (typeof onDataChanged === "function") {
    onDataChanged(materiData);
  }
}

export function currentLinkValues() {
  const mLink = document.getElementById("m-link");
  const mainVal = mLink ? mLink.value : "";
  const extraVals = [...document.querySelectorAll(".m-link-extra")].map((i) => i.value);
  return [mainVal, ...extraVals].map((s) => s.trim()).filter(Boolean);
}

export function updateMateriPreview() {
  const prev = document.getElementById("m-link-preview");
  if (prev) {
    prev.innerHTML = embedsHTML({ links: currentLinkValues() });
  }
}

export function initMateriHandlers(onDataChanged) {
  const tbody = document.querySelector("#mat-table tbody");
  if (tbody) {
    tbody.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;
      if (!id) return;
      if (btn.dataset.action === "edit-materi") {
        await editMateri(id);
      } else if (btn.dataset.action === "delete-materi") {
        await deleteMateri(id, onDataChanged);
      }
    });
  }

  document.getElementById("materi-search")?.addEventListener("input", filterMateri);
  document.getElementById("m-link")?.addEventListener("input", updateMateriPreview);

  document.getElementById("btn-add-mat-link")?.addEventListener("click", () => {
    const extra = document.getElementById("m-links-extra");
    const row = document.createElement("div");
    row.className = "link-row";
    row.innerHTML =
      '<input class="m-link-extra" placeholder="https://..."><button type="button" class="link-rm" aria-label="Hapus">×</button>';
    extra.appendChild(row);
    row.querySelector("input").focus();
  });

  document.getElementById("m-links-extra")?.addEventListener("input", (e) => {
    if (e.target.classList.contains("m-link-extra")) updateMateriPreview();
  });

  document.getElementById("m-links-extra")?.addEventListener("click", (e) => {
    if (e.target.classList.contains("link-rm")) {
      e.target.closest(".link-row").remove();
      updateMateriPreview();
    }
  });

  const toggleMatForm = () => {
    const p = document.getElementById("mat-form-panel");
    p.classList.toggle("hidden");
    if (!p.classList.contains("hidden")) {
      editingMat = null;
      editingMatCreated = null;
      document.getElementById("m-judul").value = "";
      document.getElementById("m-kelas").value = "c1";
      document.getElementById("m-deskripsi").value = "";
      document.getElementById("m-link").value = "";
      document.getElementById("m-links-extra").innerHTML = "";
      document.getElementById("m-link-preview").innerHTML = "";
      document.getElementById("btn-mat-save").textContent = "Terbitkan Modul Materi";
      document.getElementById("m-judul").focus();
    }
  };

  document.getElementById("btn-mat-new")?.addEventListener("click", toggleMatForm);
  document.getElementById("btn-mat-toggle")?.addEventListener("click", toggleMatForm);


  document.getElementById("btn-mat-cancel")?.addEventListener("click", () => {
    document.getElementById("mat-form-panel")?.classList.add("hidden");
  });

  document.getElementById("btn-mat-save")?.addEventListener("click", async () => {
    const judul = document.getElementById("m-judul").value.trim();
    const kelasStr = document.getElementById("m-kelas").value.trim();
    const deskripsi = document.getElementById("m-deskripsi").value.trim();
    const links = currentLinkValues();
    if (!judul || !kelasStr) return showToast("Judul dan Kelas harus diisi!", "warn");
    const classes = kelasStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const id = editingMat || "mat_" + Date.now().toString(36);
    const createdAt = editingMatCreated || Timestamp.now();
    await setDoc(doc(db, "materials", id), {
      judul,
      classes,
      deskripsi,
      links,
      link: links[0] || "",
      createdAt,
      updatedAt: Timestamp.now()
    });
    for (const k of classes) {
      try {
        await setDoc(doc(db, "classes", k), { materialsVersion: Timestamp.now().seconds }, { merge: true });
      } catch (e) {}
    }
    showToast(editingMat ? "Materi berhasil diperbarui!" : "Materi baru berhasil diterbitkan!");
    document.getElementById("mat-form-panel")?.classList.add("hidden");
    loadMateriTable(onDataChanged);
  });
}
