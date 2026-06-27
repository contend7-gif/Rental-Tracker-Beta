import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceExtensions = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".txt",
  ".html",
  ".css",
]);

const excludedPathParts = new Set(["node_modules", "dist", "release", ".git"]);
const excludedFiles = new Set(["package-lock.json"]);
const allowlistedText = [
  "example.com",
  ".example",
  "Example Ave",
  "Example Duplex",
  "Sampleville",
  "ACCT-TEST",
  "LOAN-TEST",
  "000000",
  "111111",
  "999999",
];

const forbiddenTerms = [
  ["Nicho", "las"].join(""),
  ["Waugh", "tal"].join(""),
  ["Lin", "den"].join(""),
  ["Marsh", "field"].join(""),
  ["Cal", "li ", "Marg"].join(""),
  ["Fran", "ces ", "Jan", "isch"].join(""),
  ["Metz ", "Home ", "Inspections"].join(""),
  ["We ", "Energies"].join(""),
  ["54", "449"].join(""),
  ["074", "998", "9383"].join(""),
  ["486", "050", "3020"].join(""),
];

const secretRules = [
  ["openai_key", new RegExp("s" + "k-[A-Za-z0-9_-]{20,}")],
  ["github_token", /ghp_[A-Za-z0-9_]{20,}/],
  ["github_pat", /github_pat_[A-Za-z0-9_]{20,}/],
  ["bearer_token", /Authorization:\s*Bearer\s+[A-Za-z0-9._~+/=-]{24,}/i],
  ["private_key", /-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----/],
];

const suspiciousAccountRules = [
  ["account_number", /\bAccount\s*(?:#|Number)?\s*[:#-]?\s*(?!ACCT-TEST\b)(?!0{6}\b)(?!1{6}\b)(?!9{6}\b)[A-Za-z0-9-]*\d[A-Za-z0-9-]{4,}\b/i],
  ["loan_number", /\bLoan\s*number\s*[:#-]?\s*(?!LOAN-TEST\b)(?!0{6}\b)(?!1{6}\b)(?!9{6}\b)[A-Za-z0-9-]*\d[A-Za-z0-9-]{4,}\b/i],
  ["mortgage_account", /\bMortgage\s*account\s*[:#-]?\s*(?!0{6}\b)(?!1{6}\b)(?!9{6}\b)[A-Za-z0-9-]*\d[A-Za-z0-9-]{4,}\b/i],
  ["routing_number", /\bRouting\s*number\s*[:#-]?\s*(?!0{6}\b)(?!1{6}\b)(?!9{6}\b)\d{9}\b/i],
];

function repoFiles() {
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
  });
  return output.split(/\r?\n/).filter(Boolean);
}

function isExcluded(file) {
  const normalized = file.replace(/\\/g, "/");
  if (excludedFiles.has(path.basename(normalized))) return true;
  return normalized.split("/").some((part) => excludedPathParts.has(part));
}

function isSourceLike(file) {
  return sourceExtensions.has(path.extname(file).toLowerCase());
}

function isBinary(buffer) {
  return buffer.includes(0);
}

function isAllowedMatch(value) {
  return allowlistedText.some((allowed) => value.includes(allowed));
}

function addFinding(findings, file, rule) {
  findings.push({ file: file.replace(/\\/g, "/"), rule });
}

const findings = [];

for (const file of repoFiles()) {
  const normalized = file.replace(/\\/g, "/");
  const fullPath = path.join(root, file);
  if (!existsSync(fullPath)) continue;

  if (normalized.startsWith("generated/")) addFinding(findings, file, "generated_path");
  if (/rental-tracker-(?:import-backup|backup|export).*\.json$/i.test(path.basename(normalized))) {
    addFinding(findings, file, "backup_export_filename");
  }

  if (isExcluded(file) || !isSourceLike(file)) continue;
  const buffer = readFileSync(fullPath);
  if (isBinary(buffer)) continue;
  const text = buffer.toString("utf8");

  for (const term of forbiddenTerms) {
    if (text.toLowerCase().includes(term.toLowerCase()) && !isAllowedMatch(term)) {
      addFinding(findings, file, "forbidden_real_data_term");
    }
  }

  for (const [rule, pattern] of secretRules) {
    if (pattern.test(text)) addFinding(findings, file, rule);
  }

  for (const [rule, pattern] of suspiciousAccountRules) {
    if (pattern.test(text)) addFinding(findings, file, rule);
  }

  if (
    path.extname(file).toLowerCase() === ".json" &&
    text.includes('"schemaVersion"') &&
    text.includes('"transactions"') &&
    text.includes('"leases"') &&
    text.includes('"documents"')
  ) {
    addFinding(findings, file, "app_backup_json_shape");
  }
}

const uniqueFindings = Array.from(new Map(findings.map((finding) => [`${finding.file}:${finding.rule}`, finding])).values());

if (uniqueFindings.length > 0) {
  console.error("Privacy scan failed. Remove real personal/rental data, backup exports, database files, or secrets before committing.");
  for (const finding of uniqueFindings) {
    console.error(`- ${finding.file} [${finding.rule}]`);
  }
  process.exit(1);
}

console.log("Privacy scan passed.");
