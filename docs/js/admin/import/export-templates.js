// Template Generator & Excel (.xlsx) Exporter
// Template berisi sheet "Petunjuk"; export mengambil data dari Firestore.
import { downloadSheet } from "./excel-core.js";
import { HEADER_SOAL, buildSoalRows } from "./soal-exporter.js";

export { HEADER_SOAL };
export const HEADER_SISWA = ["NIS", "Nama", "Kelas"];
export const HEADER_GURU = ["Email", "Nama", "NIP", "Mapel", "Aktif"];

const PETUNJUK_SOAL = [
  ["Kolom", "Aturan"],
  ["Kode", "Kode asesmen (huruf/angka/underscore). Satu berkas sebaiknya berisi satu kode."],
  ["Tipe", "pg | bs | match | essay (kosong = pg)"],
  ["Teks", "Teks pertanyaan (wajib)."],
  ["Opsi A-D", "Untuk PG minimal 2 opsi terisi. Untuk BS isi A=Benar, B=Salah."],
  ["Kunci", "PG: A-D. BS: A/B atau Benar/Salah. Match: kiri1>kanan1;kiri2>kanan2. Essay: rubrik (opsional)."],
  ["Kiri / Kanan", "Alternatif Match: daftar dipisah titik koma, jumlah kiri harus = kanan."],
  ["Bobot", "Opsional, angka 1-100. Kosong = 25."],
  ["", ""],
  ["Contoh PG", "Kode=q_ipa_1 | Tipe=pg | Teks=Ibukota Indonesia? | A=Jakarta | B=Bandung | Kunci=A"],
  ["Contoh Match", "Tipe=match | Kunci=Alveolus>Difusi O2;Trakea>Saring debu"]
];
const PETUNJUK_SISWA = [
  ["Kolom", "Aturan"],
  ["NIS", "Wajib & unik. Huruf/angka/titik/strip. Kolom sudah berformat teks agar nol depan (007) aman."],
  ["Nama", "Wajib."],
  ["Kelas", "Wajib. Harus sama dengan kode kelas yang terdaftar (mis. 7A)."],
  ["Catatan", "Mengimpor ulang TIDAK mereset siswa yang sudah login. Hanya Nama/Kelas yang diperbarui."]
];
const PETUNJUK_GURU = [
  ["Kolom", "Aturan"],
  ["Email", "Wajib & unik. Dipakai guru untuk mendaftar; otomatis huruf kecil."],
  ["Nama", "Wajib."],
  ["NIP / Mapel", "Opsional."],
  ["Aktif", "Ya / Tidak (kosong = Ya). Undangan 'Tidak' tidak dapat dipakai mendaftar."]
];

export function downloadTemplateSoal() {
  downloadSheet("Template_Soal.xlsx", [HEADER_SOAL], "Template Soal", {
    extra: [{ name: "Petunjuk", aoa: PETUNJUK_SOAL }]
  });
}

export function downloadTemplateSiswa() {
  downloadSheet("Template_Siswa.xlsx", [HEADER_SISWA], "Template Siswa", {
    extra: [{ name: "Petunjuk", aoa: PETUNJUK_SISWA }],
    textCols: [0, 1, 2],
    padRows: 500
  });
}

export function downloadTemplateGuru() {
  downloadSheet("Template_Guru.xlsx", [HEADER_GURU], "Template Guru", {
    extra: [{ name: "Petunjuk", aoa: PETUNJUK_GURU }]
  });
}

export async function exportSiswaXLSX({ db, collection, getDocs, showToast }) {
  try {
    const snap = await getDocs(collection(db, "siswa"));
    const rows = snap.docs
      .map((d) => [String(d.id), String(d.data().nama || ""), String(d.data().kelas || "")])
      .sort((a, b) => a[2].localeCompare(b[2]) || a[1].localeCompare(b[1]));
    downloadSheet("Data_Siswa.xlsx", [HEADER_SISWA, ...rows], "Roster Siswa");
    showToast(`Export ${rows.length} siswa (.xlsx) berhasil diunduh.`, "ok");
  } catch (err) {
    showToast("Gagal export Siswa: " + err.message, "error");
  }
}

export async function exportGuruXLSX({ db, collection, getDocs, showToast }) {
  try {
    const snap = await getDocs(collection(db, "guruInvites"));
    const rows = snap.docs.map((d) => {
      const g = d.data();
      return [String(d.id), String(g.nama || ""), String(g.nip || ""), String(g.mapel || ""), g.aktif === false ? "Tidak" : "Ya"];
    });
    downloadSheet("Data_Guru.xlsx", [HEADER_GURU, ...rows], "Undangan Guru");
    showToast(`Export ${rows.length} guru (.xlsx) berhasil diunduh.`, "ok");
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
    kSnap.docs.forEach((d) => (keysByQuiz[d.id] = d.data().keys || {}));
    const aoa = buildSoalRows(qSnap.docs.map((d) => ({ id: d.id, data: d.data() })), keysByQuiz);
    downloadSheet("Bank_Soal.xlsx", aoa, "Bank Soal");
    showToast(`Export ${aoa.length - 1} butir soal (.xlsx) berhasil diunduh.`, "ok");
  } catch (err) {
    showToast("Gagal export Bank Soal: " + err.message, "error");
  }
}

export async function exportSingleQuizXLSX(code, { db, doc, getDoc, showToast }) {
  try {
    const [qSnap, kSnap] = await Promise.all([
      getDoc(doc(db, "quizzes", code)),
      getDoc(doc(db, "quizKeys", code)).catch(() => null)
    ]);
    if (!qSnap.exists()) {
      showToast(`Asesmen ${code} tidak ditemukan.`, "warn");
      return;
    }
    const keysByQuiz = {};
    if (kSnap && kSnap.exists()) {
      keysByQuiz[code] = kSnap.data().keys || {};
    }
    const aoa = buildSoalRows([{ id: code, data: qSnap.data() }], keysByQuiz);
    downloadSheet(`Soal_${code}.xlsx`, aoa, `Soal ${code}`);
    showToast(`Export ${aoa.length - 1} butir soal (${code}) berhasil diunduh.`, "ok");
  } catch (err) {
    showToast("Gagal export Soal: " + err.message, "error");
  }
}

