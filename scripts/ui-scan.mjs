import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const scanRoot = path.join(rootDir, "src");
const ignoredDirs = new Set(["node_modules", "dist", "release", ".git"]);
const checkedExtensions = new Set([".css", ".js", ".jsx", ".ts", ".tsx"]);

const checks = [
  {
    label: "Large type in app surfaces",
    pattern: /\btext-(?:2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/g,
    note: "Large type is usually reserved for fallback/error screens, not dense workspace cards.",
  },
  {
    label: "Heavy rounding",
    pattern: /\brounded-(?:2xl|3xl)\b/g,
    note: "Check whether the element really needs oversized rounding in the app UI.",
  },
  {
    label: "Decorative gradient",
    pattern: /\b(?:bg-gradient-|radial-gradient|linear-gradient)\b/g,
    note: "Gradients should be intentional and not make operational screens feel decorative.",
  },
  {
    label: "Negative or tight tracking",
    pattern: /\btracking-tight\b|letter-spacing:\s*-\d/gi,
    note: "Tight tracking can make dense app text feel cramped.",
  },
  {
    label: "Overflow visible",
    pattern: /\boverflow-visible\b/g,
    note: "Overflow-visible is fine for popovers/headers, but can hide layout collisions.",
  },
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirs.has(entry.name)) return [];
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (!checkedExtensions.has(path.extname(entry.name))) return [];
    return [fullPath];
  });
}

function lineNumberForIndex(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

const files = walk(scanRoot);
const findings = [];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  for (const check of checks) {
    for (const match of source.matchAll(check.pattern)) {
      findings.push({
        file: path.relative(rootDir, file).replace(/\\/g, "/"),
        line: lineNumberForIndex(source, match.index || 0),
        label: check.label,
        token: match[0],
        note: check.note,
      });
    }
  }
}

if (!findings.length) {
  console.log("UI scan passed: no obvious visual-density hazards found.");
  process.exit(0);
}

console.log(`UI scan found ${findings.length} advisory item${findings.length === 1 ? "" : "s"}:`);
for (const finding of findings.slice(0, 40)) {
  console.log(`- ${finding.file}:${finding.line} [${finding.label}] ${finding.token}`);
  console.log(`  ${finding.note}`);
}
if (findings.length > 40) {
  console.log(`...and ${findings.length - 40} more.`);
}
console.log("UI scan is advisory only; review the listed items when polishing layout density.");
