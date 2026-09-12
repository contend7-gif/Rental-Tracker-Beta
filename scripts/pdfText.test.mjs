import assert from "node:assert/strict";
import test from "node:test";
import { extractPdfText } from "../electron/pdfText.mjs";
import { makeTextPdf } from "./fixtures/pdfFixture.mjs";

const page = [
  { text: "40.00", x: 450, y: 600 },
  { text: "Sample provider invoice", y: 720 },
  { text: "Amount Due", y: 600 },
  { text: "Statement date: 04/17/2026", y: 680 },
];

test("native PDFs preserve visual rows even when storage order is different", async () => {
  const result = await extractPdfText(makeTextPdf([page]));
  assert.equal(result.engine, "pdf-text");
  assert.match(result.text, /^Sample provider invoice/);
  assert.match(result.text, /Amount Due 40\.00/);
  assert.equal(result.truncated, false);
});

test("PDF page limits are reported and mixed unreadable pages request OCR", async () => {
  const limited = await extractPdfText(makeTextPdf([page, page]), 1);
  assert.equal(limited.processedPages, 1);
  assert.equal(limited.totalPages, 2);
  assert.equal(limited.truncated, true);
  assert.equal(await extractPdfText(makeTextPdf([page, []])), null);
});
