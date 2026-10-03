import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";

const storageKey = (key) => `rental-tracker:draft:v1:${key}`;
const serialize = (draft) => JSON.stringify(draft, (key, value) => ["dataUrl", "file", "attachment"].includes(key) ? undefined : value);
function readDraft(key) {
  try { return JSON.parse(sessionStorage.getItem(storageKey(key)) || "null"); } catch { return null; }
}
function writeDraft(key, draft) {
  const serialized = serialize(draft);
  if (serialized.length > 100_000) throw new Error("This draft is too large to retain. Save the record or keep editing.");
  sessionStorage.setItem(storageKey(key), JSON.stringify({ draft: JSON.parse(serialized), savedAt: new Date().toISOString() }));
  window.dispatchEvent(new CustomEvent("rental-tracker:drafts-changed", { detail: { key } }));
}
function removeDraft(key) { try { sessionStorage.removeItem(storageKey(key)); window.dispatchEvent(new CustomEvent("rental-tracker:drafts-changed", { detail: { key } })); } catch { /* Existing input remains usable when storage is unavailable. */ } }

export function DraftRecoveryControls({ draftKey, draft, onRestore }) {
  const [saved, setSaved] = useState(() => readDraft(draftKey));
  const [message, setMessage] = useState("");
  useEffect(() => { setSaved(readDraft(draftKey)); setMessage(""); }, [draftKey]);
  useEffect(() => {
    const refresh = (event) => { if (event.detail?.key === draftKey) setSaved(readDraft(draftKey)); };
    window.addEventListener("rental-tracker:drafts-changed", refresh);
    return () => window.removeEventListener("rental-tracker:drafts-changed", refresh);
  }, [draftKey]);
  return <div className="my-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" onClick={() => { try { writeDraft(draftKey, draft); setSaved(readDraft(draftKey)); setMessage("Draft saved for this window. Files must be selected again when restoring."); } catch (error) { setMessage(error.message || "The draft could not be retained."); } }}>Save draft</Button>
      {saved?.draft && <>
        <Button size="sm" variant="secondary" onClick={() => { onRestore(saved.draft); setMessage("Draft restored. Review it before saving the record."); }}>Restore draft</Button>
        <Button size="sm" variant="ghost" onClick={() => { removeDraft(draftKey); setSaved(null); setMessage("Saved draft removed."); }}>Remove saved draft</Button>
        <span className="text-xs text-slate-500">Saved {new Date(saved.savedAt).toLocaleString()}</span>
      </>}
    </div>
    <p role="status" className="mt-2 text-xs text-slate-600">{message || "Drafts survive navigation and reload in this window. They expire when the window closes."}</p>
  </div>;
}

export function useTransactionDraftGuard({ draftKey, draft, clearForm }) {
  const baseline = useRef(serialize(draft));
  const edited = useRef(false);
  const saving = useRef(false);
  const latest = useRef(draft);
  latest.current = draft;
  if (!edited.current) baseline.current = serialize(draft);
  const pending = useRef(null);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const isDirty = () => edited.current && serialize(latest.current) !== baseline.current;
  useEffect(() => {
    const onNavigate = (event) => {
      if (saving.current || !isDirty()) return;
      event.preventDefault();
      pending.current = event.detail.proceed;
      setLeaving(true);
    };
    window.addEventListener("rental-tracker:before-navigate", onNavigate);
    return () => window.removeEventListener("rental-tracker:before-navigate", onNavigate);
  }, [draftKey]);
  const leave = (retain) => {
    try {
      if (retain) writeDraft(draftKey, latest.current); else removeDraft(draftKey);
      edited.current = false;
      clearForm();
      setLeaving(false);
      pending.current?.();
    } catch { setError("The draft could not be saved. Keep editing or discard it explicitly."); }
  };
  return {
    markEdited: () => { edited.current = true; },
    clear: () => { edited.current = false; removeDraft(draftKey); clearForm(); },
    runSave: async (save) => {
      saving.current = true;
      try { const result = await save(); if (result === true) { edited.current = false; removeDraft(draftKey); } return result; }
      finally { saving.current = false; }
    },
    prompt: <Dialog open={leaving} onOpenChange={setLeaving}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Leave unsaved transaction?</DialogTitle></DialogHeader><p className="mt-3 text-sm">Keep editing, save a draft for this window, or discard your changes.</p>{error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}<div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setLeaving(false)}>Keep editing</Button><Button onClick={() => leave(true)}>Save draft and leave</Button><Button variant="destructive" onClick={() => leave(false)}>Discard and leave</Button></div></DialogContent></Dialog>,
  };
}
