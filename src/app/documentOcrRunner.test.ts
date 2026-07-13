import assert from "node:assert/strict";
import test from "node:test";
import { runDesktopDocumentOcr } from "./documentOcrRunner.ts";

const supportsPdf = (name = "", mimeType = "") => name.toLowerCase().endsWith(".pdf") || mimeType === "application/pdf";

test("desktop OCR rejects unsupported files before calling the API", async () => {
  let calls = 0;
  const result = await runDesktopDocumentOcr({
    documentLike: { name: "notes.txt", mimeType: "text/plain" },
    automaticDocumentOcrAvailable: true,
    desktopDocumentOcrApi: {
      isSupported: async () => ({ supported: true }),
      extract: async () => { calls += 1; return { ok: true, text: "text" }; },
    },
    documentSupportsAutomaticOcr: supportsPdf,
  });
  assert.equal(result.reason, "unsupported-file");
  assert.equal(calls, 0);
});

test("desktop OCR reports unavailable when the bridge is missing", async () => {
  const result = await runDesktopDocumentOcr({
    documentLike: { name: "invoice.pdf", mimeType: "application/pdf" },
    automaticDocumentOcrAvailable: true,
    desktopDocumentOcrApi: null,
    documentSupportsAutomaticOcr: supportsPdf,
  });
  assert.equal(result.reason, "desktop-unavailable");
});

test("desktop OCR sends normalized fallback fields through the injected bridge", async () => {
  let payload: Record<string, unknown> | undefined;
  const result = await runDesktopDocumentOcr({
    documentLike: { name: "invoice.pdf", dataUrl: "data:application/pdf;base64,abc" },
    automaticDocumentOcrAvailable: true,
    desktopDocumentOcrApi: {
      isSupported: async () => ({ supported: true }),
      extract: async (nextPayload) => { payload = nextPayload; return { ok: true, text: "Invoice total 50" }; },
    },
    documentSupportsAutomaticOcr: supportsPdf,
  });
  assert.equal(result.text, "Invoice total 50");
  assert.deepEqual(payload, {
    name: "invoice.pdf",
    mimeType: "application/octet-stream",
    dataUrl: "data:application/pdf;base64,abc",
  });
});
