import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// An iframe load event does not prove that Chromium painted a PDF page.
export function PdfFilePreview({ source, title, className = "" }) {
  const canvasRef = useRef(null);
  const [document, setDocument] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState(null);
  const pdf = document?.source === source ? document.pdf : null;
  const ready = status?.source === source && status.pageNumber === pageNumber && status.zoom === zoom && status.ready;
  const error = status?.source === source ? status.error : "";

  useEffect(() => {
    let cancelled = false;
    let task;
    setDocument(null);
    setStatus(null);
    setPageNumber(1);
    setZoom(1);
    void (async () => {
      try {
        const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist/build/pdf.mjs");
        if (cancelled) return;
        GlobalWorkerOptions.workerSrc = workerUrl;
        const response = await fetch(source);
        if (!response.ok) throw new Error("File could not be read.");
        const data = new Uint8Array(await response.arrayBuffer());
        if (cancelled) return;
        task = getDocument({ data, isEvalSupported: false });
        task.onPassword = () => {
          if (!cancelled) setStatus({ source, error: "This PDF requires a password. Open it externally to unlock it." });
          void task.destroy();
        };
        const loaded = await task.promise;
        if (!cancelled) setDocument({ source, pdf: loaded });
      } catch {
        if (!cancelled) setStatus((previous) => previous?.error ? previous : { source, error: "The PDF preview could not load. Try again or open the file externally." });
      }
    })();
    return () => { cancelled = true; void task?.destroy(); };
  }, [source, retry]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let renderTask;
    setStatus(null);
    void (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1.5 * zoom });
        const canvas = canvasRef.current;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        renderTask = page.render({ canvas, viewport });
        await renderTask.promise;
        if (!cancelled) setStatus({ source, pageNumber, zoom, ready: true });
      } catch {
        if (!cancelled) setStatus({ source, error: "This PDF page could not be displayed. Try again or open the file externally." });
      }
    })();
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [pdf, source, pageNumber, zoom]);

  return <section aria-label={title} aria-busy={!ready && !error} data-preview-ready={ready ? "true" : "false"}
    className={className + " flex flex-col overflow-hidden"}>
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-slate-50 p-2">
      <Button size="sm" variant="secondary" disabled={!pdf || pageNumber <= 1} onClick={() => setPageNumber((value) => value - 1)}>Previous page</Button>
      <span className="text-xs text-slate-600">Page {pdf ? pageNumber : "—"} of {pdf?.numPages || "—"}</span>
      <Button size="sm" variant="secondary" disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => setPageNumber((value) => value + 1)}>Next page</Button>
      <Button size="sm" variant="secondary" disabled={!pdf || zoom <= 0.5} onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}>Zoom out</Button>
      <span className="text-xs text-slate-600">{Math.round(zoom * 100)}%</span>
      <Button size="sm" variant="secondary" disabled={!pdf || zoom >= 2} onClick={() => setZoom((value) => Math.min(2, value + 0.25))}>Zoom in</Button>
    </div>
    {!ready && !error ? <p role="status" className="p-2 text-xs text-slate-500">Loading PDF preview.</p> : null}
    {error ? <div className="space-y-2 p-3"><p role="alert" className="text-sm text-amber-800">{error}</p><Button size="sm" variant="secondary" onClick={() => setRetry((value) => value + 1)}>Retry PDF preview</Button></div> : null}
    <div className="min-h-0 flex-1 overflow-auto bg-slate-200 p-3">
      <canvas ref={canvasRef} role="img" aria-label={title + ", page " + pageNumber} hidden={!ready}
        className="mx-auto bg-white shadow" style={{ width: (zoom * 100) + "%", maxWidth: "none", height: "auto" }} />
    </div>
  </section>;
}
