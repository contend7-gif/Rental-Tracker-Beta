import type { CompanionSubmission } from "../types/desktop.d.ts";

export type CompanionCaptureKind = "receipt" | "maintenance";

export function companionCaptureKind(value: unknown): CompanionCaptureKind {
  return value === "maintenance" ? "maintenance" : "receipt";
}

export function buildMobileCompanionImportContext(submission: CompanionSubmission) {
  const kind = companionCaptureKind(submission.kind);
  const note = String(submission.note || "").trim();

  if (kind === "maintenance") {
    return {
      kind,
      documentType: "Maintenance Photo",
      contextTag: "Maintenance",
      extractedText: note ? `Mobile maintenance report\n${note}` : "",
      ocrStatus: note ? "completed" as const : "pending" as const,
      shouldRunOcr: !note,
      message: note
        ? `Maintenance details: ${note}`
        : "Maintenance photo captured on mobile and ready to review.",
    };
  }

  return {
    kind,
    documentType: "Receipt",
    contextTag: "Receipt",
    extractedText: "",
    ocrStatus: "pending" as const,
    shouldRunOcr: true,
    message: note ? `Mobile note: ${note}` : "Captured on mobile and ready to review.",
  };
}
