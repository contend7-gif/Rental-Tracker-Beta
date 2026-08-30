export type PreparedPdfPage = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

export function buildJpegPagesPdf(pages: PreparedPdfPage[]): Uint8Array {
  if (pages.length === 0) throw new Error("At least one photo page is required.");
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const objectCount = 2 + pages.length * 3;
  const offsets = new Array<number>(objectCount + 1).fill(0);
  let byteLength = 0;

  const appendBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    byteLength += bytes.byteLength;
  };
  const appendText = (value: string) => appendBytes(encoder.encode(value));
  const beginObject = (objectNumber: number) => {
    offsets[objectNumber] = byteLength;
    appendText(`${objectNumber} 0 obj\n`);
  };
  const endObject = () => appendText("endobj\n");

  appendText("%PDF-1.4\n% Rental Tracker Companion\n");
  beginObject(1);
  appendText("<< /Type /Catalog /Pages 2 0 R >>\n");
  endObject();
  beginObject(2);
  const pageReferences = pages.map((_, index) => `${3 + index * 3} 0 R`).join(" ");
  appendText(`<< /Type /Pages /Count ${pages.length} /Kids [${pageReferences}] >>\n`);
  endObject();

  pages.forEach((page, index) => {
    const pageObject = 3 + index * 3;
    const imageObject = pageObject + 1;
    const contentObject = pageObject + 2;
    const landscape = page.width > page.height;
    const pageWidth = landscape ? 792 : 612;
    const pageHeight = landscape ? 612 : 792;
    const margin = 18;
    const scale = Math.min((pageWidth - margin * 2) / page.width, (pageHeight - margin * 2) / page.height);
    const drawWidth = page.width * scale;
    const drawHeight = page.height * scale;
    const left = (pageWidth - drawWidth) / 2;
    const bottom = (pageHeight - drawHeight) / 2;
    const content = `q\n${drawWidth.toFixed(3)} 0 0 ${drawHeight.toFixed(3)} ${left.toFixed(3)} ${bottom.toFixed(3)} cm\n/Im0 Do\nQ\n`;
    const contentBytes = encoder.encode(content);

    beginObject(pageObject);
    appendText(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 ${imageObject} 0 R >> >> /Contents ${contentObject} 0 R >>\n`);
    endObject();

    beginObject(imageObject);
    appendText(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.byteLength} >>\nstream\n`);
    appendBytes(page.bytes);
    appendText("\nendstream\n");
    endObject();

    beginObject(contentObject);
    appendText(`<< /Length ${contentBytes.byteLength} >>\nstream\n`);
    appendBytes(contentBytes);
    appendText("endstream\n");
    endObject();
  });

  const xrefOffset = byteLength;
  appendText(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
  for (let objectNumber = 1; objectNumber <= objectCount; objectNumber += 1) {
    appendText(`${String(offsets[objectNumber]).padStart(10, "0")} 00000 n \n`);
  }
  appendText(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const output = new Uint8Array(byteLength);
  let outputOffset = 0;
  for (const chunk of chunks) {
    output.set(chunk, outputOffset);
    outputOffset += chunk.byteLength;
  }
  return output;
}
