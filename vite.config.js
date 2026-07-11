import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.split(path.sep).join("/");
          if (normalizedId.includes("/src/components/ui/")) {
            return "ui-components";
          }
          if (
            normalizedId.includes("/src/domain/accounting.ts")
            || normalizedId.includes("/src/lib/appSupport.ts")
          ) {
            return "app-shared";
          }
          if (
            normalizedId.includes("/src/domain/planning.ts")
            || normalizedId.includes("/src/features/planning/")
          ) {
            return "planning-workspace";
          }
          if (
            normalizedId.includes("/src/features/tax/")
            || normalizedId.includes("/src/app/useTaxOverviewModel.js")
            || normalizedId.includes("/src/app/useTaxPacketReportingController.js")
            || normalizedId.includes("/src/app/useTaxWorkspaceController.js")
            || normalizedId.includes("/src/app/useTaxWorkspaceUiController.js")
          ) {
            return "tax-workspace";
          }
          if (
            normalizedId.includes("/src/domain/documentIntelligence.ts")
            || normalizedId.includes("/src/domain/documentAi.ts")
            || normalizedId.includes("/src/features/documents/documentPresentation.js")
            || normalizedId.includes("/src/features/documents/documentWorkflow.js")
          ) {
            return "document-shared";
          }
          if (
            normalizedId.includes("/src/features/documents/DocumentReviewDialog.jsx")
            || normalizedId.includes("/src/features/documents/DocumentPanels.jsx")
          ) {
            return "document-review";
          }
          if (
            normalizedId.includes("/src/domain/documentAi.ts")
            || normalizedId.includes("/src/domain/documentIntelligence.ts")
            || normalizedId.includes("/src/features/documents/")
            || normalizedId.includes("/src/app/documentWorkspaceController.js")
            || normalizedId.includes("/src/app/useDocumentAttachmentWorkflow.js")
            || normalizedId.includes("/src/app/useDocumentReviewModel.js")
            || normalizedId.includes("/src/app/useDocumentWorkspaceUiState.js")
          ) {
            return "documents-workspace";
          }
          if (
            normalizedId.includes("/src/domain/reporting.ts")
            || normalizedId.includes("/src/app/useStatementReportingController.js")
          ) {
            return "reporting-workspace";
          }
          if (
            normalizedId.includes("/src/domain/backupMigrations.ts")
            || normalizedId.includes("/src/domain/dataSafety.ts")
            || normalizedId.includes("/src/domain/demoScenario.ts")
            || normalizedId.includes("/src/domain/releaseNotes.ts")
            || normalizedId.includes("/src/app/useAccessSettingsController.js")
            || normalizedId.includes("/src/app/useDataReplacementWorkflowController.js")
            || normalizedId.includes("/src/app/useDataSafetyWorkspaceModel.js")
            || normalizedId.includes("/src/app/useDesktopBridgeController.js")
            || normalizedId.includes("/src/app/useDesktopPersistenceController.js")
          ) {
            return "settings-desktop";
          }
          if (!normalizedId.includes("node_modules")) return undefined;
          if (normalizedId.includes("lucide-react")) return "icons";
          if (normalizedId.includes("react") || normalizedId.includes("scheduler")) return "react-vendor";
          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
