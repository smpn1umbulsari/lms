// Panel Kiriman & Penilaian Tugas Siswa (Identitas Lengkap + Paginasi + Catatan)
import {
  auth,
  db,
  doc,
  documentId,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  limit,
  startAfter,
  getCountFromServer,
  Timestamp
} from "../core/firebase.js";
import { escAttr } from "../core/dom.js";
import { mediaEmbed } from "../core/media.js";
import { showToast } from "../core/toast.js";

const SUB_PAGE_SIZE = 50;
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

let subState = { assignmentId: "", title: "", items: [], total: 0, lastSnap: null, hasMore: false, userMap: new Map() };

function fmtDate(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

async function resolveUsers(uids) {
  const missing = [...new Set(uids.filter((u) => u && !subState.userMap.has(u)))];
  for (const part of chunk(missing, 10)) {
    const snap = await getDocs(query(collection(db, "users"), where(documentId(), "in", part))).catch(() => null);
    snap?.docs.forEach((d) => subState.userMap.set(d.id, d.data()));
  }
}

function renderSubRows() {
  const stbody = document.querySelector("#tug-sub-table tbody");
  if (!stbody) return;
  if (!subState.items.length) {
    stbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:18px; color:var(--ink-3)">Belum ada kiriman siswa untuk tugas ini.</td></tr>`;
  } else {
    stbody.innerHTML = subState.items
      .map((s) => {
        const u = subState.userMap.get(s.uid) || {};
        const nama = u.nama || `Akun ${String(s.uid).slice(0, 6)}`;
        const nis = u.nis || "-";
        const kelas = u.kelas || "-";
        return `<tr>
        <td>
          <strong style="color:var(--ink)">${escAttr(nama)}</strong>
          <div class="tabular-nums" style="font-size:11.5px; color:var(--ink-2)">NIS: <code>${escAttr(nis)}</code> · ${escAttr(kelas)}</div>
        </td>
        <td style="max-width:260px; white-space:pre-wrap">
          <div>${escAttr(s.teks || "-")}</div>
          <div class="tabular-nums" style="font-size:11px; color:var(--ink-3); margin-top:4px">Dikirim: ${escAttr(fmtDate(s.updatedAt || s.submittedAt))}</div>
        </td>
        <td style="min-width:200px">${s.link ? `<div class="embed-wrap">${mediaEmbed(s.link)}</div>` : "-"}</td>
        <td>
          <input id="score_${escAttr(s.id)}" type="number" min="0" max="100" style="width:88px; margin-bottom:6px" value="${s.nilai !== undefined ? escAttr(s.nilai) : ""}" placeholder="0-100">
          <input id="note_sub_${escAttr(s.id)}" type="text" style="min-width:160px; margin-bottom:0" value="${escAttr(s.catatanGuru || "")}" placeholder="Catatan guru (opsional)">
        </td>
        <td style="text-align:right"><button type="button" class="btn btn-primary btn-sm" data-action="grade-sub" data-sub-id="${escAttr(s.id)}">Simpan Nilai</button></td>
      </tr>`;
      })
      .join("");
  }

  const cntEl = document.getElementById("tug-sub-count");
  if (cntEl) cntEl.textContent = `Menampilkan ${subState.items.length} dari ${subState.total} kiriman`;
  const btnMore = document.getElementById("btn-tug-sub-more");
  if (btnMore) btnMore.classList.toggle("hidden", !subState.hasMore);
}

export async function viewSub(assignmentId, title, append = false) {
  if (!append) {
    subState = { assignmentId, title, items: [], total: 0, lastSnap: null, hasMore: false, userMap: subState.userMap };
  }
  document.getElementById("tug-sub-title").textContent = `Kiriman Tugas: ${subState.title}`;

  const q = append && subState.lastSnap
    ? query(collection(db, "submissions"), where("assignmentId", "==", assignmentId), startAfter(subState.lastSnap), limit(SUB_PAGE_SIZE))
    : query(collection(db, "submissions"), where("assignmentId", "==", assignmentId), limit(SUB_PAGE_SIZE));

  const [sSnap, cntSnap] = await Promise.all([
    getDocs(q),
    append ? Promise.resolve(null) : getCountFromServer(query(collection(db, "submissions"), where("assignmentId", "==", assignmentId))).catch(() => null)
  ]);

  if (!append) subState.total = cntSnap ? cntSnap.data().count : sSnap.docs.length;
  const rows = sSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  subState.lastSnap = sSnap.docs[sSnap.docs.length - 1] || subState.lastSnap;
  subState.hasMore = sSnap.docs.length === SUB_PAGE_SIZE && subState.items.length + rows.length < subState.total;
  subState.items = [...subState.items, ...rows];

  await resolveUsers(rows.map((r) => r.uid));
  renderSubRows();
  document.getElementById("tug-sub-panel").classList.remove("hidden");
  if (!append) document.getElementById("tug-sub-panel").scrollIntoView({ behavior: "smooth" });
}

export async function gradeSub(subId) {
  const el = document.getElementById("score_" + subId);
  const noteEl = document.getElementById("note_sub_" + subId);
  const n = parseInt(el?.value, 10);
  if (isNaN(n) || n < 0 || n > 100) return showToast("Nilai harus berada di rentang 0-100", "warn");
  await updateDoc(doc(db, "submissions", subId), {
    nilai: n,
    catatanGuru: (noteEl?.value || "").trim().slice(0, 1000),
    updatedAt: Timestamp.now(),
    gradedAt: Timestamp.now(),
    gradedBy: auth.currentUser?.uid || ""
  });
  showToast("Nilai & catatan tugas tersimpan!", "ok");
}

export function initTugasSubmissionsHandlers() {
  document.getElementById("btn-tug-sub-more")?.addEventListener("click", () => {
    if (subState.assignmentId) viewSub(subState.assignmentId, subState.title, true);
  });
}
