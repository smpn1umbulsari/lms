// Template Generator & Batch Saver untuk Nilai Ujian Massal
import { downloadSheet } from "./excel-core.js";

const HEADER_NILAI = ["NIS", "Nama Siswa", "Kelas", "Nilai", "Catatan Guru"];

const PETUNJUK_NILAI = [
  ["Kolom", "Aturan"],
  ["NIS", "Nomor Induk Siswa (jangan diubah agar data cocok)."],
  ["Nama Siswa", "Sebagai referensi visual (tidak digunakan untuk pencocokan ID)."],
  ["Kelas", "Sebagai referensi visual."],
  ["Nilai", "Wajib diisi dengan angka bulat antara 0 hingga 100."],
  ["Catatan Guru", "Opsional. Umpan balik koreksi untuk siswa (maks. 1000 karakter)."],
  ["", ""],
  ["Petunjuk Simpan", "Setelah mengisi nilai, simpan file lalu unggah kembali di panel 'Import Nilai'."]
];

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

export async function downloadTemplateNilaiKuis(quizCode, { db, doc, getDoc, collection, query, where, getDocs, showToast }) {
  if (!quizCode) return showToast("Masukkan kode kuis terlebih dahulu!", "warn");
  try {
    const qSnap = await getDoc(doc(db, "quizzes", quizCode));
    if (!qSnap.exists()) return showToast(`Kuis ${quizCode} tidak ditemukan!`, "warn");
    const qData = qSnap.data();
    const classes = Array.isArray(qData.classes) ? qData.classes : qData.classes ? [qData.classes] : [];

    const studentList = [];
    if (classes.length) {
      for (const part of chunk(classes, 10)) {
        const uSnap = await getDocs(query(collection(db, "users"), where("kelas", "in", part)));
        uSnap.docs.forEach((d) => {
          const u = d.data();
          studentList.push({
            uid: d.id,
            nis: u.nis || d.id.slice(0, 8),
            nama: u.nama || d.id.slice(0, 8),
            kelas: u.kelas || "-"
          });
        });
      }
    }

    studentList.sort((a, b) => a.kelas.localeCompare(b.kelas) || a.nama.localeCompare(b.nama));
    const aoa = [HEADER_NILAI];
    studentList.forEach((s) => {
      aoa.push([String(s.nis), String(s.nama), String(s.kelas), "", ""]);
    });

    downloadSheet(`Template_Nilai_${quizCode}.xlsx`, aoa, `Nilai ${quizCode}`, {
      extra: [{ name: "Petunjuk", aoa: PETUNJUK_NILAI }],
      textCols: [0],
      padRows: Math.max(aoa.length, 50)
    });

    showToast(`Template nilai untuk ${quizCode} (${studentList.length} siswa) berhasil diunduh.`, "ok");
  } catch (err) {
    showToast("Gagal mengunduh template nilai: " + err.message, "error");
  }
}

export async function saveNilaiImport(quizCode, items, { auth, db, doc, collection, query, where, getDocs, writeBatch, Timestamp, showToast }) {
  if (!quizCode) return showToast("Kode kuis tidak valid!", "warn");
  if (!items.length) return showToast("Tidak ada nilai yang dapat disimpan.", "warn");

  try {
    const [uSnap, rSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(query(collection(db, "results"), where("quizId", "==", quizCode))).catch(() => ({ docs: [] }))
    ]);
    const prevRev = new Map(rSnap.docs.map((d) => [d.id, Number(d.data().revisionNo) || 0]));
    const nisToUid = new Map();
    uSnap.docs.forEach((d) => {
      const u = d.data();
      if (u.nis) nisToUid.set(String(u.nis).toLowerCase(), d.id);
      nisToUid.set(d.id.toLowerCase(), d.id); // dukung UID langsung
    });

    let tersimpan = 0;
    let tidakCocok = 0;
    const matched = [];

    items.forEach((it) => {
      const uid = nisToUid.get(String(it.identifier).toLowerCase());
      if (uid) {
        matched.push({ uid, it });
      } else {
        tidakCocok++;
      }
    });

    const gradedBy = auth?.currentUser?.uid || "";
    const BATCH_LIMIT = 400;
    for (let i = 0; i < matched.length; i += BATCH_LIMIT) {
      const bChunk = matched.slice(i, i + BATCH_LIMIT);
      const batch = writeBatch(db);

      bChunk.forEach(({ uid, it }) => {
        const resultId = `${uid}_${quizCode}_1`;
        const resRef = doc(db, "results", resultId);
        const nextRev = (prevRev.get(resultId) || 0) + 1;
        batch.set(
          resRef,
          {
            uid,
            quizId: quizCode,
            pct: it.nilai,
            points: it.nilai,
            maxScore: 100,
            totalScore: it.nilai,
            essayScore: it.nilai,
            catatanGuru: it.catatan || "",
            isFullyGraded: true,
            isImported: true,
            gradedBy,
            gradedAt: Timestamp.now(),
            revisionNo: nextRev
          },
          { merge: true }
        );
      });

      await batch.commit();
      tersimpan += bChunk.length;
    }

    const extraMsg = tidakCocok > 0 ? `, ${tidakCocok} NIS tidak ditemukan di database` : "";
    showToast(`Berhasil menyimpan ${tersimpan} nilai siswa untuk kuis ${quizCode}${extraMsg}.`, tersimpan > 0 ? "ok" : "warn");
    return { tersimpan, tidakCocok };
  } catch (err) {
    showToast("Gagal menyimpan nilai import: " + err.message, "error");
    throw err;
  }
}
