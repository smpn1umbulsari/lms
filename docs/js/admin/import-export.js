// Import & Export Excel (Soal, Siswa, Guru)
// Fungsi parseSoal, parseSiswa, parseGuru murni (tanpa DOM/Firestore di top-level) agar bisa dites di Node.js.

function normHeader(row) {
  return (Array.isArray(row) ? row : []).map((c) => String(c ?? "").trim().toLowerCase());
}

function findCol(headers, aliases) {
  for (const a of aliases) {
    const idx = headers.indexOf(a);
    if (idx !== -1) return idx;
  }
  return -1;
}

function getCell(row, idx) {
  if (!Array.isArray(row) || idx < 0 || idx >= row.length) return "";
  return String(row[idx] ?? "").trim();
}

function isRowEmpty(row) {
  if (!Array.isArray(row) || row.length === 0) return true;
  return row.every((c) => String(c ?? "").trim() === "");
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Parse sheet Soal: Kode | Tipe | Teks | Opsi A | Opsi B | Opsi C | Opsi D | Kunci | Kiri | Kanan
 */
export function parseSoal(rows) {
  const items = [];
  const errors = [];
  const ringkasan = { pg: 0, bs: 0, match: 0, essay: 0 };

  if (!Array.isArray(rows) || rows.length === 0) {
    return { items, errors, ringkasan };
  }

  const hdr = normHeader(rows[0]);
  const cKode = findCol(hdr, ["kode"]);
  const cTipe = findCol(hdr, ["tipe"]);
  const cTeks = findCol(hdr, ["teks", "pertanyaan", "soal"]);
  const cOpsiA = findCol(hdr, ["opsi a", "opsia", "pilihan a", "a"]);
  const cOpsiB = findCol(hdr, ["opsi b", "opsib", "pilihan b", "b"]);
  const cOpsiC = findCol(hdr, ["opsi c", "opsic", "pilihan c", "c"]);
  const cOpsiD = findCol(hdr, ["opsi d", "opsid", "pilihan d", "d"]);
  const cKunci = findCol(hdr, ["kunci", "jawaban"]);
  const cKiri = findCol(hdr, ["kiri", "kolom a"]);
  const cKanan = findCol(hdr, ["kanan", "kolom b"]);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isRowEmpty(row)) continue;
    const baris = i + 1;

    const kode = cKode !== -1 ? getCell(row, cKode) : `q${items.length + 1}`;
    const rawTipe = getCell(row, cTipe);
    const tipe = (rawTipe || "pg").toLowerCase();
    const teks = getCell(row, cTeks);
    const opsiA = getCell(row, cOpsiA);
    const opsiB = getCell(row, cOpsiB);
    const opsiC = getCell(row, cOpsiC);
    const opsiD = getCell(row, cOpsiD);
    const rawKunci = getCell(row, cKunci);
    const rawKiri = getCell(row, cKiri);
    const rawKanan = getCell(row, cKanan);

    if (cKode !== -1 && !kode) {
      errors.push({ baris, pesan: "Kode tidak boleh kosong" });
      continue;
    }
    if (!teks) {
      errors.push({ baris, pesan: "Teks soal tidak boleh kosong" });
      continue;
    }
    if (!["pg", "bs", "match", "essay"].includes(tipe)) {
      errors.push({ baris, pesan: `Tipe soal tidak dikenal: "${rawTipe}"` });
      continue;
    }

    let kunci = "";
    let kiri = ["", ""];
    let kanan = ["", ""];

    if (tipe === "pg") {
      const k = rawKunci.toUpperCase();
      if (!["A", "B", "C", "D"].includes(k)) {
        errors.push({ baris, pesan: `Kunci PG tidak sah: "${rawKunci}" (harus A..D)` });
        continue;
      }
      kunci = k;
    } else if (tipe === "bs") {
      const k = rawKunci.toUpperCase();
      if (!["A", "B", "C", "D", "TRUE", "FALSE", "BENAR", "SALAH"].includes(k)) {
        errors.push({ baris, pesan: `Kunci BS tidak sah: "${rawKunci}"` });
        continue;
      }
      if (k === "TRUE" || k === "BENAR") kunci = "true";
      else if (k === "FALSE" || k === "SALAH") kunci = "false";
      else kunci = k;
    } else if (tipe === "match") {
      let validMatch = false;
      const parsedKiri = [];
      const parsedKanan = [];

      if (rawKunci) {
        const pairs = rawKunci.split(";").map((s) => s.trim()).filter(Boolean);
        if (pairs.length > 0) {
          validMatch = true;
          for (const p of pairs) {
            const gtIdx = p.indexOf(">");
            if (gtIdx === -1) {
              validMatch = false;
              break;
            }
            const l = p.slice(0, gtIdx).trim();
            const r = p.slice(gtIdx + 1).trim();
            if (!l || !r) {
              validMatch = false;
              break;
            }
            parsedKiri.push(l);
            parsedKanan.push(r);
          }
        }
      } else if (rawKiri && rawKanan) {
        const sepL = rawKiri.includes(";") ? ";" : ",";
        const sepR = rawKanan.includes(";") ? ";" : ",";
        const lArr = rawKiri.split(sepL).map((s) => s.trim()).filter(Boolean);
        const rArr = rawKanan.split(sepR).map((s) => s.trim()).filter(Boolean);
        if (lArr.length > 0 && lArr.length === rArr.length) {
          parsedKiri.push(...lArr);
          parsedKanan.push(...rArr);
          validMatch = true;
        }
      }

      if (!validMatch) {
        errors.push({
          baris,
          pesan: "Kunci Match tidak sah (gunakan format kiri1>kanan1;kiri2>kanan2)"
        });
        continue;
      }
      kiri = parsedKiri;
      kanan = parsedKanan;
      kunci = parsedKiri.map((l, idx) => `${l}>${parsedKanan[idx]}`).join(";");
    } else if (tipe === "essay") {
      kunci = rawKunci;
    }

    items.push({
      id: `q${items.length + 1}`,
      kode,
      tipe,
      teks,
      bobot: 25,
      pilihan: { A: opsiA, B: opsiB, C: opsiC, D: opsiD },
      kunci,
      kiri,
      kanan
    });
    ringkasan[tipe]++;
  }

  return { items, errors, ringkasan };
}

