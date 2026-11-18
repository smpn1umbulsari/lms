// Admin Penugasan & Pengumpulan Siswa
import {
  db,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  Timestamp
} from "../core/firebase.js";
import { escAttr } from "../core/dom.js";
import { mediaEmbed } from "../core/media.js";
import { updateClassOptions } from "./ringkasan.js";
import { showToast, showConfirmDialog } from "../core/toast.js";

let tugasData = [];
let editingAsg = null;
let editingAsgCreated = null;

export function getTugasData() {
  return tugasData;
}

export function renderTugasTable(rows) {
  const tbody = document.querySelector("#tug-table tbody");
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--ink-3)">Belum ada penugasan aktif. Klik <strong>+ Buat Tugas Baru</strong> untuk menambahkan.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map((d) => {
      const t = d.data || d;
      const dueStr = t.dueAt
        ? new Date(t.dueAt.toDate ? t.dueAt.toDate() : t.dueAt).toLocaleDateString("id-ID")
        : "-";
      return `<tr>
      <td>
        <strong>${escAttr(t.judul)}</strong>
        ${
          t.instruksi
            ? `<div style="font-size:12px; color:var(--ink-2); max-width:360px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">${escAttr(
                t.instruksi
              )}</div>`
            : ""
        }
      </td>
      <td><span class="badge badge-neutral">${(t.classes || []).join(", ")}</span></td>
      <td><span class="badge badge-match tabular-nums">${dueStr}</span></td>
      <td><button type="button" class="btn btn-secondary btn-sm" data-action="view-sub" data-id="${escAttr(
        d.id
      )}" data-title="${escAttr(t.judul || "")}">Lihat Kiriman</button></td>
      <td style="text-align:right; white-space:nowrap">
        <button type="button" class="btn btn-secondary btn-sm" data-action="edit-asg" data-id="${escAttr(d.id)}">Edit</button>
        <button type="button" class="btn btn-danger btn-sm" style="margin-left:6px" data-action="delete-asg" data-id="${escAttr(
          d.id
        )}">Hapus</button>
      </td>
    </tr>`;
    })
    .join("");
}

