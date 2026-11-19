// Admin Question Builder & Assessment Editor
import {
  auth,
  db,
  doc,
  setDoc,
  Timestamp
} from "../core/firebase.js";
import { escAttr } from "../core/dom.js";
import { showToast } from "../core/toast.js";
import { openPreviewModal } from "./qpreview.js";
import {
  openQModal,
  closeQModal,
  switchQModalType,
  addModalMatchRow,
  commitQModal
} from "./qbuilder-dialog.js";

export { openQModal, closeQModal, switchQModalType, addModalMatchRow, commitQModal };

let questionsList = [
  {
    id: "q1",
    tipe: "pg",
    teks: "Perubahan wujud zat dari cair menjadi gas disebut...",
    bobot: 25,
    pilihan: { A: "Membeku", B: "Menguap", C: "Menyublim", D: "Mengembun" },
    kunci: "B",
    kiri: ["", ""],
    kanan: ["", ""]
  },
  {
    id: "q2",
    tipe: "bs",
    teks: "Fotosintesis menghasilkan oksigen dan glukosa.",
    bobot: 25,
    pilihan: { A: "", B: "", C: "", D: "" },
    kunci: "true",
    kiri: ["", ""],
    kanan: ["", ""]
  }
];

let editingQuizCode = null;

export function getQuestionsList() {
  return questionsList;
}

export function setQuestionsList(list) {
  questionsList = list || [];
  window.questionsList = questionsList;
}

export function setEditingQuizCode(code) {
  editingQuizCode = code;
}

export function syncBuilderStats() {
  const cEl = document.getElementById("as-stat-count");
  const wEl = document.getElementById("as-stat-weight");
  const dEl = document.getElementById("as-stat-dur");
  const mEl = document.getElementById("as-stat-mode");
  if (cEl) cEl.textContent = questionsList.length;
  if (wEl) wEl.textContent = questionsList.reduce((acc, q) => acc + (Number(q.bobot) || 25), 0);
  if (dEl) dEl.textContent = document.getElementById("as-durasi")?.value || 60;
  if (mEl) {
    const mode = document.getElementById("as-mode")?.value || "latihan";
    mEl.textContent = mode === "ujian" ? "Ujian Resmi" : "Latihan";
  }
}

export function addQ(type) {
  const qid = "q" + (questionsList.length + 1);
  questionsList.push({
    id: qid,
    tipe: type,
    teks: "",
    bobot: 25,
    pilihan: { A: "", B: "", C: "", D: "" },
    kunci: type === "pg" ? "A" : type === "bs" ? "true" : "",
    kiri: ["", ""],
    kanan: ["", ""]
  });
  renderQBuilder();
}

