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
    showToast("Rekap nilai tugas berhasil diunduh.", "ok");
  } catch (e) {
    showToast("Gagal mengunduh rekap nilai tugas: " + e.message, "error");
  }
}

export async function exportUjianCSV() {
  const currentAttempts = getCurrentAttempts();
  if (!currentAttempts.length) {
    showToast("Muat lembar jawaban terlebih dahulu!", "warn");
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

export async function exportRekapTerpaduCSV() {
  const targetKelasInput = prompt(
    "Masukkan kode kelas target untuk rekap terpadu (kosongkan untuk semua kelas):",
    "c1"
  );
  if (targetKelasInput === null) return;
  const targetKelas = targetKelasInput.trim().toLowerCase();

  try {
    const [uSnap, asgSnap, subSnap, qSnap, resSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "assignments")),
      getDocs(collection(db, "submissions")),
      getDocs(collection(db, "quizzes")),
      getDocs(collection(db, "results"))
    ]);

    const assignments = asgSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((a) => {
        if (!targetKelas) return true;
        const cls = Array.isArray(a.classes) ? a.classes : [a.classes];
        return cls.map((c) => String(c).toLowerCase()).includes(targetKelas);
      });

    const quizzes = qSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((q) => {
        if (!targetKelas) return true;
        const cls = Array.isArray(q.classes) ? q.classes : [q.classes];
        return cls.map((c) => String(c).toLowerCase()).includes(targetKelas);
      });

    const subMap = {};
    subSnap.docs.forEach((d) => {
      const s = d.data();
      if (!s.uid) return;
      if (!subMap[s.uid]) subMap[s.uid] = {};
      if (s.nilai !== undefined && s.nilai !== null && s.nilai !== "") {
        subMap[s.uid][s.assignmentId] = Number(s.nilai);
      }
    });

    const resMap = {};
    resSnap.docs.forEach((d) => {
      const r = d.data();
      if (!r.uid) return;
      if (!resMap[r.uid]) resMap[r.uid] = {};
      const score =
        r.totalScore !== undefined
          ? r.totalScore
          : r.score !== undefined
          ? r.score
          : r.nilai;
      if (score !== undefined && score !== null && score !== "") {
        resMap[r.uid][r.quizId || d.id] = Number(score);
      }
    });

    const studentMap = {};
    uSnap.docs.forEach((d) => {
      const u = d.data();
      const k = String(u.kelas || "").toLowerCase();
      if (!targetKelas || k === targetKelas) {
        studentMap[d.id] = {
          uid: d.id,
          nama: u.nama || d.id.slice(0, 8),
          kelas: u.kelas || targetKelas || "-"
        };
      }
    });

    Object.keys(subMap)
      .concat(Object.keys(resMap))
      .forEach((uid) => {
        if (!studentMap[uid] && (!targetKelas || targetKelas === "c1")) {
          studentMap[uid] = {
            uid,
            nama: uid.slice(0, 8),
            kelas: targetKelas || "c1"
          };
        }
      });

    const students = Object.values(studentMap);
    if (!students.length) {
      showToast("Tidak ditemukan data siswa untuk kriteria kelas ini.", "warn");
      return;
    }

    students.sort((a, b) => a.nama.localeCompare(b.nama));

    const asgHeaders = assignments.map((a) => `"${(a.judul || a.id).replace(/"/g, '""')}"`);
    const qHeaders = quizzes.map((q) => `"${(q.judul || q.id).replace(/"/g, '""')}"`);
    const headerRow = [
      '"UID"',
      '"Nama Siswa"',
      '"Kelas"',
      ...asgHeaders,
      '"Rata-rata Tugas"',
      ...qHeaders,
      '"Rata-rata Ujian"',
      '"Nilai Akhir (40% Tugas + 60% Ujian)"'
    ].join(",");

    const rows = students.map((s) => {
      const sSubs = subMap[s.uid] || {};
      const sRes = resMap[s.uid] || {};

      let sumTugas = 0,
        countTugas = 0;
      const tugasCols = assignments.map((a) => {
        const val = sSubs[a.id];
        if (val !== undefined) {
          sumTugas += val;
          countTugas++;
          return `"${val}"`;
        }
        return '""';
      });
      const avgTugas = countTugas ? Math.round(sumTugas / countTugas) : null;

      let sumUjian = 0,
        countUjian = 0;
      const qCols = quizzes.map((q) => {
        const val = sRes[q.id];
        if (val !== undefined) {
          sumUjian += val;
          countUjian++;
          return `"${val}"`;
        }
        return '""';
      });
      const avgUjian = countUjian ? Math.round(sumUjian / countUjian) : null;

      let finalScore = "";
      if (avgTugas !== null && avgUjian !== null) {
        finalScore = Math.round(avgTugas * 0.4 + avgUjian * 0.6);
      } else if (avgTugas !== null) {
        finalScore = avgTugas;
      } else if (avgUjian !== null) {
        finalScore = avgUjian;
      }

      return [
        `"${s.uid}"`,
        `"${s.nama.replace(/"/g, '""')}"`,
        `"${s.kelas.replace(/"/g, '""')}"`,
        ...tugasCols,
        `"${avgTugas !== null ? avgTugas : ""}"`,
        ...qCols,
        `"${avgUjian !== null ? avgUjian : ""}"`,
        `"${finalScore}"`
      ].join(",");
    });

    const csvContent = [headerRow, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Rekap_Terpadu_SITURI_${targetKelas || "Semua"}.csv`;
    link.click();
    showToast("Rekap nilai terpadu (tugas + ujian) berhasil diunduh.", "ok");
  } catch (err) {
    console.error("Gagal mengekspor rekap terpadu:", err);
    showToast("Gagal mengekspor rekap terpadu: " + err.message, "error");
  }
}

export function initCSVExport() {
  document.getElementById("btn-export-csv")?.addEventListener("click", exportUjianCSV);
  document.getElementById("btn-export-tugas-csv")?.addEventListener("click", exportTugasCSV);
  document.getElementById("btn-export-rekap-terpadu")?.addEventListener("click", exportRekapTerpaduCSV);
}
