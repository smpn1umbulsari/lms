// Admin Export Nilai (CSV Excel-friendly: BOM UTF-8, NIS & Nama, anti formula-injection)
import { db, collection, doc, query, where, getDocs, getDoc } from "../core/firebase.js";
import { getCurrentAttempts } from "./koreksi.js";
import { showToast } from "../core/toast.js";
import { downloadCSV } from "../core/csv.js";
import { buildRekapRows, scoreOf } from "./export/rekap.js";

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const classesOf = (d) => (Array.isArray(d.classes) ? d.classes : d.classes ? [d.classes] : []);
const inClass = (d, k) => !k || classesOf(d).some((c) => String(c).toLowerCase() === k);

/** users per kelas (query `in`, maks 10 nilai per kueri) -> Map<uid, {uid,nis,nama,kelas}> */
async function loadStudents(kelasList) {
  const map = new Map();
  for (const part of chunk([...new Set(kelasList)].filter(Boolean), 10)) {
    const snap = await getDocs(query(collection(db, "users"), where("kelas", "in", part)));
    snap.docs.forEach((d) => {
      const u = d.data();
      map.set(d.id, { uid: d.id, nis: u.nis || "", nama: u.nama || d.id.slice(0, 8), kelas: u.kelas || "-" });
    });
  }
  return map;
}

const who = (map, uid) => map.get(uid) || { nis: "", nama: String(uid).slice(0, 8), kelas: "-" };

export async function exportTugasCSV() {
  try {
    const asgSnap = await getDocs(collection(db, "assignments"));
    const asgs = asgSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const students = await loadStudents(asgs.flatMap(classesOf));
    const subs = await Promise.all(
      asgs.map((a) => getDocs(query(collection(db, "submissions"), where("assignmentId", "==", a.id))))
    );
    const rows = [["Judul Tugas", "NIS", "Nama Siswa", "Kelas", "Nilai"]];
    asgs.forEach((a, i) => {
      subs[i].docs.forEach((sd) => {
        const s = sd.data();
        const w = who(students, s.uid);
        rows.push([a.judul || a.id, w.nis, w.nama, w.kelas, s.nilai ?? ""]);
      });
    });
    downloadCSV("Rekap_Nilai_Tugas.csv", rows);
    showToast(`Rekap nilai tugas (${rows.length - 1} baris) berhasil diunduh.`, "ok");
  } catch (e) {
    showToast("Gagal mengunduh rekap nilai tugas: " + e.message, "error");
  }
}

export async function exportUjianCSV() {
  const attempts = getCurrentAttempts();
  if (!attempts.length) return showToast("Muat lembar jawaban terlebih dahulu!", "warn");
  const code = document.getElementById("gr-code").value.trim();
  try {
    const [qSnap, resSnap] = await Promise.all([
      getDoc(doc(db, "quizzes", code)),
      getDocs(query(collection(db, "results"), where("quizId", "==", code)))
    ]);
    const students = await loadStudents(qSnap.exists() ? classesOf(qSnap.data()) : []);
    const resByUid = {};
    resSnap.docs.forEach((d) => {
      if (d.data().uid) resByUid[d.data().uid] = d.data();
    });
    const rows = [["NIS", "Nama Siswa", "Kelas", "Kode Kuis", "Nilai"]];
    attempts
      .map((a) => ({ a, w: who(students, a.uid) }))
      .sort((x, y) => x.w.kelas.localeCompare(y.w.kelas) || x.w.nama.localeCompare(y.w.nama))
      .forEach(({ a, w }) => {
        const v = scoreOf(resByUid[a.uid]) ?? scoreOf(a);
        rows.push([w.nis, w.nama, w.kelas, code, v ?? "(belum dinilai)"]);
      });
    downloadCSV(`Rekap_Ujian_${code || "kuis"}.csv`, rows);
    showToast(`Rekap ujian (${rows.length - 1} siswa) berhasil diunduh.`, "ok");
  } catch (e) {
    showToast("Gagal mengunduh rekap ujian: " + e.message, "error");
  }
}

export async function exportRekapTerpaduCSV() {
  const kelas = (document.getElementById("rekap-kelas")?.value || "").trim().toLowerCase();
  try {
    const [asgSnap, qSnap] = await Promise.all([
      getDocs(collection(db, "assignments")),
      getDocs(collection(db, "quizzes"))
    ]);
    const assignments = asgSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => inClass(a, kelas));
    const quizzes = qSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((q) => inClass(q, kelas));

    let students;
    if (kelas) {
      // kelas disimpan dengan huruf asli; cocokkan tanpa memandang kapitalisasi
      const kl = [...new Set([...assignments, ...quizzes].flatMap(classesOf))].filter((c) => String(c).toLowerCase() === kelas);
      students = await loadStudents(kl.length ? kl : [kelas]);
    } else {
      students = await loadStudents([...assignments, ...quizzes].flatMap(classesOf));
    }
    if (!students.size) return showToast("Tidak ditemukan data siswa untuk kriteria kelas ini.", "warn");

    const [subSnaps, resSnaps] = await Promise.all([
      Promise.all(assignments.map((a) => getDocs(query(collection(db, "submissions"), where("assignmentId", "==", a.id))))),
      Promise.all(quizzes.map((q) => getDocs(query(collection(db, "results"), where("quizId", "==", q.id)))))
    ]);
    const subMap = {};
    const resMap = {};
    subSnaps.forEach((snap, i) =>
      snap.docs.forEach((d) => {
        const s = d.data();
        if (s.nilai !== undefined && s.nilai !== null && s.nilai !== "") (subMap[s.uid] ||= {})[assignments[i].id] = Number(s.nilai);
      })
    );
    resSnaps.forEach((snap, i) =>
      snap.docs.forEach((d) => {
        const r = d.data();
        const sc = scoreOf(r);
        if (r.uid && sc !== undefined) (resMap[r.uid] ||= {})[quizzes[i].id] = sc;
      })
    );

    const rows = buildRekapRows({ students: [...students.values()], assignments, quizzes, subMap, resMap });
    downloadCSV(`Rekap_Terpadu_SITURI_${kelas || "Semua"}.csv`, rows);
    showToast(`Rekap terpadu (${rows.length - 1} siswa) berhasil diunduh.`, "ok");
  } catch (err) {
    console.error("Gagal mengekspor rekap terpadu:", err);
    showToast("Gagal mengekspor rekap terpadu: " + err.message, "error");
  }
}

export function initCSVExport() {
  document.getElementById("btn-export-csv")?.addEventListener("click", exportUjianCSV);
  document.getElementById("btn-export-tugas-csv")?.addEventListener("click", exportTugasCSV);
  document.getElementById("btn-export-rekap-terpadu")?.addEventListener("click", exportRekapTerpaduCSV);

  // Daftar kelas untuk filter rekap dimuat sekali saat pertama difokuskan (hemat baca)
  const sel = document.getElementById("rekap-kelas");
  sel?.addEventListener(
    "focus",
    async () => {
      try {
        const snap = await getDocs(collection(db, "classes"));
        const ids = snap.docs.map((d) => d.id).sort();
        sel.innerHTML = `<option value="">Semua kelas</option>` + ids.map((c) => `<option value="${c}">${c}</option>`).join("");
      } catch (e) {
        /* tetap gunakan "Semua kelas" */
      }
    },
    { once: true }
  );
}
