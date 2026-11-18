// Admin Asesmen & Ujian Table Management
import {
  db,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  deleteField,
  collection
} from "../core/firebase.js";
import { escAttr } from "../core/dom.js";
import { showToast, showConfirmDialog } from "../core/toast.js";
import { updateClassOptions } from "./ringkasan.js";
import {
  setQuestionsList,
  setEditingQuizCode,
  renderQBuilder
} from "./qbuilder.js";

let asesmenData = [];
let savedOnDataChanged = null;

export function getAsesmenData() {
  return asesmenData;
}

export function renderAsesmenTable(rows) {
  const tbody = document.querySelector("#as-table tbody");
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--ink-3)">Belum ada asesmen yang dikonfigurasi. Gunakan lembar editor di atas untuk menyusun kuis.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows
    .map((d) => {
      const q = d.data || d;
      const open = q.openAt ? (q.openAt.toDate ? q.openAt.toDate() : new Date(q.openAt)) : null;
      const aksi = `<button type="button" class="btn btn-secondary btn-sm" data-action="edit-asesmen" data-code="${escAttr(
        d.id
      )}">Edit</button> <button type="button" class="btn btn-danger btn-sm" style="margin-left:6px" data-action="delete-asesmen" data-code="${escAttr(
        d.id
      )}" data-kelas="${escAttr((q.classes || []).join(","))}">Hapus</button>`;
      const modeBadge =
        q.mode === "ujian"
          ? '<span class="badge badge-pg">UJIAN RESMI</span>'
          : '<span class="badge badge-match">LATIHAN</span>';
      return `<tr>
      <td><strong>${escAttr(q.judul || d.id)}</strong></td>
      <td><code>${escAttr(d.id)}</code></td>
      <td>${modeBadge}</td>
      <td>${(q.classes || []).join(", ") || "-"}</td>
      <td class="tabular-nums">${open ? open.toLocaleDateString("id-ID") : "-"}</td>
      <td style="text-align:right; white-space:nowrap">${aksi}</td>
    </tr>`;
    })
    .join("");
}

export function filterAsesmen() {
  const q = (document.getElementById("as-search")?.value || "").trim().toLowerCase();
  const k = (document.querySelector("select#as-kelas")?.value || "").trim().toLowerCase();
  const filtered = asesmenData.filter((item) => {
    const d = item.data || item;
    if (q) {
      const judul = String(d.judul || "").toLowerCase();
      const id = String(item.id || "").toLowerCase();
      if (!judul.includes(q) && !id.includes(q)) return false;
    }
    if (k) {
      let cls = d.classes || [];
      if (typeof cls === "string") cls = cls.split(",").map((x) => x.trim());
      if (!Array.isArray(cls)) cls = [];
      if (!cls.some((c) => String(c).trim().toLowerCase() === k)) return false;
    }
    return true;
  });
  renderAsesmenTable(filtered);
}

export async function deleteAsesmen(code, kelasList, onDataChanged) {
  const ok = await showConfirmDialog({
    title: "Hapus Asesmen?",
    message: `Asesmen ${code} beserta kunci & jadwal akan ikut terhapus permanen dari sistem.`,
    confirmText: "Ya, Hapus Asesmen",
    isDanger: true
  });
  if (!ok) return;
  try {
    await deleteDoc(doc(db, "quizKeys", code));
    await deleteDoc(doc(db, "quizzes", code));
    for (const k of kelasList ? kelasList.split(",").filter(Boolean) : []) {
      try {
        await updateDoc(doc(db, "classes", k), { ["quizzes." + code]: deleteField() });
      } catch (e) {}
    }
    showToast(`Asesmen ${code} berhasil dihapus.`, "ok");
    const cb = typeof onDataChanged === "function" ? onDataChanged : savedOnDataChanged;
    loadAsesmenTable(cb);
  } catch (e) {
    showToast("Gagal hapus: " + e.message, "error");
  }
}

export async function editAsesmen(code) {
  try {
    const snapDoc = await getDoc(doc(db, "quizzes", code));
    if (!snapDoc.exists()) return showToast("Asesmen tidak ditemukan!", "warn");
    const qData = snapDoc.data();

    document.getElementById("as-code").value = code;
    const classes = qData.classes || [];
    const asKelasInput =
      document.querySelector("input#as-kelas") || document.getElementById("as-kelas");
    if (asKelasInput) asKelasInput.value = classes.join(", ");
    document.getElementById("as-mode").value = qData.mode || "latihan";
    document.getElementById("as-judul").value = qData.judul || "";
    document.getElementById("as-durasi").value =
      qData.duration !== undefined ? qData.duration : 60;
    document.getElementById("as-tol").value =
      qData.toleransiMulai !== undefined ? qData.toleransiMulai : 120;

    const toDTLocal = (ts) => {
      if (!ts) return "";
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      const p = (n) => String(n).padStart(2, "0");
      return (
        d.getFullYear() +
        "-" +
        p(d.getMonth() + 1) +
        "-" +
        p(d.getDate()) +
        "T" +
        p(d.getHours()) +
        ":" +
        p(d.getMinutes())
      );
    };

    document.getElementById("as-open").value = toDTLocal(qData.openAt);
    document.getElementById("as-close").value = toDTLocal(qData.closeAt);

    const cloned = JSON.parse(JSON.stringify(qData.questions || []));

    if (qData.mode === "ujian") {
      const keySnap = await getDoc(doc(db, "quizKeys", code));
      const keys = keySnap.exists() && keySnap.data().keys ? keySnap.data().keys : {};
      cloned.forEach((q) => {
        const kVal = keys[q.id];
        if (kVal && typeof kVal === "object" && !Array.isArray(kVal)) {
          q.kiri = Object.keys(kVal);
          q.kanan = Object.values(kVal);
        } else if (kVal !== undefined) {
          q.kunci = kVal;
        }
      });
    }

    setQuestionsList(cloned);
    setEditingQuizCode(code);
    renderQBuilder();
    document.getElementById("btn-as-save").textContent = "Update & Publikasikan Perubahan";
    document.getElementById("sec-asesmen").scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    showToast("Gagal memuat asesmen: " + e.message, "error");
  }
}

export async function loadAsesmenTable(onDataChanged) {
  if (typeof onDataChanged === "function") {
    savedOnDataChanged = onDataChanged;
  }
  const snap = await getDocs(collection(db, "quizzes"));
  asesmenData = snap.docs.map((d) => ({ id: d.id, data: d.data(), ...d.data() }));
  const sel = document.querySelector("select#as-kelas");
  updateClassOptions(sel, asesmenData, filterAsesmen);

  const searchVal = document.getElementById("as-search")?.value.trim();
  const kelasVal = sel?.value.trim();
  if (searchVal || kelasVal) {
    filterAsesmen();
  } else {
    renderAsesmenTable(asesmenData);
  }

  if (typeof onDataChanged === "function") {
    onDataChanged(asesmenData);
  }
}

export function initAsesmenHandlers(onDataChanged) {
  const tbody = document.querySelector("#as-table tbody");
  if (tbody) {
    tbody.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const code = btn.dataset.code;
      if (btn.dataset.action === "edit-asesmen") {
        await editAsesmen(code);
      } else if (btn.dataset.action === "delete-asesmen") {
        await deleteAsesmen(code, btn.dataset.kelas || "", onDataChanged);
      }
    });
  }

  document.getElementById("as-search")?.addEventListener("input", filterAsesmen);
  document.getElementById("as-search")?.addEventListener("change", filterAsesmen);
}
