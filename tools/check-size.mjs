import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const docsDir = path.join(rootDir, "docs");
const exceptionsFile = path.join(rootDir, "engineering", "size-exceptions.txt");

const LIMITS = {
  ".js": 400,
  ".css": 300,
  ".html": 300
};

const WARNINGS = {
  ".js": 300,
  ".css": 250,
  ".html": 250
};

// Load exceptions
const exceptions = new Set();
if (fs.existsSync(exceptionsFile)) {
  const content = fs.readFileSync(exceptionsFile, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const clean = trimmed.split("#")[0].trim().replace(/\\/g, "/");
    if (clean) exceptions.add(clean.toLowerCase());
  }
}

function isExcepted(relPath) {
  const normalized = relPath.replace(/\\/g, "/").toLowerCase();
  for (const exc of exceptions) {
    if (normalized.includes(exc)) return true;
  }
  return false;
}

function countLines(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  return content.split(/\r?\n/).length;
}

function scanDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath, fileList);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (LIMITS[ext]) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

const files = scanDir(docsDir);
const violations = [];
const warnings = [];
let passedCount = 0;
let exceptedCount = 0;

console.log("\n=======================================================");
console.log("             SITURI LMS File Size Audit               ");
console.log("=======================================================\n");

for (const file of files) {
  const relPath = path.relative(rootDir, file).replace(/\\/g, "/");
  const ext = path.extname(file).toLowerCase();
  const limit = LIMITS[ext];
  const warnLimit = WARNINGS[ext];
  const lines = countLines(file);
  const excepted = isExcepted(relPath);

  if (lines > limit) {
    if (excepted) {
      exceptedCount++;
      console.log(`[EXCEPTED]  ${relPath.padEnd(38)} : ${lines} lines (Limit: ${limit})`);
    } else {
      violations.push({ relPath, lines, limit, excess: lines - limit });
      console.log(`\x1b[31m[VIOLATION] ${relPath.padEnd(38)} : ${lines} lines (Limit: ${limit}, +${lines - limit})\x1b[0m`);
    }
  } else {
    passedCount++;
    if (lines > warnLimit) {
      warnings.push({ relPath, lines, warnLimit });
      console.log(`\x1b[33m[WARN]      ${relPath.padEnd(38)} : ${lines} lines (Approaching ${limit})\x1b[0m`);
    }
  }
}

console.log("\n-------------------------------------------------------");
console.log(`Total Files Checked : ${files.length}`);
console.log(`Passing             : ${passedCount}`);
console.log(`Exceptions          : ${exceptedCount}`);
console.log(`Violations          : ${violations.length}`);
console.log("-------------------------------------------------------\n");

if (violations.length > 0) {
  console.error(`\x1b[31mAudit FAILED: ${violations.length} file(s) exceed maximum line limits!\x1b[0m`);
  process.exit(1);
} else {
  console.log(`\x1b[32mAudit PASSED: All files comply with standard limits!\x1b[0m`);
  process.exit(0);
}
