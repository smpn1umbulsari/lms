// Template Generator & Excel (.xlsx) Exporter
// Template dilengkapi contoh siap pakai, border rapi, freeze header, dan sheet "Petunjuk".
import { downloadSheet } from "./excel-core.js";
import {
  HEADER_SOAL,
  SOAL_COL_WIDTHS,
  SOAL_CENTER_COLS,
  SOAL_TEXT_COLS,
  buildSoalSheetData
} from "./soal-exporter.js";

export { HEADER_SOAL };
export const HEADER_SISWA = ["NIS", "Nama", "Kelas"];
export const HEADER_GURU = ["Email", "Nama", "NIP", "Mapel", "Aktif"];

const PETUNJUK_SOAL = [
  ["Kolom", "Aturan"],
  ["No", "Nomor urut soal (membantu penomoran dan pengelompokan baris Menjodohkan)."],
  ["Kode", "Kode asesmen (huruf/angka/underscore). Satu berkas sebaiknya berisi satu kode."],
  ["Tipe", "pg | bs | match | essay (kosong = pg)."],
  ["Teks", "Teks pertanyaan (wajib). Ganti baris contoh pada sheet 'Template Soal' dengan soal Anda."],
  ["Opsi A-D", "Untuk PG minimal 2 opsi terisi. Untuk BS boleh isi Opsi A=Benar, Opsi B=Salah."],
  ["Kunci", "PG: A-D. BS: Benar/Salah atau True/False atau A/B. Match: cukup isi kolom Kiri & Kanan per baris. Essay: rubrik (opsional)."],
  ["Kiri / Kanan", "Khusus tipe match: tulis 1 pasangan per baris (baris No/Kode/Tipe/Teks di bawahnya boleh digabung/kosong). Alternatif 1 baris dipisah ';'."],
  ["Bobot", "Opsional, angka 1-100. Kosong = 25."],
  ["", ""],
  ["Tips MATCH", "Lihat contoh No. 3 di sheet 'Template Soal': 1 soal Menjodohkan dapat terdiri atas beberapa baris Kiri–Kanan agar mudah dibaca."]
];

const PETUNJUK_SISWA = [
  ["Kolom", "Aturan"],
  ["NIS", "Wajib & unik. Huruf/angka/titik/strip. Kolom diformat teks agar nol depan (mis. 007) tetap utuh."],
  ["Nama", "Wajib. Nama lengkap siswa."],
  ["Kelas", "Wajib. Samakan dengan kode kelas di sistem (mis. 7A, 7B, 8A)."],
  ["Catatan", "Timpa baris contoh sebelum impor. Impor ulang TIDAK mereset siswa yang sudah login; hanya Nama/Kelas diperbarui."]
];

const PETUNJUK_GURU = [
  ["Kolom", "Aturan"],
  ["Email", "Wajib & unik. Dipakai guru untuk masuk portal; otomatis huruf kecil."],
  ["Nama", "Wajib. Nama lengkap beserta gelar bila ada."],
  ["NIP / Mapel", "Opsional. Kolom NIP diformat teks agar 18 digit angka tidak berubah menjadi notasi ilmiah."],
  ["Aktif", "Ya / Tidak (kosong = Ya). Undangan 'Tidak' tidak dapat dipakai masuk."]
];

const SAMPLE_QUIZ = [
  {
    id: "u_ipa_01",
    data: {
      questions: [
        {
          id: "q1",
          tipe: "pg",
          teks: "Perubahan wujud zat dari cair menjadi gas disebut...",
          pilihan: { A: "Membeku", B: "Menguap", C: "Menyublim", D: "Mengembun" },
          kunci: "B",
          bobot: 25
        },
        {
          id: "q2",
          tipe: "bs",
          teks: "Fotosintesis pada tumbuhan menghasilkan oksigen dan glukosa.",
          pilihan: { A: "Benar", B: "Salah", C: "", D: "" },
          kunci: "Benar",
          bobot: 25
        },
        {
          id: "q3",
          tipe: "match",
          teks: "Pasangkan organ pernapasan berikut dengan fungsinya!",
          kiri: ["Alveolus", "Trakea", "Diafragma"],
          kanan: ["Pertukaran gas O2 dan CO2", "Menyaring partikel debu", "Otot pengatur rongga dada"],
          bobot: 25
        },
        {
          id: "q4",
          tipe: "essay",
          teks: "Jelaskan perbedaan pernapasan dada dan pernapasan perut!",
          kunci: "Sebutkan peran otot antar tulang rusuk dan diafragma",
          bobot: 25
        }
      ]
    }
  }
];

