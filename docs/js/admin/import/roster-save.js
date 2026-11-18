// Pratinjau & penyimpanan roster (Siswa/Guru) yang aman: diff dulu, tulis hanya yang berubah
import { diffSiswa, diffGuru, unknownClasses, isSuperAdminDoc } from "./roster-diff.js";

const BATCH_LIMIT = 400;

const KINDS = {
  siswa: {
    col: "siswa",
    idOf: (it) => it.nis,
    diff: diffSiswa,
    // `claimedBy` hanya diisi untuk dokumen BARU; dokumen lama tidak pernah direset
    create: (it) => ({ nama: it.nama, kelas: it.kelas, claimedBy: null }),
    update: (it) => ({ nama: it.nama, kelas: it.kelas })
  },
  guru: {
    col: "guruInvites",
    idOf: (it) => it.email,
    diff: diffGuru,
    create: (it) => ({ nama: it.nama, nip: it.nip, mapel: it.mapel, aktif: it.aktif }),
    update: (it) => ({ nama: it.nama, nip: it.nip, mapel: it.mapel, aktif: it.aktif })
  }
};

export async function canManageUsers(fb) {
  const u = fb.auth.currentUser;
  if (!u) return false;
  try {
    const s = await fb.getDoc(fb.doc(fb.db, "admins", u.uid));
    return s.exists() && isSuperAdminDoc(s.data());
  } catch (e) {
    return false;
  }
}

/** Dipakai sebagai cfg.onParsed pada panel siswa/guru */
export async function previewRoster(fb, kind, res) {
  if (!(await canManageUsers(fb))) {
    return { blocked: true, note: "Hanya Admin Utama yang dapat menyimpan data ini (akun Guru: lihat-saja)" };
  }
  const k = KINDS[kind];
  const snap = await fb.getDocs(fb.collection(fb.db, k.col));
  const existing = new Map(snap.docs.map((d) => [d.id, d.data()]));
  const diff = k.diff(res.items, existing);
  const parts = [`${diff.baru.length} baru`, `${diff.ubah.length} diperbarui`, `${diff.sama.length} tanpa perubahan`];
  if (diff.tidakDiFile) parts.push(`${diff.tidakDiFile} ada di database tapi tidak di file (tidak dihapus)`);

  let warn = "";
  if (kind === "siswa") {
    const cs = await fb.getDocs(fb.collection(fb.db, "classes")).catch(() => null);
    if (cs) {
      const unk = unknownClasses(res.items, new Set(cs.docs.map((d) => d.id)));
      const list = Object.entries(unk).map(([c, n]) => `${c} (${n})`);
      if (list.length) warn = ` ⚠ Kelas belum terdaftar: ${list.join(", ")}`;
    }
  }
  return { diff, note: parts.join(", ") + warn };
}

export function statusBadge(it, ctx, idKey) {
  const d = ctx.diff;
  if (!d) return "";
  const id = it[idKey];
  if (d.baru.some((x) => x[idKey] === id)) return `<span class="badge badge-ok">Baru</span>`;
  if (d.ubah.some((x) => x[idKey] === id)) return `<span class="badge badge-warn">Diperbarui</span>`;
  return `<span class="badge badge-neutral">Sama</span>`;
}

export async function saveRoster(fb, kind, diff, onProgress) {
  const k = KINDS[kind];
  const ops = [
    ...diff.baru.map((it) => ({ it, data: k.create(it), merge: false })),
    ...diff.ubah.map((it) => ({ it, data: k.update(it), merge: true }))
  ];
  let terkirim = 0;
  let gagal = 0;
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const chunk = ops.slice(i, i + BATCH_LIMIT);
    try {
      const batch = fb.writeBatch(fb.db);
      chunk.forEach(({ it, data, merge }) => {
        batch.set(fb.doc(fb.db, k.col, k.idOf(it)), data, merge ? { merge: true } : {});
      });
      await batch.commit();
      terkirim += chunk.length;
    } catch (e) {
      gagal += chunk.length;
    }
    onProgress?.({ terkirim, gagal, total: ops.length });
  }

  // Siswa yang sudah login menyimpan salinan nama/kelas di users/{uid}: sinkronkan
  let sinkron = 0;
  if (kind === "siswa") {
    for (const it of diff.ubah.filter((u) => u.claimedBy)) {
      try {
        await fb.updateDoc(fb.doc(fb.db, "users", it.claimedBy), { nama: it.nama, kelas: it.kelas });
        sinkron++;
      } catch (e) {
        /* akun belum punya profil: abaikan */
      }
    }
  }
  return { terkirim, gagal, sinkron, dilewati: diff.sama.length };
}