/**
 * Parse sheet Siswa: NIS | Nama | Kelas
 */
export function parseSiswa(rows) {
  const items = [];
  const errors = [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return { items, errors, ringkasan: { total: 0 } };
  }

  const hdr = normHeader(rows[0]);
  const cNis = findCol(hdr, ["nis", "nisn"]);
  const cNama = findCol(hdr, ["nama", "nama siswa"]);
  const cKelas = findCol(hdr, ["kelas", "rombel"]);

  const seenNis = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isRowEmpty(row)) continue;
    const baris = i + 1;

    const nis = getCell(row, cNis);
    const nama = getCell(row, cNama);
    const kelas = getCell(row, cKelas);

    if (!nis) {
      errors.push({ baris, pesan: "NIS tidak boleh kosong" });
      continue;
    }
    if (!nama) {
      errors.push({ baris, pesan: "Nama siswa tidak boleh kosong" });
      continue;
    }
    if (!kelas) {
      errors.push({ baris, pesan: "Kelas tidak boleh kosong" });
      continue;
    }
    if (seenNis.has(nis)) {
      errors.push({ baris, pesan: `NIS duplikat: "${nis}"` });
      continue;
    }

    seenNis.add(nis);
    items.push({ nis, nama, kelas, claimedBy: null });
  }

  return { items, errors, ringkasan: { total: items.length } };
}

/**
 * Parse sheet Guru: Email | Nama | NIP | Mapel | Aktif
 */
export function parseGuru(rows) {
  const items = [];
  const errors = [];

  if (!Array.isArray(rows) || rows.length === 0) {
    return { items, errors, ringkasan: { total: 0 } };
  }

  const hdr = normHeader(rows[0]);
  const cEmail = findCol(hdr, ["email"]);
  const cNama = findCol(hdr, ["nama", "nama guru"]);
  const cNip = findCol(hdr, ["nip"]);
  const cMapel = findCol(hdr, ["mapel", "mata pelajaran"]);
  const cAktif = findCol(hdr, ["aktif", "status"]);

  const seenEmail = new Set();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isRowEmpty(row)) continue;
    const baris = i + 1;

    const rawEmail = getCell(row, cEmail);
    const email = rawEmail.toLowerCase();
    const nama = getCell(row, cNama);
    const nip = cNip !== -1 ? getCell(row, cNip) : "";
    const mapel = cMapel !== -1 ? getCell(row, cMapel) : "";
    const rawAktif = cAktif !== -1 ? getCell(row, cAktif).toLowerCase() : "";

    if (!email || !email.includes("@")) {
      errors.push({ baris, pesan: `Email tidak sah: "${rawEmail}"` });
      continue;
    }
    if (!nama) {
      errors.push({ baris, pesan: "Nama guru tidak boleh kosong" });
      continue;
    }
    if (seenEmail.has(email)) {
      errors.push({ baris, pesan: `Email duplikat: "${email}"` });
      continue;
    }

    let aktif = true;
    if (rawAktif === "" || rawAktif === "ya" || rawAktif === "true" || rawAktif === "1") {
      aktif = true;
    } else if (rawAktif === "tidak" || rawAktif === "false" || rawAktif === "0") {
      aktif = false;
    } else {
      errors.push({ baris, pesan: `Nilai Aktif tidak sah: "${rawAktif}" (isi Ya/Tidak)` });
      continue;
    }

    seenEmail.add(email);
    items.push({ email, nama, nip, mapel, aktif });
  }

  return { items, errors, ringkasan: { total: items.length } };
}