export function renderQBuilder() {
  window.questionsList = questionsList;
  syncBuilderStats();
  const el = document.getElementById("as-questions-list");
  if (!el) return;
  if (!questionsList.length) {
    el.innerHTML = `<div style="text-align:center; padding:20px; color:var(--ink-3); font-size:13px">Belum ada butir soal. Klik salah satu tombol tipe soal di atas untuk mulai menyusun.</div>`;
    return;
  }
  el.innerHTML = questionsList
    .map((q, idx) => {
      let specFields = "";
      const badgeCls = `badge-${q.tipe}`;
      if (q.tipe === "pg") {
        const opts = ["A", "B", "C", "D"]
          .map(
            (o) =>
              `<div><label>Opsi ${o}</label><input value="${escAttr(
                q.pilihan[o] || ""
              )}" data-field="pilihan" data-opt="${o}" data-idx="${idx}"></div>`
          )
          .join("");
        const keys = ["A", "B", "C", "D"]
          .map((o) => `<option value="${o}" ${q.kunci === o ? "selected" : ""}>Opsi ${o}</option>`)
          .join("");
        specFields = `<div class="row">${opts}<div style="max-width:130px"><label>Kunci Benar</label><select data-field="kunci" data-idx="${idx}">${keys}</select></div></div>`;
      } else if (q.tipe === "bs") {
        specFields = `
        <label>Kunci Jawaban Benar / Salah</label>
        <select data-field="kunci" data-idx="${idx}" style="max-width:240px">
          <option value="true" ${q.kunci === "true" ? "selected" : ""}>Benar (True)</option>
          <option value="false" ${q.kunci === "false" ? "selected" : ""}>Salah (False)</option>
        </select>
      `;
      } else if (q.tipe === "match") {
        specFields = `
        <label>Pasangan Kolom A (Kiri) ↔ Kolom B (Kanan) — Pisahkan koma jika jamak</label>
        <div class="row">
          <div><input placeholder="Item Kiri: Ibukota RI, Mata Uang" value="${escAttr(
            (q.kiri || []).join(", ")
          )}" data-field="kiri" data-idx="${idx}"></div>
          <div><input placeholder="Pasangan Kanan: Nusantara, Rupiah" value="${escAttr(
            (q.kanan || []).join(", ")
          )}" data-field="kanan" data-idx="${idx}"></div>
        </div>
      `;
      } else if (q.tipe === "essay") {
        specFields = `<div class="badge badge-danger">Dinilai Manual Guru (Tanpa Kunci Otomatis)</div>`;
      }

      return `
      <div class="q-card" data-qtype="${q.tipe}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
          <div style="display:flex; align-items:center; gap:8px">
            <span class="time-pill" style="min-width:34px">0${idx + 1}</span>
            <strong>No. ${idx + 1}</strong>
            <span class="badge ${badgeCls}">${q.tipe.toUpperCase()}</span>
            <span style="font-size:12px; color:var(--ink-3)">Bobot: ${q.bobot || 25} Poin</span>
          </div>
          <button type="button" class="btn btn-danger btn-sm" data-action="delete-q" data-idx="${idx}">Hapus</button>
        </div>
        <label>Teks Soal</label>
        <textarea rows="2" placeholder="Ketik pokok pertanyaan di sini..." data-field="teks" data-idx="${idx}">${escAttr(
        q.teks
      )}</textarea>
        ${specFields}
      </div>
    `;
    })
    .join("");
}

export async function saveAssessment(onSaved) {
  let code = editingQuizCode || document.getElementById("as-code").value.trim();
  if (!code) {
    code = "q_" + Date.now().toString(36);
    document.getElementById("as-code").value = code;
  }
  const asKelasInput =
    document.querySelector("input#as-kelas") || document.getElementById("as-kelas");
  const kelasStr = (asKelasInput ? asKelasInput.value : "").trim();
  const classes = kelasStr.split(",").map((s) => s.trim()).filter(Boolean);
  const judul = document.getElementById("as-judul").value.trim();
  const mode = document.getElementById("as-mode").value;
  const duration = parseInt(document.getElementById("as-durasi").value, 10);
  const toleransiMulai = parseInt(document.getElementById("as-tol").value, 10);
  const maxAttemptsEl = document.getElementById("as-max-attempts");
  const maxAttempts = Math.min(3, Math.max(1, parseInt(maxAttemptsEl?.value, 10) || 1));
  const openVal = document.getElementById("as-open").value;
  const closeVal = document.getElementById("as-close").value;
  if (!code || !classes.length || !judul || !questionsList.length || !openVal || !closeVal) {
    showToast("Lengkapi metadata dan butir soal!", "warn");
    return;
  }

  const openAt = Timestamp.fromDate(new Date(openVal));
  const closeAt = Timestamp.fromDate(new Date(closeVal));
  const version = 1;
  const createdBy = auth.currentUser?.uid || "";

  try {
    if (mode === "ujian") {
      const keysMap = {};
      const strippedQuestions = questionsList.map((q) => {
        if (q.tipe === "match") {
          const map = {};
          (q.kiri || []).forEach((k, i) => {
            if (k) map[k] = (q.kanan || [])[i] || "";
          });
          keysMap[q.id] = map;
          return {
            id: q.id,
            tipe: q.tipe,
            teks: q.teks,
            bobot: q.bobot || 25,
            kiri: q.kiri || [],
            kanan: q.kanan || []
          };
        }
        if (q.kunci) keysMap[q.id] = q.kunci;
        const copy = { ...q };
        delete copy.kunci;
        return copy;
      });

      await setDoc(doc(db, "quizzes", code), {
        judul,
        mode,
        version,
        duration,
        toleransiMulai,
        maxAttempts,
        openAt,
        closeAt,
        classes,
        createdBy,
        questions: strippedQuestions
      });
      await setDoc(doc(db, "quizKeys", code), { keys: keysMap, version, closeAt, createdBy });
    } else {
      await setDoc(doc(db, "quizzes", code), {
        judul,
        mode,
        version,
        duration,
        toleransiMulai,
        maxAttempts,
        openAt,
        closeAt,
        classes,
        createdBy,
        questions: questionsList
      });
    }

    for (const k of classes) {
      await setDoc(
        doc(db, "classes", k),
        {
          quizzes: {
            [code]: {
              openAt,
              closeAt,
              duration,
              toleransiMulai,
              maxAttempts,
              mode,
              version,
              classes,
              judul
            }
          }
        },
        { merge: true }
      );
    }

    showToast(editingQuizCode ? "Asesmen berhasil diperbarui!" : "Asesmen berhasil diterbitkan!", "ok");
    editingQuizCode = null;
    document.getElementById("btn-as-save").textContent = "Simpan & Terbitkan Asesmen";
    if (typeof onSaved === "function") onSaved(code);
  } catch (e) {
    showToast("Gagal menyimpan asesmen: " + e.message, "error");
  }
}

