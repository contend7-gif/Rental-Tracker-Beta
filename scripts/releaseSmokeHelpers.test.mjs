import test from "node:test";
import assert from "node:assert/strict";
import { collectBundledReleaseNoteVersions, formatReleaseSmokeSummary, validateReleaseSmoke } from "./releaseSmokeHelpers.mjs";

test("collectBundledReleaseNoteVersions finds bundled versions", () => {
  const versions = collectBundledReleaseNoteVersions(`
    {
      version: "1.19.0",
    },
    {
      version: "1.18.4",
    },
  `);

  assert.deepEqual(versions, ["1.19.0", "1.18.4"]);
});

test("validateReleaseSmoke passes for healthy release inputs", () => {
  const issues = validateReleaseSmoke({
    packageJson: { version: "1.19.0", scripts: { "scenario:dry-run": "node --test src/domain/realDuplexScenario.test.ts", "scenario:loan-tax": "node --test src/domain/loanTaxStabilizationScenario.test.ts" } },
    packageLock: { version: "1.19.0", packages: { "": { version: "1.19.0" } } },
    releaseNotesText: 'version: "1.19.0"',
    manualQaText: "Validate latest backup\nTax Center opens to Overview\nActivity Log is accessible from Settings\nAdvanced matching options\nGetting Started no longer occupies Dashboard\nOpen Review Center from primary navigation\nAdd bill from document\nmixed occupancy month\nWorkspace, Data & Backup, and Advanced tabs\nreal duplex dry run\ndocs/loan-tax-reconciliation-qa.md",
    loanTaxReconciliationQaText: "Loan Tax Reconciliation QA",
    realDuplexDryRunText: "Real Duplex Dry Run Checklist",
    scenarioDryRunTestText: "owner draw owner contribution mortgage principal escrow capital improvement lease extension tax packet backup",
    loanTaxScenarioTestText: "selected loan duplicate loan missing month principal escrow pmi 1098 ltv tax center",
    workflowText: 'tags:\n  - "v*"\nrun: npm run smoke:ci\nrelease/latest*.yml',
    preloadText: "desktopDocumentOcr\ndesktopStatementPdf\ndesktopDiagnostics\ndesktopDocumentAi\ndesktopPersistence\nexportBackupArchive\nimportBackupArchive\nopenDataFolder\ndesktopSecrets",
    mainText: "registerDocumentOcrIpc\nregisterDocumentAiIpc\nregisterPersistenceIpc\nregisterSecretsIpc\npersistence:export-backup-archive\npersistence:import-backup-archive\npersistence:open-data-folder\nstatement-pdf:save\nprintToPDF(\ndesktop-diagnostics:run",
    distFiles: ["index.html"],
    releaseFiles: ["win-unpacked/Rental Tracker.exe", "win-unpacked/resources/app.asar"],
  });

  assert.deepEqual(issues, []);
});

test("validateReleaseSmoke reports missing release checks", () => {
  const issues = validateReleaseSmoke({
    packageJson: { version: "1.19.0" },
    packageLock: { version: "1.18.4", packages: { "": { version: "1.18.4" } } },
    releaseNotesText: 'version: "1.18.4"',
    workflowText: "",
    preloadText: "",
    mainText: "",
    distFiles: [],
    releaseFiles: [],
  });

  assert.ok(issues.some((issue) => issue.includes("Version mismatch")));
  assert.ok(issues.some((issue) => issue.includes("Bundled release notes")));
  assert.ok(issues.some((issue) => issue.includes("scenario:dry-run")));
  assert.ok(issues.some((issue) => issue.includes("scenario:loan-tax")));
  assert.ok(issues.some((issue) => issue.includes("real duplex dry-run")));
  assert.ok(issues.some((issue) => issue.includes("loan/tax reconciliation QA")));
  assert.ok(issues.some((issue) => issue.includes("dry-run checklist")));
  assert.ok(issues.some((issue) => issue.includes("loan/tax reconciliation checklist")));
  assert.ok(issues.some((issue) => issue.includes("owner draw invariant")));
  assert.ok(issues.some((issue) => issue.includes("selected loan invariant")));
  assert.ok(issues.some((issue) => issue.includes("smoke:ci")));
  assert.ok(issues.some((issue) => issue.includes("desktopStatementPdf")));
  assert.ok(issues.some((issue) => issue.includes("desktopDiagnostics")));
  assert.ok(issues.some((issue) => issue.includes("desktopDocumentAi")));
  assert.ok(issues.some((issue) => issue.includes("desktopPersistence")));
  assert.ok(issues.some((issue) => issue.includes("zip backup archive methods")));
  assert.ok(issues.some((issue) => issue.includes("desktopSecrets")));
  assert.ok(issues.some((issue) => issue.includes("document AI IPC registration")));
  assert.ok(issues.some((issue) => issue.includes("persistence IPC registration")));
  assert.ok(issues.some((issue) => issue.includes("zip backup IPC wiring")));
  assert.ok(issues.some((issue) => issue.includes("secrets IPC registration")));
  assert.ok(issues.some((issue) => issue.includes("statement PDF export wiring")));
  assert.ok(issues.some((issue) => issue.includes("dist/index.html")));
});

test("formatReleaseSmokeSummary renders readable output", () => {
  assert.match(formatReleaseSmokeSummary([]), /Release smoke passed/);
  assert.match(formatReleaseSmokeSummary(["Example issue"]), /- Example issue/);
});