export function buildTemplateSoalSpec() {
  const sheet = buildSoalSheetData(SAMPLE_QUIZ);
  return {
    filename: "Template_Soal.xlsx",
    sheetName: "Template Soal",
    aoa: sheet.aoa,
    opts: {
      colWidths: SOAL_COL_WIDTHS,
      centerCols: SOAL_CENTER_COLS,
      textCols: SOAL_TEXT_COLS,
      borderPadRows: 25,
      merges: sheet.merges,
      rowGroups: sheet.rowGroups,
      extra: [{ name: "Petunjuk", aoa: PETUNJUK_SOAL }]
    }
  };
}

export function buildTemplateSiswaSpec() {
  return {
    filename: "Template_Siswa.xlsx",
    sheetName: "Template Siswa",
    aoa: [
      HEADER_SISWA,
      ["007", "Ahmad Rizki", "7A"],
      ["1001", "Siti Aisyah", "7A"],
      ["1002", "Budi Santoso", "7B"]
    ],
    opts: {
      colWidths: [16, 32, 12],
      textCols: [0, 1, 2],
      centerCols: [2],
      borderPadRows: 100,
      padRows: 500,
      extra: [{ name: "Petunjuk", aoa: PETUNJUK_SISWA }]
    }
  };
}

export function buildTemplateGuruSpec() {
  return {
    filename: "Template_Guru.xlsx",
    sheetName: "Template Guru",
    aoa: [
      HEADER_GURU,
      ["budi.santoso@smpn1umbulsari.sch.id", "Budi Santoso, S.Pd.", "198501122010011005", "IPA", "Ya"],
      ["siti.aminah@smpn1umbulsari.sch.id", "Siti Aminah, S.Pd.", "198804202014022003", "Matematika", "Ya"]
    ],
    opts: {
      colWidths: [36, 28, 22, 20, 10],
      textCols: [0, 2],
      centerCols: [4],
      borderPadRows: 40,
      extra: [{ name: "Petunjuk", aoa: PETUNJUK_GURU }]
    }
  };
}

export function downloadTemplateSoal() {
  const s = buildTemplateSoalSpec();
  downloadSheet(s.filename, s.aoa, s.sheetName, s.opts);
}

export function downloadTemplateSiswa() {
  const s = buildTemplateSiswaSpec();
  downloadSheet(s.filename, s.aoa, s.sheetName, s.opts);
}

export function downloadTemplateGuru() {
  const s = buildTemplateGuruSpec();
  downloadSheet(s.filename, s.aoa, s.sheetName, s.opts);
}

export async function exportSiswaXLSX({ db, collection, getDocs, showToast }) {
  try {
    const snap = await getDocs(collection(db, "siswa"));
    const rows = snap.docs
      .map((d) => [String(d.id), String(d.data().nama || ""), String(d.data().kelas || "")])
      .sort((a, b) => a[2].localeCompare(b[2]) || a[1].localeCompare(b[1]));
    downloadSheet("Data_Siswa.xlsx", [HEADER_SISWA, ...rows], "Roster Siswa", {
      colWidths: [16, 32, 12],
      textCols: [0, 1, 2],
      centerCols: [2],
      borderPadRows: Math.max(rows.length + 1, 10)
    });
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
    downloadSheet("Data_Guru.xlsx", [HEADER_GURU, ...rows], "Undangan Guru", {
      colWidths: [36, 28, 22, 20, 10],
      textCols: [0, 2],
      centerCols: [4],
      borderPadRows: Math.max(rows.length + 1, 10)
    });
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
    const sheet = buildSoalSheetData(qSnap.docs.map((d) => ({ id: d.id, data: d.data() })), keysByQuiz);
    downloadSheet("Bank_Soal.xlsx", sheet.aoa, "Bank Soal", {
      colWidths: SOAL_COL_WIDTHS,
      centerCols: SOAL_CENTER_COLS,
      textCols: SOAL_TEXT_COLS,
      merges: sheet.merges,
      rowGroups: sheet.rowGroups,
      borderPadRows: sheet.aoa.length
    });
    showToast(`Export ${sheet.questionCount} butir soal (.xlsx) berhasil diunduh.`, "ok");
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
    const sheet = buildSoalSheetData([{ id: code, data: qSnap.data() }], keysByQuiz);
    downloadSheet(`Soal_${code}.xlsx`, sheet.aoa, `Soal ${code}`, {
      colWidths: SOAL_COL_WIDTHS,
      centerCols: SOAL_CENTER_COLS,
      textCols: SOAL_TEXT_COLS,
      merges: sheet.merges,
      rowGroups: sheet.rowGroups,
      borderPadRows: sheet.aoa.length
    });
    showToast(`Export ${sheet.questionCount} butir soal (${code}) berhasil diunduh.`, "ok");
  } catch (err) {
    showToast("Gagal export Soal: " + err.message, "error");
  }
}
