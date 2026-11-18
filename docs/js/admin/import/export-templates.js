// Template Generator & Excel (.xlsx) Exporter
// Menghasilkan template kosong dan mengekspor koleksi database ke spreadsheet.
import { downloadSheet } from "./excel-core.js";

export const HEADER_SOAL = ["Kode", "Tipe", "Teks", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Kunci", "Kiri", "Kanan"];
export const HEADER_SISWA = ["NIS", "Nama", "Kelas"];
export const HEADER_GURU = ["Email", "Nama", "NIP", "Mapel", "Aktif"];

export function downloadTemplateSoal() {
  downloadSheet("Template_Soal.xlsx", [HEADER_SOAL], "Template Soal");
}

export function downloadTemplateSiswa() {
  downloadSheet("Template_Siswa.xlsx", [HEADER_SISWA], "Template Siswa");
}

export async function exportSiswaXLSX({ db, collection, getDocs, showToast }) {
  try {
    const snap = await getDocs(collection(db, "siswa"));
    const aoa = [HEADER_SISWA];
    snap.docs.forEach((d) => {
      const s = d.data();
      aoa.push([String(d.id), String(s.nama || ""), String(s.kelas || "")]);
    });
    downloadSheet("Data_Siswa.xlsx", aoa, "Roster Siswa");
    showToast("Export Siswa (.xlsx) berhasil diunduh.", "ok");
  } catch (err) {
    showToast("Gagal export Siswa: " + err.message, "error");
  }
}

export async function exportGuruXLSX({ db, collection, getDocs, showToast }) {
  try {
    const snap = await getDocs(collection(db, "guruInvites"));
    const aoa = [HEADER_GURU];
    snap.docs.forEach((d) => {
      const g = d.data();
      aoa.push([
        String(d.id),
        String(g.nama || ""),
        String(g.nip || ""),
        String(g.mapel || ""),
        g.aktif === false ? "Tidak" : "Ya"
      ]);
    });
    downloadSheet("Data_Guru.xlsx", aoa, "Undangan Guru");
    showToast("Export Guru (.xlsx) berhasil diunduh.", "ok");
  } catch (err) {
    showToast("Gagal export Guru: " + err.message, "error");
  }
}

export async function exportSoalXLSX({ db, collection, getDocs, showToast }) {
  try {
    const [qSnap, kSnap] = await Promise.all([
      getDocs(collection(db, "quizzes")),
      getDocs(collection(db, "quizKeys")).catch(() => ({ docs: [] }))
    ]);
    const keysByQuiz = {};
    kSnap.docs.forEach((d) => {
      keysByQuiz[d.id] = d.data().keys || {};
    });

    const aoa = [HEADER_SOAL];
    qSnap.docs.forEach((d) => {
      const qz = d.data();
      const kode = d.id;
      const qKeys = keysByQuiz[kode] || {};
      (qz.questions || []).forEach((q) => {
        const tipe = q.tipe || "pg";
        const opsiA = q.pilihan?.A || "";
        const opsiB = q.pilihan?.B || "";
        const opsiC = q.pilihan?.C || "";
        const opsiD = q.pilihan?.D || "";
        let kunci = q.kunci !== undefined ? q.kunci : qKeys[q.id] ?? "";
        let kiriArr = Array.isArray(q.kiri) ? q.kiri.filter(Boolean) : [];
        let kananArr = Array.isArray(q.kanan) ? q.kanan.filter(Boolean) : [];

        if (tipe === "match") {
          if (kunci && typeof kunci === "object" && !Array.isArray(kunci)) {
            kiriArr = Object.keys(kunci);
            kananArr = Object.values(kunci);
          }
          kunci = kiriArr.map((l, idx) => `${l}>${kananArr[idx] || ""}`).join(";");
        }

        aoa.push([
          String(kode),
          String(tipe),
          String(q.teks || ""),
          String(opsiA),
          String(opsiB),
          String(opsiC),
          String(opsiD),
          String(kunci ?? ""),
          kiriArr.join("; "),
          kananArr.join("; ")
        ]);
      });
    });

    downloadSheet("Bank_Soal.xlsx", aoa, "Bank Soal");
    showToast("Export Bank Soal (.xlsx) berhasil diunduh.", "ok");
  } catch (err) {
    showToast("Gagal export Bank Soal: " + err.message, "error");
  }
}
