import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { loadDocumentDataUrlFromDesktop } from "../../app/documentFileAccess.ts";
import { getDocumentPreviewKind } from "../documents/documentPresentation.js";

export function RecordDetailPanel({ children, className = "", ...props }) {
  return <Dialog {...props} variant="panel"><DialogContent className={`rt-record-detail max-w-[1280px] overflow-y-auto ${className}`}>{children}</DialogContent></Dialog>;
}

export function RecordFilePreview({ document, onOpenFull }) {
  const [loaded, setLoaded] = useState(null);
  const [error, setError] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setError("");
    setImageFailed(false);
    setLoading(Boolean(document && !document.dataUrl));
    if (document?.dataUrl) setLoaded(document);
    else if (document) void loadDocumentDataUrlFromDesktop({ document, desktopPersistenceApi: window.desktopPersistence, setNotice: (message) => { if (!cancelled) setError(message); } }).then((file) => { if (!cancelled) setLoaded(file); }).catch(() => { if (!cancelled) setError("The file could not be loaded. Try again."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [document?.id, document?.relativePath, document?.dataUrl, retry]);
  const file = document?.dataUrl ? document : loaded?.id === document?.id ? loaded : null;
  const kind = getDocumentPreviewKind(file || document);
  if (!document) return <div className="rounded-lg border border-dashed p-4 text-sm text-slate-500">No file selected.</div>;
  const hasPreview = Boolean(file?.dataUrl);
  return <section aria-busy={loading} aria-label={`File preview: ${document.name}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0"><div className="truncate text-sm font-semibold">{document.name}</div><div className="text-xs text-slate-500">{hasPreview ? "Preview available" : "Preview not loaded"}</div></div>
      {onOpenFull && <Button size="sm" variant="secondary" onClick={() => onOpenFull(file || document)}>View file</Button>}
    </div>
    {error && <div className="mt-2 space-y-2"><p role="alert" className="text-sm text-amber-800">{error}</p><Button size="sm" variant="secondary" onClick={() => setRetry((value) => value + 1)}>Retry file load</Button></div>}
    {hasPreview && kind === "image" && !imageFailed && <img src={file.dataUrl} alt={`Preview of ${document.name}`} className="mt-3 max-h-[55vh] w-full rounded object-contain" onError={() => setImageFailed(true)} />}
    {hasPreview && kind === "pdf" && <iframe src={file.dataUrl} title={`Preview of ${document.name}`} className="mt-3 h-[55vh] min-h-72 w-full rounded border bg-white" />}
    {imageFailed && <p className="mt-3 text-sm text-slate-600">This image could not be previewed. Use View file to inspect the original.</p>}
    {hasPreview && !["image", "pdf"].includes(kind) && <p className="mt-3 text-sm text-slate-600">Use View file to inspect this file type.</p>}
    {!hasPreview && !error && <p role="status" className="mt-3 text-sm text-slate-600">{loading ? "Loading file…" : "No saved preview is available for this file."}</p>}
  </section>;
}
