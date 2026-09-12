// Read embedded PDF text locally. Scanned or mixed PDFs fall back to Windows OCR.
export async function extractPdfText(buffer, maxPages = 8) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: true, verbosity: 0 });
  let timer;
  try {
    return await Promise.race([
      (async () => {
        const pdf = await task.promise;
        const pageCount = Math.min(pdf.numPages, maxPages);
        const pages = [];
        for (let index = 1; index <= pageCount; index += 1) {
          const page = await pdf.getPage(index);
          const content = await page.getTextContent();
          const viewport = page.getViewport({ scale: 1 });
          const words = content.items.filter((item) => typeof item.str === "string" && item.str.trim()).map((item) => {
            const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
            return { text: item.str, x, y, height: Math.max(1, item.height) };
          }).sort((a, b) => a.y - b.y || a.x - b.x);
          const rows = [];
          for (const word of words) {
            let row = rows.at(-1);
            if (!row || Math.abs(word.y - row.y) > Math.min(word.height, row.height) * 0.5) {
              row = { y: word.y, height: word.height, words: [] };
              rows.push(row);
            }
            row.words.push(word);
          }
          const text = rows.map((row) => row.words.sort((a, b) => a.x - b.x).map((word) => word.text).join(" ")).join("\n");
          // Avoid silently omitting an image-only page in a mixed document.
          if (text.replace(/\s/g, "").length < 40) return null;
          pages.push(text);
          page.cleanup();
        }
        return { ok: true, supported: true, text: pages.join("\n\n"), processedPages: pageCount, totalPages: pdf.numPages, truncated: pdf.numPages > pageCount, engine: "pdf-text", fileKind: "pdf" };
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("PDF text reading timed out")), 30000); }),
    ]);
  } finally {
    clearTimeout(timer);
    await task.destroy();
  }
}
