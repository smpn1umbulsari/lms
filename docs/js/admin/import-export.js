// Import & Export Excel Orchestrator (Soal, Siswa, Guru)
// Modul ini mengoordinasikan UI input file, pratinjau tabel, dan operasi batch Firestore.

import { readExcelFile, downloadSheet, esc, renderErrorsBox } from "./import/excel-core.js";
import { parseSoal } from "./import/soal-importer.js";
import { parseSiswa, parseGuru } from "./import/user-importer.js";
import {
  downloadTemplateSoal,
  downloadTemplateSiswa,
  exportSiswaXLSX,
  exportGuruXLSX,
  exportSoalXLSX
} from "./import/export-templates.js";

// Re-export untuk backward compatibility & automated unit testing di Node.js
export { parseSoal, parseSiswa, parseGuru, readExcelFile, downloadSheet };

export async function initImportExport() {
  if (typeof document === "undefined") return;

  const [{ db, collection, doc, getDocs, writeBatch }, { showToast }, { setQuestionsList, renderQBuilder }] =
    await Promise.all([
      import("../core/firebase.js"),
      import("../core/toast.js"),
      import("./qbuilder.js")
    ]);

  let parsedSoal = [];
  let parsedSiswa = [];
  let parsedGuru = [];

  // --- 1. SOAL ---
  const fileSoal = document.getElementById("imp-file-soal");
  const ribbonSoal = document.getElementById("imp-ribbon-soal");
  const errSoal = document.getElementById("imp-errors-soal");
  const prevSoal = document.getElementById("imp-preview-soal");
  const btnSaveSoal = document.getElementById("btn-imp-save-soal");

  fileSoal?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await readExcelFile(file);
      const { items, errors, ringkasan } = parseSoal(rows);
      parsedSoal = items;

      if (ribbonSoal) {
        ribbonSoal.classList.remove("hidden");
        ribbonSoal.textContent = `${ringkasan.pg} PG, ${ringkasan.bs} BS, ${ringkasan.match} Match, ${ringkasan.essay} Essay / ${errors.length} baris bermasalah`;
      }
      renderErrorsBox(errSoal, errors);

      if (prevSoal) {
        if (!items.length) {
          prevSoal.innerHTML = `<div style="padding:12px; color:var(--ink-3); font-size:12.5px">Tidak ada butir soal valid untuk ditampilkan.</div>`;
        } else {
          prevSoal.innerHTML = `
            <div class="table-container" style="margin-top:10px; max-height:260px; overflow:auto">
              <table>
                <thead>
                  <tr>
                    <th>No</th><th>Kode</th><th>Tipe</th><th>Teks Soal</th><th>Kunci</th>
                  </tr>
                </thead>
                <tbody>
                  ${items
                    .map(
                      (it, idx) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td><code>${esc(it.kode)}</code></td>
                      <td><span class="badge badge-${esc(it.tipe)}">${esc(it.tipe.toUpperCase())}</span></td>
                      <td>${esc(it.teks)}</td>
                      <td><code>${esc(it.kunci)}</code></td>
                    </tr>`
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`;
        }
      }
      if (btnSaveSoal) btnSaveSoal.disabled = items.length === 0;
    } catch (err) {
      showToast("Gagal memproses Excel Soal: " + err.message, "error");
    }
  });

  btnSaveSoal?.addEventListener("click", () => {
    if (!parsedSoal.length) return;
    const builderItems = parsedSoal.map((q, idx) => {
      let kunciBuilder = q.kunci;
      if (q.tipe === "bs") {
        if (q.kunci === "A") kunciBuilder = "true";
        else if (q.kunci === "B") kunciBuilder = "false";
      }
      return {
        id: `q${idx + 1}`,
        tipe: q.tipe,
        teks: q.teks,
        bobot: q.bobot || 25,
        pilihan: { ...q.pilihan },
        kunci: kunciBuilder,
        kiri: Array.isArray(q.kiri) && q.kiri.length ? [...q.kiri] : ["", ""],
        kanan: Array.isArray(q.kanan) && q.kanan.length ? [...q.kanan] : ["", ""]
      };
    });

    const asCodeEl = document.getElementById("as-code");
    if (asCodeEl && !asCodeEl.value.trim() && parsedSoal[0]?.kode) {
      asCodeEl.value = parsedSoal[0].kode;
    }

    setQuestionsList(builderItems);
    renderQBuilder();
    showToast(`${builderItems.length} butir soal dimasukkan ke Builder Asesmen.`, "ok");
    const asTabBtn = document.querySelector(".nav-btn[data-tab='sec-asesmen']");
    if (asTabBtn) asTabBtn.click();
  });

  // --- 2. SISWA ---
  const fileSiswa = document.getElementById("imp-file-siswa");
  const ribbonSiswa = document.getElementById("imp-ribbon-siswa");
  const errSiswa = document.getElementById("imp-errors-siswa");
  const prevSiswa = document.getElementById("imp-preview-siswa");
  const btnSaveSiswa = document.getElementById("btn-imp-save-siswa");

  fileSiswa?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await readExcelFile(file);
      const { items, errors, ringkasan } = parseSiswa(rows);
      parsedSiswa = items;

      if (ribbonSiswa) {
        ribbonSiswa.classList.remove("hidden");
        ribbonSiswa.textContent = `${ringkasan.total} siswa siap diimpor / ${errors.length} baris bermasalah`;
      }
      renderErrorsBox(errSiswa, errors);

      if (prevSiswa) {
        if (!items.length) {
          prevSiswa.innerHTML = `<div style="padding:12px; color:var(--ink-3); font-size:12.5px">Tidak ada data siswa valid untuk ditampilkan.</div>`;
        } else {
          prevSiswa.innerHTML = `
            <div class="table-container" style="margin-top:10px; max-height:260px; overflow:auto">
              <table>
                <thead>
                  <tr><th>No</th><th>NIS</th><th>Nama</th><th>Kelas</th></tr>
                </thead>
                <tbody>
                  ${items
                    .map(
                      (it, idx) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td><code>${esc(it.nis)}</code></td>
                      <td>${esc(it.nama)}</td>
                      <td><span class="badge badge-pg">${esc(it.kelas)}</span></td>
                    </tr>`
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`;
        }
      }
      if (btnSaveSiswa) btnSaveSiswa.disabled = items.length === 0;
    } catch (err) {
      showToast("Gagal memproses Excel Siswa: " + err.message, "error");
    }
  });

  btnSaveSiswa?.addEventListener("click", async () => {
    if (!parsedSiswa.length) return;
    btnSaveSiswa.disabled = true;
    const BATCH_LIMIT = 400;
    let terkirim = 0;
    let gagal = 0;

    for (let i = 0; i < parsedSiswa.length; i += BATCH_LIMIT) {
      const chunk = parsedSiswa.slice(i, i + BATCH_LIMIT);
      try {
        const batch = writeBatch(db);
        chunk.forEach((it) => {
          batch.set(doc(db, "siswa", it.nis), {
            nama: it.nama,
            kelas: it.kelas,
            claimedBy: null
          });
        });
        await batch.commit();
        terkirim += chunk.length;
      } catch (err) {
        gagal += chunk.length;
      }
      if (ribbonSiswa) {
        ribbonSiswa.textContent = `Progres Simpan Siswa: ${terkirim} terkirim, ${gagal} gagal (dari ${parsedSiswa.length})`;
      }
    }

    if (gagal === 0) {
      showToast(`Berhasil menyimpan ${terkirim} roster siswa.`, "ok");
    } else {
      showToast(`Selesai: ${terkirim} terkirim, ${gagal} gagal.`, "warn");
    }
    btnSaveSiswa.disabled = false;
  });

  // --- 3. GURU ---
  const fileGuru = document.getElementById("imp-file-guru");
  const ribbonGuru = document.getElementById("imp-ribbon-guru");
  const errGuru = document.getElementById("imp-errors-guru");
  const prevGuru = document.getElementById("imp-preview-guru");
  const btnSaveGuru = document.getElementById("btn-imp-save-guru");

  fileGuru?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await readExcelFile(file);
      const { items, errors, ringkasan } = parseGuru(rows);
      parsedGuru = items;

      if (ribbonGuru) {
        ribbonGuru.classList.remove("hidden");
        ribbonGuru.textContent = `${ringkasan.total} undangan guru siap diimpor / ${errors.length} baris bermasalah`;
      }
      renderErrorsBox(errGuru, errors);

      if (prevGuru) {
        if (!items.length) {
          prevGuru.innerHTML = `<div style="padding:12px; color:var(--ink-3); font-size:12.5px">Tidak ada data guru valid untuk ditampilkan.</div>`;
        } else {
          prevGuru.innerHTML = `
            <div class="table-container" style="margin-top:10px; max-height:260px; overflow:auto">
              <table>
                <thead>
                  <tr><th>No</th><th>Email (ID)</th><th>Nama</th><th>NIP</th><th>Mapel</th><th>Aktif</th></tr>
                </thead>
                <tbody>
                  ${items
                    .map(
                      (it, idx) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td><code>${esc(it.email)}</code></td>
                      <td>${esc(it.nama)}</td>
                      <td>${esc(it.nip || "-")}</td>
                      <td>${esc(it.mapel || "-")}</td>
                      <td><span class="badge ${it.aktif ? "badge-ok" : "badge-danger"}">${
                        it.aktif ? "Ya" : "Tidak"
                      }</span></td>
                    </tr>`
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`;
        }
      }
      if (btnSaveGuru) btnSaveGuru.disabled = items.length === 0;
    } catch (err) {
      showToast("Gagal memproses Excel Guru: " + err.message, "error");
    }
  });

  btnSaveGuru?.addEventListener("click", async () => {
    if (!parsedGuru.length) return;
    btnSaveGuru.disabled = true;
    const BATCH_LIMIT = 400;
    let terkirim = 0;
    let gagal = 0;

    for (let i = 0; i < parsedGuru.length; i += BATCH_LIMIT) {
      const chunk = parsedGuru.slice(i, i + BATCH_LIMIT);
      try {
        const batch = writeBatch(db);
        chunk.forEach((it) => {
          batch.set(doc(db, "guruInvites", it.email), {
            nama: it.nama,
            nip: it.nip,
            mapel: it.mapel,
            aktif: it.aktif
          });
        });
        await batch.commit();
        terkirim += chunk.length;
      } catch (err) {
        gagal += chunk.length;
      }
      if (ribbonGuru) {
        ribbonGuru.textContent = `Progres Simpan Guru: ${terkirim} terkirim, ${gagal} gagal (dari ${parsedGuru.length})`;
      }
    }

    if (gagal === 0) {
      showToast(`Berhasil menyimpan ${terkirim} undangan guru.`, "ok");
    } else {
      showToast(`Selesai: ${terkirim} terkirim, ${gagal} gagal.`, "warn");
    }
    btnSaveGuru.disabled = false;
  });

  // --- 4. TEMPLATES & EXPORT ---
  document.getElementById("btn-tpl-soal")?.addEventListener("click", downloadTemplateSoal);
  document.getElementById("btn-tpl-siswa")?.addEventListener("click", downloadTemplateSiswa);

  document.getElementById("btn-export-siswa-xlsx")?.addEventListener("click", () => {
    exportSiswaXLSX({ db, collection, getDocs, showToast });
  });

  document.getElementById("btn-export-guru-xlsx")?.addEventListener("click", () => {
    exportGuruXLSX({ db, collection, getDocs, showToast });
  });

  document.getElementById("btn-export-soal-xlsx")?.addEventListener("click", () => {
    exportSoalXLSX({ db, collection, getDocs, showToast });
  });
}
