// Admin Question Builder & Assessment Editor
import {
  db,
  doc,
  setDoc,
  Timestamp
} from "../core/firebase.js";
import { escAttr } from "../core/dom.js";
import { showToast } from "../core/toast.js";
import { openPreviewModal } from "./qpreview.js";

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

let activeModalType = "pg";
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

export function openQModal(type = "pg") {
  switchQModalType(type);
  document.getElementById("mq-teks").value = "";
  document.getElementById("mq-bobot").value = "25";
  document.getElementById("mq-pg-a").value = "";
  document.getElementById("mq-pg-b").value = "";
  document.getElementById("mq-pg-c").value = "";
  document.getElementById("mq-pg-d").value = "";
  document.getElementById("modal-add-q")?.classList.remove("hidden");
}

export function closeQModal() {
  document.getElementById("modal-add-q")?.classList.add("hidden");
}

export function switchQModalType(type) {
  activeModalType = type;
  document.querySelectorAll("#modal-add-q .seg-tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.mtype === type);
  });
  ["pg", "bs", "match", "essay"].forEach((t) => {
    document.getElementById("mq-panel-" + t)?.classList.toggle("hidden", t !== type);
  });
}

export function addModalMatchRow() {
  const wrap = document.getElementById("mq-match-rows");
  if (!wrap) return;
  const idx = wrap.querySelectorAll(".mq-match-pair").length + 1;
  const div = document.createElement("div");
  div.className = "row mq-match-pair";
  div.innerHTML = `
    <div><label>Kolom A (Premis ${idx})</label><input class="mq-kiri" placeholder="Premis ${idx}"></div>
    <div><label>Kolom B (Pasangan Benar ${idx})</label><input class="mq-kanan" placeholder="Pasangan ${idx}"></div>
  `;
  wrap.appendChild(div);
}

