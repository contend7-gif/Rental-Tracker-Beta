import assert from "node:assert/strict";
import test from "node:test";
import { buildJpegPagesPdf } from "../lib/photo-pdf.ts";

test("photo pages become one structurally valid ordered PDF", () => {
  const firstJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const secondJpeg = new Uint8Array([0xff, 0xd8, 0x01, 0x02, 0xff, 0xd9]);
  const pdf = buildJpegPagesPdf([
    { bytes: firstJpeg, width: 1200, height: 1800 },
    { bytes: secondJpeg, width: 1800, height: 1200 },
  ]);
  const text = new TextDecoder().decode(pdf);

  assert.equal(text.startsWith("%PDF-1.4"), true);
  assert.match(text, /\/Count 2/);
  assert.match(text, /\/Kids \[3 0 R 6 0 R\]/);
  assert.match(text, /\/MediaBox \[0 0 612 792\]/);
  assert.match(text, /\/MediaBox \[0 0 792 612\]/);
  const startXref = Number(text.match(/startxref\n(\d+)\n%%EOF/)?.[1]);
  assert.equal(startXref, text.indexOf("xref\n"));
});

test("photo PDF builder rejects an empty document", () => {
  assert.throws(() => buildJpegPagesPdf([]), /At least one photo page is required/);
});
