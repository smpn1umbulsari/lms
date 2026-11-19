// Repository Hygiene & Syntax Gate for SITURI LMS
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const errors = [];

function walk(dir, filterFn, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".git" || name === ".firebase" || name === "vendor") continue;
      walk(full, filterFn, acc);
    } else if (filterFn(full)) {
      acc.push(full);
    }
  }
  return acc;
}

// 1. JS / MJS syntax check via node --check
const scriptDirs = ["docs/js", "tools", "tests", "spike", "loadtest"];
let checkedScripts = 0;
for (const dir of scriptDirs) {
  const fullDir = join(ROOT, dir);
  for (const file of walk(fullDir, (p) => [".js", ".mjs"].includes(extname(p)))) {
    checkedScripts++;
    try {
      execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
    } catch (err) {
      errors.push(`[SYNTAX] ${relative(ROOT, file)}: ${err.stderr?.toString().trim() || err.message}`);
    }
  }
}

// 2. Banned patterns in docs/js
const jsFiles = walk(join(ROOT, "docs/js"), (p) => p.endsWith(".js"));
for (const file of jsFiles) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((raw, idx) => {
    const line = raw.replace(/\/\/.*$/, "");
    if (/\balert\s*\(/.test(line) || /\bconfirm\s*\(/.test(line)) {
      errors.push(`[DIALOG] ${rel}:${idx + 1} memakai alert/confirm native`);
    }
    if (/window\.(log|switchAdminTab|questionsList)\s*=/.test(line)) {
      errors.push(`[GLOBAL] ${rel}:${idx + 1} membocorkan global window.*`);
    }
    if (/17 Nov 2026/.test(raw)) {
      errors.push(`[FAKE-DATE] ${rel}:${idx + 1} masih berisi tanggal palsu`);
    }
    if (/koreksi.*\.js$/.test(rel) && /value=["']20["']/.test(raw)) {
      errors.push(`[ESSAY-DEFAULT] ${rel}:${idx + 1} berisi hardcode value="20"`);
    }
  });
}

// 3. Inline HTML style count check across docs/*.html and docs/partials/**/*.html
const htmlFiles = [
  ...readdirSync(join(ROOT, "docs"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => join(ROOT, "docs", f)),
  ...walk(join(ROOT, "docs/partials"), (p) => p.endsWith(".html"))
];
let inlineStyleCount = 0;
for (const file of htmlFiles) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const content = readFileSync(file, "utf8");
  const matches = content.match(/\bstyle\s*=\s*["'][^"']*["']/gi) || [];
  inlineStyleCount += matches.length;
  if (/17 Nov 2026/.test(content)) {
    errors.push(`[FAKE-DATE] ${rel} berisi tanggal palsu "17 Nov 2026"`);
  }
}
if (inlineStyleCount > 15) {
  errors.push(`[INLINE-STYLE] Terlalu banyak atribut style="" di HTML (${inlineStyleCount} > 15)`);
}

// 4. Banned transition: all in docs/css
const cssFiles = walk(join(ROOT, "docs/css"), (p) => p.endsWith(".css"));
for (const file of cssFiles) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (/transition\s*:\s*all\b/i.test(line)) {
      errors.push(`[CSS] ${rel}:${idx + 1} memakai "transition: all"`);
    }
  });
}

console.log(`=======================================================`);
console.log(`           SITURI LMS Code Hygiene Audit               `);
console.log(`=======================================================`);
console.log(`Syntax Checked Scripts : ${checkedScripts}`);
console.log(`HTML Files Scanned     : ${htmlFiles.length} (inline styles: ${inlineStyleCount})`);
console.log(`CSS Files Scanned      : ${cssFiles.length}`);
console.log(`Violations             : ${errors.length}`);
console.log(`=======================================================`);

if (errors.length) {
  for (const e of errors) console.error("[FAIL]", e);
  process.exit(1);
}
console.log("\nHygiene Audit PASSED!");