export function commitQModal() {
  const teks = document.getElementById("mq-teks").value.trim();
  const bobot = parseInt(document.getElementById("mq-bobot").value, 10) || 25;
  const qid = "q" + (questionsList.length + 1);
  const newQ = {
    id: qid,
    tipe: activeModalType,
    teks,
    bobot,
    pilihan: {
      A: document.getElementById("mq-pg-a").value.trim(),
      B: document.getElementById("mq-pg-b").value.trim(),
      C: document.getElementById("mq-pg-c").value.trim(),
      D: document.getElementById("mq-pg-d").value.trim()
    },
    kunci:
      activeModalType === "pg"
        ? document.getElementById("mq-pg-key").value
        : activeModalType === "bs"
        ? document.getElementById("mq-bs-key").value
        : "",
    kiri: [...document.querySelectorAll("#mq-match-rows .mq-kiri")]
      .map((i) => i.value.trim())
      .filter(Boolean),
    kanan: [...document.querySelectorAll("#mq-match-rows .mq-kanan")]
      .map((i) => i.value.trim())
      .filter(Boolean)
  };
  if (newQ.kiri.length === 0) newQ.kiri = ["", ""];
  if (newQ.kanan.length === 0) newQ.kanan = ["", ""];
  questionsList.push(newQ);
  renderQBuilder();
  closeQModal();
  showToast(`Butir soal #${questionsList.length} (${activeModalType.toUpperCase()}) ditambahkan`);
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
        specFields = `
        <div class="row">
          <div><label>Opsi A</label><input value="${escAttr(
            q.pilihan.A || ""
          )}" oninput="questionsList[${idx}].pilihan.A=this.value"></div>
          <div><label>Opsi B</label><input value="${escAttr(
            q.pilihan.B || ""
          )}" oninput="questionsList[${idx}].pilihan.B=this.value"></div>
          <div><label>Opsi C</label><input value="${escAttr(
            q.pilihan.C || ""
          )}" oninput="questionsList[${idx}].pilihan.C=this.value"></div>
          <div><label>Opsi D</label><input value="${escAttr(
            q.pilihan.D || ""
          )}" oninput="questionsList[${idx}].pilihan.D=this.value"></div>
          <div style="max-width:130px"><label>Kunci Benar</label><select onchange="questionsList[${idx}].kunci=this.value">
            ${["A", "B", "C", "D"]
              .map(
                (o) =>
                  `<option value="${o}" ${q.kunci === o ? "selected" : ""}>Opsi ${o}</option>`
              )
              .join("")}
          </select></div>
        </div>
      `;
      } else if (q.tipe === "bs") {
        specFields = `
        <label>Kunci Jawaban Benar / Salah</label>
        <select onchange="questionsList[${idx}].kunci=this.value" style="max-width:240px">
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
          )}" oninput="questionsList[${idx}].kiri=this.value.split(',').map(x=>x.trim())"></div>
          <div><input placeholder="Pasangan Kanan: Nusantara, Rupiah" value="${escAttr(
            (q.kanan || []).join(", ")
          )}" oninput="questionsList[${idx}].kanan=this.value.split(',').map(x=>x.trim())"></div>
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
          <button class="btn btn-danger btn-sm" onclick="questionsList.splice(${idx},1); renderQBuilder()">Hapus</button>
        </div>
        <label>Teks Soal</label>
        <textarea rows="2" placeholder="Ketik pokok pertanyaan di sini..." oninput="questionsList[${idx}].teks=this.value">${escAttr(
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
  const kelas = (asKelasInput ? asKelasInput.value : "").trim();
  const judul = document.getElementById("as-judul").value.trim();
  const mode = document.getElementById("as-mode").value;
  const duration = parseInt(document.getElementById("as-durasi").value, 10);
  const toleransiMulai = parseInt(document.getElementById("as-tol").value, 10);
  const openVal = document.getElementById("as-open").value;
  const closeVal = document.getElementById("as-close").value;
  if (!code || !kelas || !judul || !questionsList.length || !openVal || !closeVal) {
    showToast("Lengkapi metadata dan butir soal!", "warn");
    return;
  }

  const openAt = Timestamp.fromDate(new Date(openVal));
  const closeAt = Timestamp.fromDate(new Date(closeVal));
  const version = 1;

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
        openAt,
        closeAt,
        classes: [kelas],
        questions: strippedQuestions
      });
      await setDoc(doc(db, "quizKeys", code), { keys: keysMap, version, closeAt });
    } else {
      await setDoc(doc(db, "quizzes", code), {
        judul,
        mode,
        version,
        duration,
        toleransiMulai,
        openAt,
        closeAt,
        classes: [kelas],
        questions: questionsList
      });
    }

    await setDoc(
      doc(db, "classes", kelas),
      {
        quizzes: {
          [code]: {
            openAt,
            closeAt,
            duration,
            toleransiMulai,
            version,
            classes: [kelas],
            judul
          }
        }
      },
      { merge: true }
    );

    showToast(editingQuizCode ? "Asesmen berhasil diperbarui!" : "Asesmen berhasil diterbitkan!", "ok");
    editingQuizCode = null;
    document.getElementById("btn-as-save").textContent = "Simpan & Terbitkan Asesmen";
    if (typeof onSaved === "function") onSaved(code);
  } catch (e) {
    showToast("Gagal menyimpan asesmen: " + e.message, "error");
  }
}

export function initQBuilder(onSaved) {
  window._syncBuilderStats = syncBuilderStats;
  window._openQModal = openQModal;
  window._closeQModal = closeQModal;
  window._switchQModalType = switchQModalType;
  window._addModalMatchRow = addModalMatchRow;
  window._commitQModal = commitQModal;
  window._addQ = addQ;
  window.renderQBuilder = renderQBuilder;

  document.getElementById("btn-as-save")?.addEventListener("click", () => {
    saveAssessment(onSaved);
  });
  document.getElementById("btn-as-preview")?.addEventListener("click", () => {
    openPreviewModal(questionsList);
  });
}
