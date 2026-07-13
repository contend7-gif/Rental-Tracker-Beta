import assert from "node:assert/strict";
import test from "node:test";
import { createBlankDocumentImportDraft } from "./draftFactories.js";
import { runDocumentImportOcrWorkflow } from "./documentImportOcrWorkflow.ts";

function dependencies(overrides: Partial<Parameters<typeof runDocumentImportOcrWorkflow>[0]> = {}) {
  let draft = { ...createBlankDocumentImportDraft("p1"), name: "invoice.pdf", mimeType: "application/pdf", dataUrl: "data:pdf" };
  const requestIdRef = { current: 0 };
  const busy: boolean[] = [];
  const messages: string[] = [];
  return {
    busy,
    messages,
    requestIdRef,
    getDraft: () => draft,
    args: {
      draft,
      requestIdRef,
      documentSupportsAutomaticOcr: () => true,
      automaticDocumentOcrAvailable: true,
      setBusy: (value: boolean) => busy.push(value),
      setMessage: (value: string) => messages.push(value),
      runAutomaticDocumentOcr: async () => ({ ok: true, text: " Invoice total 50 " }),
      normalizeExtractedDocumentText: (value: unknown) => String(value || "").trim(),
      setDraft: (updater: (previous: typeof draft) => typeof draft) => { draft = updater(draft); },
      getSuggestedTags: () => ["Invoice", "Review"],
      formatTags: (value: unknown) => (value as string[]).join(", "),
      ...overrides,
    },
  };
}

test("import OCR reports unsupported files without starting OCR", async () => {
  let runs = 0;
  const state = dependencies({
    documentSupportsAutomaticOcr: () => false,
    runAutomaticDocumentOcr: async () => { runs += 1; return { ok: true }; },
  });
  await runDocumentImportOcrWorkflow(state.args);
  assert.equal(runs, 0);
  assert.deepEqual(state.busy, [false]);
  assert.match(state.messages[0], /supports PDFs/);
});

test("successful import OCR updates only the matching draft", async () => {
  const state = dependencies();
  await runDocumentImportOcrWorkflow(state.args);
  assert.equal(state.getDraft().extractedText, "Invoice total 50");
  assert.equal(state.getDraft().ocrStatus, "completed");
  assert.equal(state.getDraft().tags, "Invoice, Review");
  assert.deepEqual(state.busy, [true, false]);
  assert.match(state.messages.at(-1) || "", /searchable text/);
});

test("empty import OCR results leave the draft pending", async () => {
  const state = dependencies({ runAutomaticDocumentOcr: async () => ({ ok: true, text: "  " }) });
  await runDocumentImportOcrWorkflow(state.args);
  assert.equal(state.getDraft().ocrStatus, "pending");
  assert.match(state.messages.at(-1) || "", /no readable text/);
});

test("stale import OCR results cannot overwrite a newer request", async () => {
  const state = dependencies({
    runAutomaticDocumentOcr: async () => {
      state.requestIdRef.current += 1;
      return { ok: true, text: "stale text" };
    },
  });
  await runDocumentImportOcrWorkflow(state.args);
  assert.equal(state.getDraft().extractedText, "");
  assert.deepEqual(state.busy, [true]);
  assert.deepEqual(state.messages, ["Running automatic OCR..."]);
});
