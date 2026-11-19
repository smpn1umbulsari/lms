// Sinkronisasi CBT (Throttle 18s + Flush Lifecycle + Verified Server ACK + Auto Retry)
import { db, doc, setDoc, getDocFromServer, serverTimestamp, Timestamp } from "../core/firebase.js";
import { putLocalAttempt, deleteLocalAttempt, listPendingAttempts } from "../core/attempt-queue.js";
import { escAttr } from "../core/dom.js";
import { showToast } from "../core/toast.js";

export const SYNC_INTERVAL_MS = 18000;

export function toLocalRecord(state, pendingSubmit = false) {
  return {
    startId: state.startId,
    uid: state.uid || state.currentUser?.uid,
    quizId: state.quizId,
    attemptNo: state.attemptNo || 1,
    answers: state.answers || {},
    submitSeq: state.submitSeq || 0,
    expireAtSec: state.expireAtSec ?? state.expireAt?.seconds ?? 0,
    expireAtNs: state.expireAtNs ?? state.expireAt?.nanoseconds ?? 0,
    pendingSubmit,
    updatedAtMs: Date.now()
  };
}

export async function syncAttemptToServer(recOrState, { markSubmitted = false } = {}) {
  const uid = recOrState.uid || recOrState.currentUser?.uid;
  if (!uid || !recOrState.startId) {
    return { ok: false, confirmed: false, error: "Identitas sesi ujian tidak lengkap." };
  }
  recOrState.submitSeq = (recOrState.submitSeq || 0) + 1;
  await putLocalAttempt(toLocalRecord(recOrState, markSubmitted));

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { ok: false, confirmed: false, error: "Perangkat sedang offline." };
  }

  const expSec = recOrState.expireAtSec ?? recOrState.expireAt?.seconds ?? 0;
  const expNs = recOrState.expireAtNs ?? recOrState.expireAt?.nanoseconds ?? 0;
  const payload = {
    uid,
    quizId: recOrState.quizId,
    attemptNo: recOrState.attemptNo || 1,
    answers: recOrState.answers || {},
    submitSeq: recOrState.submitSeq,
    updatedAt: serverTimestamp(),
    expireAt: new Timestamp(expSec, expNs)
  };
  if (markSubmitted) payload.submittedAt = serverTimestamp();

  try {
    const ref = doc(db, "attempts", recOrState.startId);
    await setDoc(ref, payload, { merge: true });
    if (markSubmitted) {
      const srv = await getDocFromServer(ref);
      const confirmed = srv.exists() && srv.data()?.submittedAt != null;
      return confirmed
        ? { ok: true, confirmed: true }
        : { ok: false, confirmed: false, error: "Server belum mengonfirmasi penerimaan jawaban." };
    }
    return { ok: true, confirmed: true };
  } catch (err) {
    if (markSubmitted) {
      const srv = await getDocFromServer(doc(db, "attempts", recOrState.startId)).catch(() => null);
      if (srv?.exists() && srv.data()?.submittedAt != null) {
        return { ok: true, confirmed: true };
      }
    }
    return { ok: false, confirmed: false, error: err?.message || String(err) };
  }
}

export function createThrottledSyncer(getState, onStatus) {
  let dirty = false;
  let lastWriteMs = 0;
  let timer = null;
  let inflight = false;

  const runSync = async () => {
    clearTimeout(timer);
    timer = null;
    const st = getState();
    if (!st || st.locked || !dirty || inflight) return;
    dirty = false;
    inflight = true;
    onStatus?.("Menyimpan ke server...", "syncing");
    const res = await syncAttemptToServer(st, { markSubmitted: false });
    inflight = false;
    lastWriteMs = Date.now();
    if (res.ok) onStatus?.("Semua jawaban tersimpan ✓", "ok");
    else {
      dirty = true;
      onStatus?.(navigator.onLine ? "Sinkron tertunda (tersimpan di HP)" : "Mode Offline: Jawaban aman di HP", "warn");
    }
  };

  const markDirty = () => {
    const st = getState();
    if (!st || st.locked) return;
    dirty = true;
    putLocalAttempt(toLocalRecord(st, false));
    onStatus?.(navigator.onLine ? "Perubahan tersimpan di HP..." : "Mode Offline: Jawaban aman di HP", "warn");
    if (timer) return;
    const elapsed = Date.now() - lastWriteMs;
    const wait = Math.max(0, SYNC_INTERVAL_MS - elapsed);
    timer = setTimeout(runSync, wait);
  };

  const flush = () => { if (dirty) runSync(); };
  const onVis = () => { if (document.visibilityState === "hidden") flush(); };
  window.addEventListener("visibilitychange", onVis);
  window.addEventListener("pagehide", flush);
  window.addEventListener("blur", flush);
  window.addEventListener("online", flush);

  return {
    markDirty,
    flush,
    destroy() {
      clearTimeout(timer);
      window.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("blur", flush);
      window.removeEventListener("online", flush);
    }
  };
}

export async function flushPendingAttempts(user, onUpdated) {
  if (!user || (typeof navigator !== "undefined" && !navigator.onLine)) return 0;
  const pending = await listPendingAttempts(user.uid);
  let synced = 0;
  for (const rec of pending) {
    const res = await syncAttemptToServer(rec, { markSubmitted: true });
    if (res.ok && res.confirmed) {
      await deleteLocalAttempt(rec.startId);
      synced++;
    }
  }
  if (synced > 0) {
    showToast(`✓ ${synced} lembar ujian tertunda berhasil dikirim & dikonfirmasi server.`, "ok");
    onUpdated?.();
  }
  await renderPendingExamBanner(user, onUpdated);
  return synced;
}

export async function renderPendingExamBanner(user, onUpdated) {
  const box = document.getElementById("pending-exam-banner");
  if (!box || !user) return;
  const pending = await listPendingAttempts(user.uid);
  if (!pending.length) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }
  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="callout callout-warn" style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:14px">
      <div>
        <strong>${pending.length} Lembar Ujian Belum Terkirim ke Server</strong>
        <div style="font-size:12.5px; color:var(--ink-2)">Jawaban tersimpan aman di perangkat (${pending.map((p) => escAttr(p.quizId)).join(", ")}). Pastikan sinyal aktif lalu kirim ulang.</div>
      </div>
      <button type="button" id="btn-retry-pending-exams" class="btn btn-primary btn-sm">Kirim Ulang Sekarang</button>
    </div>
  `;
  document.getElementById("btn-retry-pending-exams")?.addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    await flushPendingAttempts(user, onUpdated);
  });
}
