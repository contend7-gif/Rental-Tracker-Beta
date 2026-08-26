import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Cloud, Loader2, RefreshCw, Settings2, Smartphone, Wrench } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";

export function MobileInboxPanel({ desktopCompanionApi, onImport, onOpenSettings }) {
  const [status, setStatus] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [importingId, setImportingId] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!desktopCompanionApi?.getStatus) return;
    setBusy(true);
    setMessage("");
    try {
      const nextStatus = await desktopCompanionApi.getStatus();
      setStatus(nextStatus);
      if (!nextStatus?.configured) {
        setSubmissions([]);
        return;
      }
      const result = await desktopCompanionApi.list();
      if (result?.ok === false) throw new Error(result.message || result.error || "Could not refresh Mobile Inbox.");
      setSubmissions(result?.submissions || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not refresh Mobile Inbox.");
    } finally {
      setBusy(false);
    }
  }, [desktopCompanionApi]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function importSubmission(submission) {
    setImportingId(submission.id);
    setMessage("");
    try {
      const opened = await onImport?.(submission);
      if (opened) {
        setSubmissions((current) => current.map((item) =>
          item.id === submission.id ? { ...item, status: "claimed" } : item,
        ));
        setMessage("Capture opened in the existing document review flow.");
      }
    } finally {
      setImportingId("");
    }
  }

  if (!desktopCompanionApi) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        Mobile Inbox becomes available in the installed desktop app.
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50/90 to-white p-3.5" aria-label="Mobile Inbox">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm">
          <Smartphone className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-950">Mobile Inbox</h2>
            {status?.configured ? <Badge className="bg-teal-700">Connected</Badge> : <Badge variant="secondary">Setup needed</Badge>}
            {submissions.length > 0 ? <Badge variant="secondary">{submissions.length} waiting</Badge> : null}
          </div>
          <p className="mt-0.5 text-xs text-slate-600">Receipt and maintenance captures wait here until you choose one to review.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void refresh()} disabled={busy}>
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
          Refresh
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onOpenSettings?.()}>
          <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Settings
        </Button>
      </div>

      {message ? <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-700">{message}</p> : null}

      {!status?.configured && !busy ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-teal-200 bg-white/70 px-3 py-3 text-xs text-slate-600">
          <span>Pair a private companion under Settings → Admin &amp; Tools before using Mobile Inbox.</span>
          <Button size="sm" variant="secondary" onClick={() => onOpenSettings?.()}>Open Settings</Button>
        </div>
      ) : null}

      {status?.configured && !busy && submissions.length === 0 ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-teal-200 bg-white/70 px-3 py-3 text-xs text-slate-600">
          <CheckCircle2 className="h-4 w-4 text-teal-700" /> Nothing is waiting. New phone captures will appear here.
        </div>
      ) : null}

      {submissions.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {submissions.map((submission) => (
            <article key={submission.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                {submission.kind === "maintenance" ? <Wrench className="h-4 w-4" /> : <Cloud className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-medium text-slate-950">{submission.kind === "maintenance" ? "Maintenance report" : submission.originalFileName}</div>
                  <Badge variant="secondary">{submission.kind === "maintenance" ? "Maintenance" : "Receipt"}</Badge>
                </div>
                <div className="truncate text-xs text-slate-500">
                  {submission.propertyLabel || "Property not assigned"}{submission.unitLabel ? ` · ${submission.unitLabel}` : ""} · {formatCaptureTime(submission.createdAt)}
                </div>
                {submission.note ? <div className="mt-1 truncate text-xs text-slate-600">“{submission.note}”</div> : null}
              </div>
              {submission.status === "claimed" ? <Badge variant="secondary">In review</Badge> : null}
              <Button size="sm" onClick={() => void importSubmission(submission)} disabled={Boolean(importingId)}>
                {importingId === submission.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Review & import
              </Button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function formatCaptureTime(value) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Recently";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(parsed);
}