export function filterTugas() {
  const q = (document.getElementById("tug-search")?.value || "").trim().toLowerCase();
  const k = (document.getElementById("tug-kelas")?.value || "").trim().toLowerCase();
  const filtered = tugasData.filter((item) => {
    const d = item.data || item;
    if (q) {
      const judul = String(d.judul || "").toLowerCase();
      const teks = String(d.instruksi || "").toLowerCase();
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
  renderTugasTable(filtered);
}

export async function deleteAsg(id, onDataChanged) {
  const ok = await showConfirmDialog({
    title: "Hapus Penugasan?",
    message: "Tugas ini akan dihapus dari portal siswa (arsip kiriman siswa yang sudah masuk tetap aman).",
    confirmText: "Ya, Hapus Tugas",
    isDanger: true
  });
  if (!ok) return;
  await deleteDoc(doc(db, "assignments", id));
  showToast("Tugas berhasil dihapus.", "ok");
  loadTugasTable(onDataChanged);
}

export async function editAsg(id) {
  const snapDoc = await getDoc(doc(db, "assignments", id));
  if (!snapDoc.exists()) return;
  const t = snapDoc.data();
  editingAsg = id;
  editingAsgCreated = t.createdAt || Timestamp.now();
  document.getElementById("t-judul").value = t.judul || "";
  document.getElementById("t-kelas").value = (t.classes || []).join(", ");
  document.getElementById("t-instruksi").value = t.instruksi || "";
  if (t.dueAt) {
    const d = t.dueAt.toDate ? t.dueAt.toDate() : new Date(t.dueAt);
    const p = (n) => String(n).padStart(2, "0");
    document.getElementById("t-due").value =
      d.getFullYear() +
      "-" +
      p(d.getMonth() + 1) +
      "-" +
      p(d.getDate()) +
      "T" +
      p(d.getHours()) +
      ":" +
      p(d.getMinutes());
  }
  const links = t.links && t.links.length ? t.links : t.link ? [t.link] : [];
  document.getElementById("t-link").value = links[0] || "";
  const extra = document.getElementById("t-links-extra");
  extra.innerHTML = "";
  links.slice(1).forEach((u) => {
    const row = document.createElement("div");
    row.className = "link-row";
    row.innerHTML =
      '<input class="t-link-extra" placeholder="https://..."><button type="button" class="link-rm" aria-label="Hapus">×</button>';
    row.querySelector("input").value = u;
    extra.appendChild(row);
  });
  document.getElementById("btn-tug-save").textContent = "Update Tugas";
  document.getElementById("tug-form-panel").classList.remove("hidden");
  document.getElementById("tug-form-panel").scrollIntoView({ behavior: "smooth" });
}

export async function viewSub(assignmentId, title) {
  document.getElementById("tug-sub-title").textContent = `Kiriman Tugas: ${title}`;
  const sSnap = await getDocs(
    query(collection(db, "submissions"), where("assignmentId", "==", assignmentId))
  );
  const stbody = document.querySelector("#tug-sub-table tbody");
  if (!sSnap.docs.length) {
    stbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:18px; color:var(--ink-3)">Belum ada kiriman siswa untuk tugas ini.</td></tr>`;
  } else {
    stbody.innerHTML = sSnap.docs
      .map((sd) => {
        const s = sd.data();
        return `<tr>
        <td><code>${s.uid.slice(0, 8)}</code></td>
        <td style="max-width:240px; white-space:pre-wrap">${escAttr(s.teks || "-")}</td>
        <td style="min-width:220px">${
          s.link ? `<div class="embed-wrap">${mediaEmbed(s.link)}</div>` : "-"
        }</td>
        <td><input id="score_${sd.id}" type="number" style="width:72px" value="${
          s.nilai !== undefined ? s.nilai : ""
        }" placeholder="0-100"></td>
        <td style="text-align:right"><button type="button" class="btn btn-primary btn-sm" data-action="grade-sub" data-sub-id="${escAttr(
          sd.id
        )}">Simpan Nilai</button></td>
      </tr>`;
      })
      .join("");
  }
  document.getElementById("tug-sub-panel").classList.remove("hidden");
  document.getElementById("tug-sub-panel").scrollIntoView({ behavior: "smooth" });
}

export async function gradeSub(subId) {
  const el = document.getElementById("score_" + subId);
  const n = parseInt(el.value, 10);
  if (isNaN(n) || n < 0 || n > 100) return showToast("Nilai harus berada di rentang 0-100", "warn");
  await updateDoc(doc(db, "submissions", subId), {
    nilai: n,
    gradedAt: Timestamp.now()
  });
  showToast("Nilai tugas tersimpan!");
}

export async function loadTugasTable(onDataChanged) {
  const snap = await getDocs(collection(db, "assignments"));
  tugasData = snap.docs.map((d) => ({ id: d.id, data: d.data(), ...d.data() }));
  updateClassOptions(document.getElementById("tug-kelas"), tugasData, filterTugas);

  const searchVal = document.getElementById("tug-search")?.value.trim();
  const kelasVal = document.getElementById("tug-kelas")?.value.trim();
  if (searchVal || kelasVal) {
    filterTugas();
  } else {
    renderTugasTable(tugasData);
  }

  if (typeof onDataChanged === "function") {
    onDataChanged(tugasData);
  }
}

export function initTugasHandlers(onDataChanged) {
  const tugTableBody = document.querySelector("#tug-table tbody");
  if (tugTableBody) {
    tugTableBody.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.action === "view-sub") {
        await viewSub(id, btn.dataset.title || "");
      } else if (btn.dataset.action === "edit-asg") {
        await editAsg(id);
      } else if (btn.dataset.action === "delete-asg") {
        await deleteAsg(id, onDataChanged);
      }
    });
  }

  const tugSubTableBody = document.querySelector("#tug-sub-table tbody");
  if (tugSubTableBody) {
    tugSubTableBody.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action='grade-sub']");
      if (!btn) return;
      const subId = btn.dataset.subId;
      if (subId) {
        await gradeSub(subId);
      }
    });
  }

  document.querySelectorAll("[data-action='close-sub-panel']").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("tug-sub-panel")?.classList.add("hidden");
    });
  });

  document.getElementById("tug-search")?.addEventListener("input", filterTugas);

  document.getElementById("btn-add-tug-link")?.addEventListener("click", () => {
    const extra = document.getElementById("t-links-extra");
    const row = document.createElement("div");
    row.className = "link-row";
    row.innerHTML =
      '<input class="t-link-extra" placeholder="https://..."><button type="button" class="link-rm" aria-label="Hapus">×</button>';
    extra.appendChild(row);
    row.querySelector("input").focus();
  });

  document.getElementById("t-links-extra")?.addEventListener("click", (e) => {
    if (e.target.classList.contains("link-rm")) {
      e.target.closest(".link-row").remove();
    }
  });

  const toggleForm = () => {
    const p = document.getElementById("tug-form-panel");
    p.classList.toggle("hidden");
    if (!p.classList.contains("hidden")) {
      editingAsg = null;
      editingAsgCreated = null;
      document.getElementById("t-judul").value = "";
      document.getElementById("t-kelas").value = "c1";
      document.getElementById("t-instruksi").value = "";
      document.getElementById("t-due").value = "";
      document.getElementById("t-link").value = "";
      document.getElementById("t-links-extra").innerHTML = "";
      document.getElementById("btn-tug-save").textContent = "Publikasikan Tugas";
      document.getElementById("t-judul").focus();
    }
  };

  document.getElementById("btn-tug-new")?.addEventListener("click", toggleForm);
  document.getElementById("btn-tug-toggle")?.addEventListener("click", toggleForm);


  document.getElementById("btn-tug-cancel")?.addEventListener("click", () => {
    document.getElementById("tug-form-panel")?.classList.add("hidden");
  });

  document.getElementById("btn-tug-save")?.addEventListener("click", async () => {
    const judul = document.getElementById("t-judul").value.trim();
    const kelasStr = document.getElementById("t-kelas").value.trim();
    const instruksi = document.getElementById("t-instruksi").value.trim();
    const dueVal = document.getElementById("t-due").value;
    const tLink = document.getElementById("t-link").value.trim();
    const extraLinks = [...document.querySelectorAll(".t-link-extra")]
      .map((i) => i.value.trim())
      .filter(Boolean);
    const links = [tLink, ...extraLinks].filter(Boolean);
    if (!judul || !kelasStr) return showToast("Judul dan Kelas harus diisi!", "warn");
    const classes = kelasStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const dueAt = dueVal ? Timestamp.fromDate(new Date(dueVal)) : null;
    const id = editingAsg || "asg_" + Date.now().toString(36);
    const createdAt = editingAsgCreated || Timestamp.now();
    await setDoc(doc(db, "assignments", id), {
      judul,
      classes,
      instruksi,
      dueAt,
      links,
      link: links[0] || "",
      createdAt,
      updatedAt: Timestamp.now()
    });
    showToast(editingAsg ? "Tugas berhasil diperbarui!" : "Tugas berhasil dipublikasikan!");
    document.getElementById("tug-form-panel")?.classList.add("hidden");
    loadTugasTable(onDataChanged);
  });
}
