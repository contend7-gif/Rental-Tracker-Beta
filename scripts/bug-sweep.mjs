import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SEARCH_DIRS = ["src", "electron", "scripts", "docs"];
const TEXT_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json", ".md", ".html", ".css"]);
const FINDINGS = [
  { pattern: /^(<<<<<<<|=======|>>>>>>>)\s?/m, label: "merge conflict marker" },
  { pattern: /\bdebugger\s*;/, label: "debugger statement" },
  { pattern: /ReferenceError:\s+\w+\s+is not defined/, label: "committed ReferenceError output" },
  { pattern: /(TODO|FIXME):\s*release[- ]blocker/i, label: "release-blocking TODO" },
  { pattern: /throw new Error\(["']Not implemented["']\)/, label: "not-implemented runtime throw" },
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", "release", ".git"].includes(entry.name)) return [];
      return walk(fullPath);
    }
    if (!TEXT_EXTENSIONS.has(path.extname(entry.name))) return [];
    return [fullPath];
  });
}

const issues = [];
for (const dir of SEARCH_DIRS) {
  for (const file of walk(path.join(ROOT, dir))) {
    const text = fs.readFileSync(file, "utf8");
    for (const finding of FINDINGS) {
      const match = text.match(finding.pattern);
      if (match) {
        const before = text.slice(0, match.index || 0);
        const line = before.split(/\r?\n/).length;
        issues.push(`${path.relative(ROOT, file)}:${line} contains ${finding.label}`);
      }
    }
  }
}

if (issues.length > 0) {
  console.error("Bug sweep failed:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log("Bug sweep passed: no conflict markers or release-blocking runtime leftovers found.");
