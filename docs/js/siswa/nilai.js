// Student Rekap Nilai (Pemisahan Tegas: Nilai Resmi Terverifikasi vs Riwayat Latihan Mandiri)
import { db, doc, getDoc, getDocs, collection, query, where } from "../core/firebase.js";
import { escAttr } from "../core/dom.js";
import { scoreOf } from "../admin/export/rekap.js";

function renderTugasNilaiRows(assignments, subSnap) {
  const subMap = new Map();
  subSnap.docs.forEach((d) => {
    const s = d.data();
    if (s.assignmentId) subMap.set(s.assignmentId, s);
    subMap.set(d.id, s);
  });
  const rows = [];
  assignments.forEach((t) => {
    const s = subMap.get(t.id);
    if (!s) return;
    const hasNilai = s.nilai !== undefined && s.nilai !== null && s.nilai !== "";
    rows.push(`
      <tr>
        <td data-label="Judul"><strong>${escAttr(t.judul)}</strong></td>
        <td data-label="Nilai" class="tabular-nums">${hasNilai ? `${s.nilai}/100` : "-"}</td>
        <td data-label="Status"><span class="badge ${hasNilai ? "badge-ok" : "badge-warn"}">${hasNilai ? "Sudah Dinilai" : "Menunggu Koreksi"}</span></td>
      </tr>`);
  });
  return rows;
}

export async function loadNilai(currentUser, userProfile) {
  const tugasTbody = document.getElementById("nilai-tugas-tbody");
  const ujianTbody = document.getElementById("nilai-ujian-tbody");
  const latihanTbody = document.getElementById("nilai-latihan-tbody");
  if (tugasTbody) tugasTbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--ink-3); padding:16px">Memuat nilai tugas...</td></tr>';
  if (ujianTbody) ujianTbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:var(--ink-3); padding:16px">Memuat nilai ujian...</td></tr>';

  let hasError = false;
  try {
    const [qSnap, subSnap] = await Promise.all([
      getDocs(query(collection(db, "assignments"), where("classes", "array-contains", userProfile.kelas))),
      getDocs(query(collection(db, "submissions"), where("uid", "==", currentUser.uid)))
    ]);
    const assignments = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const rows = renderTugasNilaiRows(assignments, subSnap);
    if (tugasTbody) {
      tugasTbody.innerHTML = rows.length ? rows.join("") : '<tr><td colspan="3" style="text-align:center; color:var(--ink-3); padding:16px">Belum ada nilai tugas</td></tr>';
    }
  } catch (err) {
    hasError = true;
    if (tugasTbody) tugasTbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--danger); padding:16px">Gagal memuat nilai tugas: ${escAttr(err.message)}</td></tr>`;
  }

  try {
    const [metaSnap, progSnap, resSnap, attSnap] = await Promise.all([
      getDoc(doc(db, "classes", userProfile.kelas)).catch(() => null),
      getDoc(doc(db, "progress", currentUser.uid)).catch(() => null),
      getDocs(query(collection(db, "results"), where("uid", "==", currentUser.uid))),
      getDocs(query(collection(db, "attempts"), where("uid", "==", currentUser.uid))).catch(() => ({ docs: [] }))
    ]);

    const quizzesMeta = metaSnap?.exists() && metaSnap.data().quizzes ? metaSnap.data().quizzes : {};
    const resultsByQ = new Map();
    resSnap.docs.forEach((d) => { const r = d.data(); if (r.quizId) resultsByQ.set(r.quizId, r); });
    const submittedByQ = new Set();
    attSnap.docs.forEach((d) => { const a = d.data(); if (a.quizId && a.submittedAt != null) submittedByQ.add(a.quizId); });

    const resmiKeys = Array.from(new Set([...Object.keys(quizzesMeta), ...resultsByQ.keys(), ...submittedByQ]));
    const ujianRows = [];
    resmiKeys.forEach((qid) => {
      const r = resultsByQ.get(qid);
      const val = scoreOf(r);
      let badge = "";
      if (val !== undefined) badge = `<span class="badge badge-ok tabular-nums">${val}/100</span>`;
      else if (submittedByQ.has(qid)) badge = `<span class="badge badge-warn">Menunggu Koreksi Guru</span>`;
      else return;
      const title = quizzesMeta[qid]?.judul || r?.quizTitle || qid;
      ujianRows.push(`<tr><td data-label="Ujian"><strong>${escAttr(title)}</strong></td><td data-label="Skor">${badge}</td></tr>`);
    });
    if (ujianTbody) {
      ujianTbody.innerHTML = ujianRows.length ? ujianRows.join("") : '<tr><td colspan="2" style="text-align:center; color:var(--ink-3); padding:16px">Belum ada nilai ujian resmi</td></tr>';
    }

    // Tabel terpisah: Riwayat Latihan Mandiri (progress.quizScores — bukan nilai rapor)
    const quizScores = progSnap?.exists() && progSnap.data().quizScores ? progSnap.data().quizScores : {};
    const latRows = Object.entries(quizScores).map(([qid, sc]) => {
      const title = quizzesMeta[qid]?.judul || qid;
      return `<tr><td data-label="Latihan"><strong>${escAttr(title)}</strong></td><td data-label="Skor Latihan"><span class="badge badge-neutral tabular-nums">${escAttr(sc)}%</span></td></tr>`;
    });
    if (latihanTbody) {
      latihanTbody.innerHTML = latRows.length ? latRows.join("") : '<tr><td colspan="2" style="text-align:center; color:var(--ink-3); padding:16px">Belum ada riwayat latihan mandiri</td></tr>';
    }
  } catch (err) {
    hasError = true;
    if (ujianTbody) ujianTbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:var(--danger); padding:16px">Gagal memuat nilai ujian: ${escAttr(err.message)}</td></tr>`;
  }

  return !hasError;
}

export function filterNilaiSection(type) {
  const pTugas = document.getElementById("panel-nilai-tugas");
  const pUjian = document.getElementById("panel-nilai-ujian");
  const pLatihan = document.getElementById("panel-nilai-latihan");
  if (type === "all") {
    pTugas?.classList.remove("hidden");
    pUjian?.classList.remove("hidden");
    pLatihan?.classList.remove("hidden");
  } else if (type === "tugas") {
    pTugas?.classList.remove("hidden");
    pUjian?.classList.add("hidden");
    pLatihan?.classList.add("hidden");
  } else if (type === "ujian") {
    pTugas?.classList.add("hidden");
    pUjian?.classList.remove("hidden");
    pLatihan?.classList.remove("hidden");
  }
}

export function initNilaiHandlers() {
  document.querySelectorAll("[data-action='filter-nilai']").forEach((btn) => {
    btn.addEventListener("click", () => filterNilaiSection(btn.dataset.filter || "all"));
  });
}
