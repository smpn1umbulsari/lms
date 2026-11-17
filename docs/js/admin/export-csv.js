// Admin CSV Export Utility
import {
  db,
  collection,
  query,
  where,
  getDocs
} from "../core/firebase.js";
import { getCurrentAttempts } from "./koreksi.js";
import { showToast } from "../core/toast.js";

export async function exportTugasCSV() {
  try {
    const [asgSnap, subSnap] = await Promise.all([
      getDocs(collection(db, "assignments")),
      getDocs(collection(db, "submissions"))
    ]);

    const subsByAsg = new Map();
    subSnap.docs.forEach((sd) => {
      const sub = sd.data();
      const aid = sub.assignmentId;
      if (!subsByAsg.has(aid)) subsByAsg.set(aid, []);
      subsByAsg.get(aid).push(sub);
    });

    let csv = "Judul Tugas,Kelas,UID,Nilai\n";
    asgSnap.docs.forEach((ad) => {
      const asg = ad.data();
      const aid = ad.id;
      const subs = subsByAsg.get(aid) || [];
      const judul = (asg.judul || "").replace(/"/g, '""');
      const kelas = (Array.isArray(asg.classes) ? asg.classes.join("|") : asg.classes || "").replace(
        /"/g,
        '""'
      );
      subs.forEach((s) => {
        const uid = (s.uid || "").replace(/"/g, '""');
        const nilai = s.nilai !== undefined && s.nilai !== null ? s.nilai : "";
        csv += `"${judul}","${kelas}","${uid}","${nilai}"\n`;
      });
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Rekap_Nilai_Tugas.csv";
    link.click();
    showToast("Rekap nilai tugas berhasil diunduh.");
  } catch (e) {
    alert("Gagal mengunduh rekap nilai tugas: " + e.message);
  }
}

export async function exportUjianCSV() {
  const currentAttempts = getCurrentAttempts();
  if (!currentAttempts.length) {
    alert("Muat lembar jawaban terlebih dahulu!");
    return;
  }
  const code = document.getElementById("gr-code").value.trim();

  let resMap = {},
    resByUid = {};
  try {
    const resSnap = await getDocs(
      query(collection(db, "results"), where("quizId", "==", code))
    );
    resSnap.docs.forEach((d) => {
      const data = d.data();
      resMap[d.id] = data;
      if (data.uid) resByUid[data.uid] = data;
    });
  } catch (e) {
    console.error("Gagal memuat results:", e);
  }

  let csv = "UID,QuizId,AttemptId,Status,Nilai\n";
  currentAttempts.forEach((a) => {
    const res = resMap[a.id] || resByUid[a.uid];
    let val = "";
    if (res && res.totalScore !== undefined && res.totalScore !== null) val = res.totalScore;
    else if (res && res.score !== undefined && res.score !== null) val = res.score;
    else if (res && res.nilai !== undefined && res.nilai !== null) val = res.nilai;
    else if (res && res.total !== undefined && res.total !== null) val = res.total;
    else if (a.totalScore !== undefined && a.totalScore !== null) val = a.totalScore;
    else if (a.score !== undefined && a.score !== null) val = a.score;
    else if (a.nilai !== undefined && a.nilai !== null) val = a.nilai;
    else if (a.benar !== undefined && a.benar !== null) val = a.benar;
    else if (a.total !== undefined && a.total !== null) val = a.total;

    csv += `"${a.uid}","${a.quizId}","${a.id}","Submitted","${val}"\n`;
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Rekap_Ujian_${code || "kuis"}.csv`;
  link.click();
}

export function initCSVExport() {
  document.getElementById("btn-export-csv")?.addEventListener("click", exportUjianCSV);
  document.getElementById("btn-export-tugas-csv")?.addEventListener("click", exportTugasCSV);
}
