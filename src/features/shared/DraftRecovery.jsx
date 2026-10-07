import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { discardDraft, readSavedDraft, saveDraft, serializeDraft } from "../../app/draftRecovery.ts";

const serialize = serializeDraft;
function readDraft(key, legacyKey) {
  try { return readSavedDraft(localStorage, key, sessionStorage, legacyKey); } catch { return null; }
}
function writeDraft(key, draft) {
  saveDraft(localStorage, key, draft);
  window.dispatchEvent(new CustomEvent("rental-tracker:drafts-changed", { detail: { key } }));
}
export function removeSavedDraft(key, legacyKey) {
  discardDraft(localStorage, key, sessionStorage, legacyKey);
  window.dispatchEvent(new CustomEvent("rental-tracker:drafts-changed", { detail: { key } }));
}
const removeDraft = removeSavedDraft;

export function DraftRecoveryControls({ draftKey, legacyDraftKey, draft, onRestore }) {
  const [saved, setSaved] = useState(() => readDraft(draftKey, legacyDraftKey));
  const [message, setMessage] = useState("");
  useEffect(() => { setSaved(readDraft(draftKey, legacyDraftKey)); setMessage(""); }, [draftKey, legacyDraftKey]);
  useEffect(() => {
    const refresh = (event) => { if (event.detail?.key === draftKey) setSaved(readDraft(draftKey, legacyDraftKey)); };
    window.addEventListener("rental-tracker:drafts-changed", refresh);
    return () => window.removeEventListener("rental-tracker:drafts-changed", refresh);
  }, [draftKey, legacyDraftKey]);
  return <div className={`my-3 rounded-lg border p-3 text-sm ${saved ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"}`}>
    {saved && <p className="mb-2 font-medium">Saved draft available</p>}
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" onClick={() => { try { writeDraft(draftKey, draft); setSaved(readDraft(draftKey)); setMessage("Draft saved on this computer. You can resume after reopening the app. Files must be selected again."); } catch (error) { setMessage(error.message || "The draft could not be retained."); } }}>Save draft</Button>
      {saved?.draft && <>
        <Button size="sm" variant="secondary" onClick={() => { onRestore(saved.draft); setMessage("Draft resumed. Review it before saving the record."); }}>Resume draft</Button>
        <Button size="sm" variant="ghost" onClick={() => { try { removeDraft(draftKey, legacyDraftKey); setSaved(null); setMessage("Saved draft discarded. Current form entries have not changed."); } catch (error) { setMessage(error.message); } }}>Discard draft</Button>
        <span className="text-xs text-slate-500">Saved {new Date(saved.savedAt).toLocaleString()}</span>
      </>}
    </div>
    <p role="status" className="mt-2 text-xs text-slate-600">{message || "Save a draft to resume after reopening the app. Drafts stay on this computer and do not post records. Files must be selected again."}</p>
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
    error,
    clear: () => {
      try {
        removeDraft(draftKey);
        clearForm();
        edited.current = false;
        setError("");
        return true;
      } catch {
        setError("The form could not be cleared because its saved draft could not be removed. Your entries are unchanged and still protected. Try again.");
        return false;
      }
    },
    runSave: async (save) => {
      saving.current = true;
      try { const result = await save(); if (result === true) { edited.current = false; removeDraft(draftKey); } return result; }
      finally { saving.current = false; }
    },
    prompt: <Dialog open={leaving} onOpenChange={setLeaving}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Leave unsaved transaction?</DialogTitle></DialogHeader><p className="mt-3 text-sm">Keep editing, save a draft to resume later, or discard your changes.</p>{error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}<div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" onClick={() => setLeaving(false)}>Keep editing</Button><Button onClick={() => leave(true)}>Save draft and leave</Button><Button variant="destructive" onClick={() => leave(false)}>Discard and leave</Button></div></DialogContent></Dialog>,
  };
}
