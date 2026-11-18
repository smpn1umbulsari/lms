// Modal Dialog Handler untuk Question Builder (Tambah Soal Terstruktur)
import { showToast } from "../core/toast.js";

let activeModalType = "pg";

export function openQModal(type = "pg") {
  switchQModalType(type);
  document.getElementById("mq-teks").value = "";
  document.getElementById("mq-bobot").value = "25";
  ["a", "b", "c", "d"].forEach((k) => {
    const el = document.getElementById("mq-pg-" + k);
    if (el) el.value = "";
  });
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

export function commitQModal(questionsList, onCommitted) {
  const teks = document.getElementById("mq-teks").value.trim();
  const bobot = parseInt(document.getElementById("mq-bobot").value, 10) || 25;
  const qid = "q" + (questionsList.length + 1);
  const pilihan = {};
  ["A", "B", "C", "D"].forEach((k) => {
    pilihan[k] = (document.getElementById("mq-pg-" + k.toLowerCase())?.value || "").trim();
  });
  const newQ = {
    id: qid,
    tipe: activeModalType,
    teks,
    bobot,
    pilihan,
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
  if (typeof onCommitted === "function") onCommitted();
  closeQModal();
  showToast(`Butir soal #${questionsList.length} (${activeModalType.toUpperCase()}) ditambahkan`);
}