function downloadSheet(filename, aoa) {
  if (!window.XLSX) return;
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(aoa), "Data");
  window.XLSX.writeFile(wb, filename);
}

function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    if (!window.XLSX) {
      reject(new Error("Library SheetJS (XLSX) belum dimuat."));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = window.XLSX.read(data, { type: "array", raw: false });
        const firstSheet = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheet];
        const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Gagal membaca berkas Excel."));
    reader.readAsArrayBuffer(file);
  });
}

function renderErrorsBox(el, errors) {
  if (!el) return;
  if (!errors || !errors.length) {
    el.innerHTML = "";
    el.classList.add("hidden");
    return;
  }
  el.classList.remove("hidden");
  el.innerHTML = `
    <div style="font-weight:600; margin-bottom:4px">Daftar Baris Bermasalah (${errors.length}):</div>
    <ul style="margin:0; padding-left:18px; font-size:12px">
      ${errors.map((e) => `<li>Baris ${e.baris}: ${esc(e.pesan)}</li>`).join("")}
    </ul>
  `;
}

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
                    <th>No</th>
                    <th>Kode</th>
                    <th>Tipe</th>
                    <th>Teks Soal</th>
                    <th>Kunci</th>
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
            </div>
          `;
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
    if (typeof window.switchAdminTab === "function") {
      window.switchAdminTab("sec-asesmen");
    }
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
                  <tr>
                    <th>No</th>
                    <th>NIS</th>
                    <th>Nama</th>
                    <th>Kelas</th>
                  </tr>
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
            </div>
          `;
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
                  <tr>
                    <th>No</th>
                    <th>Email (ID)</th>
                    <th>Nama</th>
                    <th>NIP</th>
                    <th>Mapel</th>
                    <th>Aktif</th>
                  </tr>
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
            </div>
          `;
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

  // --- 4. TEMPLATE & EXPORT (.xlsx) ---
  const HEADER_SOAL = ["Kode", "Tipe", "Teks", "Opsi A", "Opsi B", "Opsi C", "Opsi D", "Kunci", "Kiri", "Kanan"];
  const HEADER_SISWA = ["NIS", "Nama", "Kelas"];
  const HEADER_GURU = ["Email", "Nama", "NIP", "Mapel", "Aktif"];

  document.getElementById("btn-tpl-soal")?.addEventListener("click", () => {
    downloadSheet("Template_Soal.xlsx", [HEADER_SOAL]);
  });

  document.getElementById("btn-tpl-siswa")?.addEventListener("click", () => {
    downloadSheet("Template_Siswa.xlsx", [HEADER_SISWA]);
  });

  document.getElementById("btn-export-siswa-xlsx")?.addEventListener("click", async () => {
    try {
      const snap = await getDocs(collection(db, "siswa"));
      const aoa = [HEADER_SISWA];
      snap.docs.forEach((d) => {
        const s = d.data();
        aoa.push([String(d.id), String(s.nama || ""), String(s.kelas || "")]);
      });
      downloadSheet("Data_Siswa.xlsx", aoa);
      showToast("Export Siswa (.xlsx) berhasil diunduh.", "ok");
    } catch (err) {
      showToast("Gagal export Siswa: " + err.message, "error");
    }
  });

  document.getElementById("btn-export-guru-xlsx")?.addEventListener("click", async () => {
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
      downloadSheet("Data_Guru.xlsx", aoa);
      showToast("Export Guru (.xlsx) berhasil diunduh.", "ok");
    } catch (err) {
      showToast("Gagal export Guru: " + err.message, "error");
    }
  });

  document.getElementById("btn-export-soal-xlsx")?.addEventListener("click", async () => {
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

      downloadSheet("Bank_Soal.xlsx", aoa);
      showToast("Export Bank Soal (.xlsx) berhasil diunduh.", "ok");
    } catch (err) {
      showToast("Gagal export Bank Soal: " + err.message, "error");
    }
  });
}
