import assert from "node:assert/strict";
import test from "node:test";
import { createDocumentRecordActions } from "./documentRecordActions.ts";
import { createDocumentAiActions } from "./documentAiActions.ts";

test("extracted preview action loads the selected file before opening it", async () => {
  const document = { id: "doc", name: "Example receipt", propertyId: "p1", type: "Receipt" };
  const events: string[] = [];
  const actions = createDocumentRecordActions({
    prefetchDialog: () => events.push("prefetch"),
    loadDocumentDataUrl: async (item: unknown) => { assert.equal(item, document); events.push("load"); return { ...document, dataUrl: "data:example" }; },
    setSelectedDocument: (item: { dataUrl: string }) => { assert.equal(item.dataUrl, "data:example"); events.push("open"); },
  } as never);
  await actions.openDocumentPreview(document);
  assert.deepEqual(events, ["prefetch", "load", "open"]);
});

test("extracted AI action respects permissions and clears busy state after failure", async () => {
  const document = { id: "doc", name: "Example receipt", propertyId: "p1", type: "Receipt", extractedText: "Example invoice" };
  let allowed = false;
  let requests = 0;
  let busy: Record<string, boolean> = {};
  const notices: string[] = [];
  const actions = createDocumentAiActions({
    requirePermission: () => allowed,
    aiDocumentCopilotEnabled: true,
    aiOpenAiApiKey: "fictional-key",
    normalizeExtractedDocumentText: (text: string) => text,
    buildDocumentAiContext: (document: unknown) => ({ document }),
    setDocumentAiBusyById: (update: (prior: typeof busy) => typeof busy) => { busy = update(busy); },
    setNotice: (notice: string) => notices.push(notice),
    desktopDocumentAiApi: { analyze: async () => { requests += 1; assert.equal(busy.doc, true); throw new Error("Example failure"); } },
  } as never);
  assert.equal(await actions.runDocumentAiAnalysis(document), false);
  assert.equal(requests, 0);
  allowed = true;
  assert.equal(await actions.runDocumentAiAnalysis(document), false);
  assert.equal(requests, 1);
  assert.deepEqual(busy, {});
  assert.match(notices.at(-1)!, /Example failure/);
});
