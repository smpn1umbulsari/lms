/**
 * Prasyarat / Dependensi:
 *   npm install playwright
 *   npx playwright install chromium
 *
 * Contoh penggunaan:
 *   node loadtest/loadtest.mjs --url "http://127.0.0.1:4173/index.html" --code q1 --n 100 --concurrency 25 --nis-prefix 1000 --pass "SandiAwal!"
 *   node loadtest/loadtest.mjs --url "https://lms-situri.web.app/index.html" --code u_ipa_01 --n 300 --concurrency 50 --email "siswa1@smpn1umbulsari.sch.id" --pass "..."
 */

import { parseArgs } from "node:util";
import { chromium } from "playwright";

const { values } = parseArgs({
  options: {
    url: { type: "string" },
    n: { type: "string", default: "100" },
    code: { type: "string", default: "q1" },
    concurrency: { type: "string", default: "25" },
    email: { type: "string", default: "" },
    "nis-prefix": { type: "string", default: "" },
    pass: { type: "string", default: "" }
  },
  allowPositionals: true
});

if (!values.url) {
  console.error("Error: Argumen --url diperlukan. Contoh: --url http://127.0.0.1:4173/index.html");
  process.exit(1);
}

const baseUrl = values.url;
const total = Math.max(1, parseInt(values.n, 10) || 100);
const code = values.code || "q1";
const concurrency = Math.max(1, parseInt(values.concurrency, 10) || 25);
const pass = values.pass;

const durations = [];
let sukses = 0;
let gagal = 0;
let currentIndex = 0;

function credentialFor(idx) {
  if (values["nis-prefix"]) {
    const baseNum = parseInt(values["nis-prefix"], 10);
    return Number.isFinite(baseNum) ? String(baseNum + idx) : `${values["nis-prefix"]}${idx}`;
  }
  return values.email;
}

async function runStudent(browser, idx) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const startTime = Date.now();
  const ident = credentialFor(idx);

  try {
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 45000 });

    if (ident && pass) {
      await page.locator("#l-email").waitFor({ state: "visible", timeout: 20000 });
      await page.fill("#l-email", ident);
      await page.fill("#l-pass", pass);
      await page.click("#btn-login");

      // Tangani klaim NIS opsional bila akun belum tertaut
      const dashboardOrNis = await Promise.race([
        page.locator("#sec-dashboard").waitFor({ state: "visible", timeout: 25000 }).then(() => "dash"),
        page.locator("#sec-nis").waitFor({ state: "visible", timeout: 25000 }).then(() => "nis")
      ]);
      if (dashboardOrNis === "nis") {
        await page.fill("#input-nis", ident.split("@")[0]);
        await page.click("#btn-submit-nis");
        await page.locator("#sec-dashboard").waitFor({ state: "visible", timeout: 25000 });
      }
    }

    // Masuk tab Ujian dan pilih paket sesuai --code
    await page.locator('.tab-btn[data-tab="tab-asesmen"]').first().click({ timeout: 15000 });
    const quizBtn = page
      .locator(`#asesmen-list [data-quiz-id="${code}"], #asesmen-list button[data-action="start-quiz"]`)
      .first();
    await quizBtn.waitFor({ state: "visible", timeout: 20000 });
    await quizBtn.click();

    await page.locator("#ex-timer").waitFor({ state: "visible", timeout: 25000 });
    await page.locator("#ex-questions .q-card, #ex-questions .card, #ex-questions input").first().waitFor({ state: "visible", timeout: 25000 });

    const radios = page.locator('#ex-questions input[type="radio"]');
    const rCount = await radios.count();
    for (let i = 0; i < rCount; i += 4) {
      await radios.nth(i).check().catch(() => {});
    }

    await page.click("#btn-ex-finish", { timeout: 15000 });
    const confirmBtn = page.locator(".confirm-modal-ok, #confirm-ok-btn");
    if (await confirmBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await confirmBtn.click();
    }

    await page.locator("#sec-result").waitFor({ state: "visible", timeout: 30000 });
    await page.waitForFunction(
      () => {
        const el = document.getElementById("res-score");
        return el && el.textContent.trim().length > 0;
      },
      null,
      { timeout: 30000 }
    );

    durations.push(Date.now() - startTime);
    sukses++;
  } catch {
    gagal++;
  } finally {
    await context.close().catch(() => {});
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  async function worker() {
    while (true) {
      const idx = currentIndex++;
      if (idx >= total) break;
      await runStudent(browser, idx);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);
  await browser.close().catch(() => {});

  durations.sort((a, b) => a - b);
  const avgMs = durations.length
    ? Math.round(durations.reduce((acc, cur) => acc + cur, 0) / durations.length)
    : 0;
  const p95Index = Math.min(Math.floor(durations.length * 0.95), Math.max(0, durations.length - 1));
  const p95Ms = durations.length ? durations[p95Index] : 0;

  // Estimasi Spark dengan throttle autosave 18 detik + ACK server
  const summary = {
    total,
    sukses,
    gagal,
    avgMs,
    p95Ms,
    estimasiKuota: {
      reads: 5 * sukses,
      writes: 5 * sukses
    }
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
