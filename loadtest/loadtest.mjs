/**
 * Prasyarat / Dependensi:
 *   npm install playwright
 *   npx playwright install chromium
 *
 * Penggunaan:
 *   node loadtest/loadtest.mjs --url "http://localhost:8080/index.html" --n 900 --code q1
 *   node loadtest/loadtest.mjs --url "http://localhost:8080/docs/index.html" --n 100 --code q1 --concurrency 25
 */

import { parseArgs } from "node:util";
import { chromium } from "playwright";

const { values } = parseArgs({
  options: {
    url: { type: "string" },
    n: { type: "string", default: "900" },
    code: { type: "string", default: "q1" },
    concurrency: { type: "string", default: "50" },
  },
  allowPositionals: true,
});

if (!values.url) {
  console.error("Error: Argumen --url diperlukan. Contoh: --url http://localhost:8080/index.html");
  process.exit(1);
}

const baseUrl = values.url;
const total = Math.max(1, parseInt(values.n, 10) || 900);
const code = values.code || "q1";
const concurrency = Math.max(1, parseInt(values.concurrency, 10) || 50);

const targetUrl = new URL(baseUrl);
targetUrl.searchParams.set("q", code);
const finalUrl = targetUrl.toString();

const durations = [];
let sukses = 0;
let gagal = 0;
let currentIndex = 0;

async function runStudent(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const startTime = Date.now();

  try {
    await page.goto(finalUrl, { waitUntil: "domcontentloaded", timeout: 45000 });

    // Tunggu timer muncul dan mulai berjalan
    await page.locator("#timer").waitFor({ state: "visible", timeout: 30000 });

    // Tunggu soal dirender dan pilih opsi A pertama di tiap .q
    await page.locator(".q").first().waitFor({ state: "visible", timeout: 30000 });
    const questions = page.locator(".q");
    const count = await questions.count();

    for (let i = 0; i < count; i++) {
      const q = questions.nth(i);
      const radioA = q.locator('input[type="radio"][value="A"]').first();
      await radioA.click({ timeout: 5000 });
    }

    // Klik tombol submit
    await page.locator("#submit").click({ timeout: 10000 });

    // Tunggu #score terisi
    await page.waitForFunction(
      () => {
        const el = document.getElementById("score");
        return el && el.textContent.trim().length > 0;
      },
      null,
      { timeout: 30000 }
    );

    const elapsed = Date.now() - startTime;
    durations.push(elapsed);
    sukses++;
  } catch (err) {
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
      await runStudent(browser);
    }
  }

  const workerCount = Math.min(concurrency, total);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  await browser.close().catch(() => {});

  durations.sort((a, b) => a - b);
  const avgMs = durations.length
    ? Math.round(durations.reduce((acc, cur) => acc + cur, 0) / durations.length)
    : 0;
  const p95Index = Math.min(
    Math.floor(durations.length * 0.95),
    Math.max(0, durations.length - 1)
  );
  const p95Ms = durations.length ? durations[p95Index] : 0;

  const summary = {
    total,
    sukses,
    gagal,
    avgMs,
    p95Ms,
    estimasiKuota: {
      reads: 5 * sukses,
      writes: 3 * sukses,
    },
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
