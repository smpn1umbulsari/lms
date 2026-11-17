// Student Rekap Nilai (Grades & Scorecard) Feature
import {
  db,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where
} from "../core/firebase.js";
import { escAttr } from "../core/dom.js";

export async function loadNilai(currentUser, userProfile) {
  const tugasTbody = document.getElementById("nilai-tugas-tbody");
  const ujianTbody = document.getElementById("nilai-ujian-tbody");
  if (tugasTbody) {
    tugasTbody.innerHTML =
      '<tr><td colspan="3" style="text-align:center; color:var(--ink-3); padding:1rem">Memuat nilai tugas...</td></tr>';
  }
  if (ujianTbody) {
    ujianTbody.innerHTML =
      '<tr><td colspan="2" style="text-align:center; color:var(--ink-3); padding:1rem">Memuat nilai ujian...</td></tr>';
  }

  let hasError = false;

  // 1. Ambil Nilai Tugas (submissions)
  try {
    const qSnap = await getDocs(
      query(collection(db, "assignments"), where("classes", "array-contains", userProfile.kelas))
    );
    const assignments = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const subDocs = await Promise.all(
      assignments.map((t) => getDoc(doc(db, "submissions", `${currentUser.uid}__${t.id}`)))
    );
    const tugasRows = [];
    assignments.forEach((t, i) => {
      const subDoc = subDocs[i];
      if (subDoc && subDoc.exists()) {
        const s = subDoc.data();
        const hasNilai = s && s.nilai !== undefined && s.nilai !== null && s.nilai !== "";
        tugasRows.push(`
          <tr>
            <td><strong>${escAttr(t.judul)}</strong></td>
            <td class="tabular-nums">${hasNilai ? `${s.nilai}/100` : "-"}</td>
            <td><span class="badge ${
              hasNilai ? "badge-ok" : "badge-warn"
            }">${hasNilai ? "Sudah dinilai" : "Belum dinilai"}</span></td>
          </tr>
        `);
      }
    });

    if (tugasTbody) {
      tugasTbody.innerHTML = tugasRows.length
        ? tugasRows.join("")
        : '<tr><td colspan="3" style="text-align:center; color:var(--ink-3); padding:1rem">Belum ada nilai</td></tr>';
    }
  } catch (err) {
    hasError = true;
    console.error("Gagal memuat nilai tugas:", err);
    if (tugasTbody) {
      tugasTbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--danger); padding:1rem">Gagal memuat nilai tugas: ${escAttr(
        err.message || "Terjadi kesalahan"
      )}</td></tr>`;
    }
  }

  // 2. Ambil Nilai Ujian (results, progress, attempts)
  try {
    const metaSnap = await getDoc(doc(db, "classes", userProfile.kelas)).catch(() => null);
    const quizzesMeta =
      metaSnap && metaSnap.exists() && metaSnap.data().quizzes ? metaSnap.data().quizzes : {};

    const progSnap = await getDoc(doc(db, "progress", currentUser.uid)).catch(() => null);
    const progData = progSnap && progSnap.exists() ? progSnap.data() : null;
    const quizScores = progData && progData.quizScores ? progData.quizScores : {};

    let resultsMap = {};
    try {
      const rSnap = await getDocs(
        query(collection(db, "results"), where("uid", "==", currentUser.uid))
      );
      rSnap.docs.forEach((d) => {
        const data = d.data();
        resultsMap[data.quizId || d.id] = data;
      });
    } catch (e) {}

    const quizKeys = Array.from(
      new Set([
        ...Object.keys(quizzesMeta),
        ...Object.keys(resultsMap),
        ...Object.keys(quizScores)
      ])
    );

    const ujianRows = [];
    for (const qid of quizKeys) {
      let resData = resultsMap[qid] || null;
      if (!resData) {
        const rDoc = await getDoc(doc(db, "results", `${currentUser.uid}_${qid}_1`)).catch(
          () => null
        );
        if (rDoc && rDoc.exists()) resData = rDoc.data();
      }

      let scoreText = null;
      if (
        resData &&
        (resData.totalScore !== undefined ||
          resData.score !== undefined ||
          resData.nilai !== undefined)
      ) {
        const val =
          resData.totalScore !== undefined
            ? resData.totalScore
            : resData.score !== undefined
            ? resData.score
            : resData.nilai;
        scoreText = `<span class="badge badge-ok tabular-nums">${val}</span>`;
      } else if (quizScores[qid] !== undefined) {
        scoreText = `<span class="badge badge-ok tabular-nums">${quizScores[qid]}%</span>`;
      } else {
        const aDoc = await getDoc(doc(db, "attempts", `${currentUser.uid}_${qid}_1`)).catch(
          () => null
        );
        if (aDoc && aDoc.exists()) {
          scoreText = `<span class="badge badge-warn">Menunggu Koreksi</span>`;
        }
      }

      if (scoreText !== null) {
        const examTitle =
          (quizzesMeta[qid] && quizzesMeta[qid].judul) || resData?.quizTitle || qid;
        ujianRows.push(`
          <tr>
            <td><strong>${escAttr(examTitle)}</strong></td>
            <td>${scoreText}</td>
          </tr>
        `);
      }
    }

    if (ujianTbody) {
      ujianTbody.innerHTML = ujianRows.length
        ? ujianRows.join("")
        : '<tr><td colspan="2" style="text-align:center; color:var(--ink-3); padding:1rem">Belum ada nilai</td></tr>';
    }
  } catch (err) {
    hasError = true;
    console.error("Gagal memuat nilai ujian:", err);
    if (ujianTbody) {
      ujianTbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:var(--danger); padding:1rem">Gagal memuat nilai ujian: ${escAttr(
        err.message || "Terjadi kesalahan"
      )}</td></tr>`;
    }
  }

  return !hasError;
}

export function filterNilaiSection(type) {
  const pTugas = document.getElementById("panel-nilai-tugas");
  const pUjian = document.getElementById("panel-nilai-ujian");
  if (type === "all") {
    pTugas?.classList.remove("hidden");
    pUjian?.classList.remove("hidden");
  } else if (type === "tugas") {
    pTugas?.classList.remove("hidden");
    pUjian?.classList.add("hidden");
  } else if (type === "ujian") {
    pTugas?.classList.add("hidden");
    pUjian?.classList.remove("hidden");
  }
}

window._filterNilaiSection = filterNilaiSection;