export function initQBuilder(onSaved) {
  document.getElementById("as-mode")?.addEventListener("change", syncBuilderStats);
  document.getElementById("as-durasi")?.addEventListener("input", syncBuilderStats);

  // Modal and Quick-Add action listeners
  const actions = {
    "open-q-modal": (b) => openQModal(b.dataset.qtype || "pg"),
    "close-q-modal": () => closeQModal(),
    "switch-qmodal-type": (b) => switchQModalType(b.dataset.mtype || "pg"),
    "add-modal-match-row": () => addModalMatchRow(),
    "commit-q-modal": () => commitQModal(questionsList, renderQBuilder),
    "add-q": (b) => addQ(b.dataset.qtype || "pg")
  };
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (btn && actions[btn.dataset.action]) actions[btn.dataset.action](btn);
  });

  // Event delegation for the questions list (cards)
  const qListEl = document.getElementById("as-questions-list");
  if (qListEl) {
    qListEl.addEventListener("click", (e) => {
      const delBtn = e.target.closest("[data-action='delete-q']");
      if (delBtn) {
        const idx = parseInt(delBtn.dataset.idx, 10);
        if (!isNaN(idx)) {
          questionsList.splice(idx, 1);
          renderQBuilder();
        }
      }
    });

    qListEl.addEventListener("input", (e) => {
      const target = e.target;
      const idx = parseInt(target.dataset.idx, 10);
      if (isNaN(idx) || !questionsList[idx]) return;
      const field = target.dataset.field;
      if (field === "teks") {
        questionsList[idx].teks = target.value;
      } else if (field === "pilihan") {
        const opt = target.dataset.opt;
        if (opt) questionsList[idx].pilihan[opt] = target.value;
      } else if (field === "kiri") {
        questionsList[idx].kiri = target.value.split(",").map((x) => x.trim());
      } else if (field === "kanan") {
        questionsList[idx].kanan = target.value.split(",").map((x) => x.trim());
      }
    });

    qListEl.addEventListener("change", (e) => {
      const target = e.target;
      const idx = parseInt(target.dataset.idx, 10);
      if (isNaN(idx) || !questionsList[idx]) return;
      if (target.dataset.field === "kunci") {
        questionsList[idx].kunci = target.value;
      }
    });
  }

  document.getElementById("btn-as-save")?.addEventListener("click", () => {
    saveAssessment(onSaved);
  });
  document.getElementById("btn-as-preview")?.addEventListener("click", () => {
    openPreviewModal(questionsList);
  });
}
