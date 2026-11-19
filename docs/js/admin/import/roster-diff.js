// Perbandingan roster impor vs data existing (pure, tanpa Firebase/DOM)
// Tujuan: tidak menimpa data yang sama & tidak pernah mereset `claimedBy` siswa.

export function isSuperAdminDoc(d) {
  return !!d && d.role === "admin";
}

/** existing: Map<nis, data> */
export function diffSiswa(items, existing) {
  const baru = [];
  const ubah = [];
  const sama = [];
  for (const it of items) {
    const cur = existing.get(it.nis);
    if (!cur) baru.push(it);
    else if (cur.nama !== it.nama || cur.kelas !== it.kelas) {
      ubah.push({ ...it, dari: { nama: cur.nama, kelas: cur.kelas }, claimedBy: cur.claimedBy || null });
    } else sama.push(it);
  }
  const ids = new Set(items.map((i) => i.nis));
  const tidakDiFile = [...existing.keys()].filter((k) => !ids.has(k)).length;
  return { baru, ubah, sama, tidakDiFile };
}

/** existing: Map<email, data> */
export function diffGuru(items, existing) {
  const baru = [];
  const ubah = [];
  const sama = [];
  for (const it of items) {
    const cur = existing.get(it.email);
    if (!cur) baru.push(it);
    else if (
      (cur.nama || "") !== it.nama ||
      (cur.nip || "") !== it.nip ||
      (cur.mapel || "") !== it.mapel ||
      (cur.aktif !== false) !== it.aktif
    ) {
      ubah.push({ ...it, dari: { nama: cur.nama, aktif: cur.aktif !== false } });
    } else sama.push(it);
  }
  const ids = new Set(items.map((i) => i.email));
  const tidakDiFile = [...existing.keys()].filter((k) => !ids.has(k)).length;
  return { baru, ubah, sama, tidakDiFile };
}

/** Kelas pada file yang belum terdaftar di koleksi `classes` -> { kode: jumlahSiswa } */
export function unknownClasses(items, knownSet) {
  const out = {};
  for (const it of items) {
    if (!knownSet.has(it.kelas)) out[it.kelas] = (out[it.kelas] || 0) + 1;
  }
  return out;
}
