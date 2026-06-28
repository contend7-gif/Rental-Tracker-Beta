import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatReleaseSmokeSummary, relativeFileList, validateReleaseSmoke } from "./releaseSmokeHelpers.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function walkFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

const issues = validateReleaseSmoke({
  packageJson: readJson("package.json"),
  packageLock: readJson("package-lock.json"),
  releaseNotesText: readText("src/domain/releaseNotes.ts"),
  manualQaText: readText("docs/manual-qa.md"),
  loanTaxReconciliationQaText: readText("docs/loan-tax-reconciliation-qa.md"),
  realDuplexDryRunText: readText("docs/real-duplex-dry-run.md"),
  scenarioDryRunTestText: readText("src/domain/realDuplexScenario.test.ts"),
  loanTaxScenarioTestText: readText("src/domain/loanTaxStabilizationScenario.test.ts"),
  workflowText: readText(".github/workflows/windows-installer.yml"),
  preloadText: readText("electron/preload.cjs"),
  mainText: `${readText("electron/main.mjs")}\n${readText("electron/persistenceIpc.mjs")}`,
  distFiles: relativeFileList(path.join(rootDir, "dist"), walkFiles(path.join(rootDir, "dist"))),
  releaseFiles: relativeFileList(path.join(rootDir, "release"), walkFiles(path.join(rootDir, "release"))),
});

const summary = formatReleaseSmokeSummary(issues);
console.log(summary);

if (issues.length > 0) {
  process.exitCode = 1;
}
