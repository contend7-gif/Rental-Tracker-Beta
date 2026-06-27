import path from "node:path";

export function collectBundledReleaseNoteVersions(sourceText) {
  return [...String(sourceText || "").matchAll(/version:\s*"([^"]+)"/g)].map((match) => match[1]);
}

export function validateReleaseSmoke(inputs) {
  const issues = [];
  const packageVersion = String(inputs?.packageJson?.version || "").trim();
  const packageLockVersion = String(inputs?.packageLock?.version || "").trim();
  const rootPackageLockVersion = String(inputs?.packageLock?.packages?.[""]?.version || "").trim();
  const releaseNoteVersions = collectBundledReleaseNoteVersions(inputs?.releaseNotesText);
  const workflowText = String(inputs?.workflowText || "");
  const preloadText = String(inputs?.preloadText || "");
  const mainText = String(inputs?.mainText || "");
  const manualQaText = String(inputs?.manualQaText || "");
  const loanTaxReconciliationQaText = String(inputs?.loanTaxReconciliationQaText || "");
  const realDuplexDryRunText = String(inputs?.realDuplexDryRunText || "");
  const scenarioDryRunTestText = String(inputs?.scenarioDryRunTestText || "");
  const loanTaxScenarioTestText = String(inputs?.loanTaxScenarioTestText || "");
  const packageScripts = inputs?.packageJson?.scripts || {};
  const distFiles = new Set((inputs?.distFiles || []).map((entry) => String(entry).replace(/\\/g, "/")));
  const releaseFiles = new Set((inputs?.releaseFiles || []).map((entry) => String(entry).replace(/\\/g, "/")));

  if (!packageVersion) {
    issues.push("package.json is missing a version.");
  }
  if (packageVersion !== packageLockVersion || packageVersion !== rootPackageLockVersion) {
    issues.push(`Version mismatch across package metadata (package.json=${packageVersion || "missing"}, package-lock=${packageLockVersion || "missing"}, root package-lock=${rootPackageLockVersion || "missing"}).`);
  }
  if (packageVersion && !releaseNoteVersions.includes(packageVersion)) {
    issues.push(`Bundled release notes are missing version ${packageVersion}.`);
  }
  if (!manualQaText.includes("Validate latest backup")) {
    issues.push("Manual QA checklist is missing the latest-backup validation check.");
  }
  if (!manualQaText.includes("Tax Center opens to Overview")) {
    issues.push("Manual QA checklist is missing the Tax Center Overview check.");
  }
  if (!manualQaText.includes("Activity Log is accessible from Settings")) {
    issues.push("Manual QA checklist is missing the Settings-accessible Activity Log check.");
  }
  if (!manualQaText.includes("Advanced matching options")) {
    issues.push("Manual QA checklist is missing the advanced matching options check.");
  }
  if (!manualQaText.includes("Getting Started no longer occupies Dashboard")) {
    issues.push("Manual QA checklist is missing the completed setup Dashboard decluttering check.");
  }
  if (!manualQaText.includes("Open Review Center from primary navigation")) {
    issues.push("Manual QA checklist is missing the Review Center navigation check.");
  }
  if (!manualQaText.includes("Add bill from document")) {
    issues.push("Manual QA checklist is missing the bill-from-document workflow check.");
  }
  if (!manualQaText.includes("mixed occupancy month")) {
    issues.push("Manual QA checklist is missing the mixed-month lease detail check.");
  }
  if (!manualQaText.includes("Workspace, Data & Backup, and Advanced tabs")) {
    issues.push("Manual QA checklist is missing the Settings tabs check.");
  }
  if (!/docs\/real-duplex-dry-run\.md|real duplex dry run/i.test(manualQaText)) {
    issues.push("Manual QA checklist is missing the real duplex dry-run reference.");
  }
  if (!/docs\/loan-tax-reconciliation-qa\.md|loan tax reconciliation/i.test(manualQaText)) {
    issues.push("Manual QA checklist is missing the loan/tax reconciliation QA reference.");
  }
  if (!packageScripts["scenario:dry-run"]) {
    issues.push("package.json is missing the scenario:dry-run script.");
  }
  if (!packageScripts["scenario:loan-tax"]) {
    issues.push("package.json is missing the scenario:loan-tax script.");
  }
  if (!realDuplexDryRunText.includes("Real Duplex Dry Run Checklist")) {
    issues.push("docs/real-duplex-dry-run.md is missing or does not look like the dry-run checklist.");
  }
  if (!/Loan Tax Reconciliation QA|Loan\/Tax Reconciliation QA/i.test(loanTaxReconciliationQaText)) {
    issues.push("docs/loan-tax-reconciliation-qa.md is missing or does not look like the loan/tax reconciliation checklist.");
  }
  for (const invariant of ["owner draw", "owner contribution", "mortgage principal", "escrow", "capital improvement", "lease extension", "tax packet", "backup"]) {
    if (!scenarioDryRunTestText.toLowerCase().includes(invariant)) {
      issues.push(`Real duplex scenario test is missing the ${invariant} invariant.`);
    }
  }
  for (const invariant of ["selected loan", "duplicate loan", "missing month", "principal", "escrow", "pmi", "1098", "ltv", "tax center"]) {
    if (!loanTaxScenarioTestText.toLowerCase().includes(invariant)) {
      issues.push(`Loan/tax stabilization scenario test is missing the ${invariant} invariant.`);
    }
  }

  if (!workflowText.includes('npm run smoke:ci')) {
    issues.push("GitHub workflow preflight does not run npm run smoke:ci.");
  }
  if (!workflowText.includes('tags:') || !workflowText.includes('- "v*"')) {
    issues.push("GitHub workflow is not configured to trigger on v* tags.");
  }
  if (!workflowText.includes("release/latest*.yml")) {
    issues.push("GitHub workflow is not uploading latest*.yml update metadata.");
  }

  if (!preloadText.includes("desktopDocumentOcr")) {
    issues.push("Electron preload is missing the desktopDocumentOcr bridge.");
  }
  if (!preloadText.includes("desktopStatementPdf")) {
    issues.push("Electron preload is missing the desktopStatementPdf bridge.");
  }
  if (!preloadText.includes("desktopDiagnostics")) {
    issues.push("Electron preload is missing the desktopDiagnostics bridge.");
  }
  if (!preloadText.includes("desktopDocumentAi")) {
    issues.push("Electron preload is missing the desktopDocumentAi bridge.");
  }
  if (!preloadText.includes("desktopPersistence")) {
    issues.push("Electron preload is missing the desktopPersistence bridge.");
  }
  if (!preloadText.includes("exportBackupArchive") || !preloadText.includes("importBackupArchive")) {
    issues.push("Electron preload is missing zip backup archive methods.");
  }
  if (!preloadText.includes("openDataFolder")) {
    issues.push("Electron preload is missing the desktop data-folder action.");
  }
  if (!preloadText.includes("desktopSecrets")) {
    issues.push("Electron preload is missing the desktopSecrets bridge.");
  }
  if (!mainText.includes("registerDocumentOcrIpc")) {
    issues.push("Electron main process is missing document OCR IPC registration.");
  }
  if (!mainText.includes("registerDocumentAiIpc")) {
    issues.push("Electron main process is missing document AI IPC registration.");
  }
  if (!mainText.includes("printToPDF(") || !mainText.includes("statement-pdf:save")) {
    issues.push("Electron main process is missing statement PDF export wiring.");
  }
  if (!mainText.includes("desktop-diagnostics:run")) {
    issues.push("Electron main process is missing desktop diagnostics IPC wiring.");
  }
  if (!mainText.includes("registerPersistenceIpc")) {
    issues.push("Electron main process is missing persistence IPC registration.");
  }
  if (!mainText.includes("persistence:export-backup-archive") || !mainText.includes("persistence:import-backup-archive")) {
    issues.push("Electron main process is missing zip backup IPC wiring.");
  }
  if (!mainText.includes("persistence:open-data-folder")) {
    issues.push("Electron main process is missing the data-folder IPC wiring.");
  }
  if (!mainText.includes("registerSecretsIpc")) {
    issues.push("Electron main process is missing secrets IPC registration.");
  }

  if (!distFiles.has("index.html")) {
    issues.push("dist/index.html was not found after the build.");
  }
  if (!releaseFiles.has("win-unpacked/Rental Tracker.exe")) {
    issues.push("release/win-unpacked/Rental Tracker.exe was not found after desktop packing.");
  }
  if (!releaseFiles.has("win-unpacked/resources/app.asar")) {
    issues.push("release/win-unpacked/resources/app.asar was not found after desktop packing.");
  }

  return issues;
}

export function formatReleaseSmokeSummary(issues) {
  if (!Array.isArray(issues) || issues.length === 0) {
    return "Release smoke passed: metadata, workflow, manual QA, Electron bridges, and packaged desktop artifacts look healthy.";
  }

  return [
    "Release smoke failed:",
    ...issues.map((issue) => `- ${issue}`),
  ].join("\n");
}

export function relativeFileList(rootDir, filePaths) {
  return (filePaths || []).map((filePath) => path.relative(rootDir, filePath).replace(/\\/g, "/"));
}
