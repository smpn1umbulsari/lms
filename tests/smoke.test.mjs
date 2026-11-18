// Lightweight Smoke Test: App Shell & PWA Precache Assets Integrity
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import assert from "node:assert/strict";

const DOCS_DIR = join(process.cwd(), "docs");

const MIME_MAP = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

// Start static server
const server = createServer((req, res) => {
  let reqPath = req.url.split("?")[0];
  if (reqPath === "/" || reqPath === "") reqPath = "/index.html";
  const filePath = join(DOCS_DIR, reqPath);

  if (!existsSync(filePath)) {
    res.statusCode = 404;
    res.end("Not Found");
    return;
  }

  const ext = extname(filePath).toLowerCase();
  res.setHeader("Content-Type", MIME_MAP[ext] || "application/octet-stream");
  res.statusCode = 200;
  res.end(readFileSync(filePath));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

let pass = 0;
const test = async (name, fn) => {
  try {
    await fn();
    pass++;
    console.log("PASS  ", name);
  } catch (err) {
    console.error("FAIL  ", name, "->", err.message);
    server.close();
    process.exit(1);
  }
};

try {
  // 1. Verify index.html & manifest
  await test("smoke: index.html loads with PWA & title tags", async () => {
    const res = await fetch(`${baseUrl}/index.html`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert(html.includes("Portal Siswa — LMS SMPN 1 Umbulsari"), "Title portal siswa harus ada");
    assert(html.includes('rel="manifest" href="manifest.json"'), "Link manifest harus ada");
    assert(html.includes('name="theme-color"'), "Meta theme-color harus ada");
  });

  // 2. Verify admin.html
  await test("smoke: admin.html loads with PWA & dashboard shell", async () => {
    const res = await fetch(`${baseUrl}/admin.html`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert(html.includes("Portal Guru — LMS SMPN 1 Umbulsari"), "Title portal guru harus ada");
    assert(html.includes('rel="manifest" href="manifest.json"'), "Link manifest harus ada");
  });

  // 3. Verify manifest.json
  await test("smoke: manifest.json valid schema & start_url", async () => {
    const res = await fetch(`${baseUrl}/manifest.json`);
    assert.equal(res.status, 200);
    const manifest = await res.json();
    assert.equal(manifest.short_name, "SITURI LMS");
    assert.equal(manifest.display, "standalone");
    assert(manifest.icons.length >= 2, "Minimal 2 ikon PWA");
  });

  // 4. Verify sw.js & precache assets completeness
  await test("smoke: sw.js exists and all SHELL_ASSETS resolve 200 OK", async () => {
    const swRes = await fetch(`${baseUrl}/sw.js`);
    assert.equal(swRes.status, 200);
    const swCode = await swRes.text();

    // Extract SHELL_ASSETS array items
    const match = swCode.match(/const SHELL_ASSETS = \[([\s\S]*?)\];/);
    assert(match, "SHELL_ASSETS harus didefinisikan di sw.js");
    const rawList = match[1]
      .split(",")
      .map((s) => s.replace(/[\s"']/g, ""))
      .filter(Boolean);

    for (const asset of rawList) {
      const cleanPath = asset.startsWith("./") ? asset.slice(2) : asset;
      const target = `${baseUrl}/${cleanPath}`;
      const r = await fetch(target);
      assert.equal(
        r.status,
        200,
        `Precache asset ${asset} (${target}) gagal dimuat dengan status ${r.status}`
      );
    }
  });

  console.log(`\n=== ${pass} PASS / 0 FAIL ===`);
} finally {
  server.close();
}
