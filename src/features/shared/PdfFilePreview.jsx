import { useState } from "react";
import { Button } from "../../components/ui/button";

export function PdfFilePreview({ source, title, className }) {
  const [loadedSource, setLoadedSource] = useState("");
  const [failedSource, setFailedSource] = useState("");
  const [retry, setRetry] = useState(0);
  const ready = loadedSource === source;
  const failed = failedSource === source;

  return <div aria-busy={!ready && !failed}>
    {!ready && !failed ? <p role="status" className="mt-2 text-xs text-slate-500">Loading PDF preview…</p> : null}
    {failed ? <div className="mt-2 space-y-2"><p role="alert" className="text-sm text-amber-800">The PDF preview could not load.</p><Button size="sm" variant="secondary" onClick={() => { setFailedSource(""); setLoadedSource(""); setRetry((value) => value + 1); }}>Retry PDF preview</Button></div> : null}
    <iframe key={retry} src={source} title={title} className={className}
      data-preview-ready={ready ? "true" : "false"}
      onLoad={() => { setLoadedSource(source); setFailedSource(""); }}
      onError={() => { setLoadedSource(""); setFailedSource(source); }} />
  </div>;
}
