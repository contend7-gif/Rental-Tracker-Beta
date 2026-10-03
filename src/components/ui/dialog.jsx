import React, { createContext, useContext, useId, useLayoutEffect, useRef, useState } from "react";
import { Button } from "./button";

const DialogContext = createContext(null);
const openDialogs = new Set();
let previousOverflow = "";
const fingerprint = (draft) => JSON.stringify(draft, (key, value) => key === "dataUrl" ? undefined : value);

export function Dialog({ open, onOpenChange, children, draft, dirty = false, closeDisabled = false, onDiscardChanges, variant = "modal" }) {
  const ref = useRef(null);
  const callback = useRef(onOpenChange);
  callback.current = onOpenChange;
  const baseline = useRef();
  const previousFocus = useRef(null);
  const pendingAction = useRef(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const titleId = useId();
  const currentDraft = fingerprint(draft);
  useLayoutEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    baseline.current = currentDraft;
    setDiscardOpen(false);
    if (!openDialogs.size) {
      previousOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";
    }
    openDialogs.add(dialog);
    dialog.showModal();
    dialog.querySelector("[data-dialog-title]")?.focus({ preventScroll: true });
    // Native dialogs contain focus and restore it on close, including nested dialogs.
    return () => {
      dialog.close();
      openDialogs.delete(dialog);
      if (!openDialogs.size) document.documentElement.style.overflow = previousOverflow;
    };
  }, [open]);
  const requestTransition = (action) => {
    if (closeDisabled) return;
    if (dirty || (draft !== undefined && baseline.current !== currentDraft)) {
      previousFocus.current = document.activeElement;
      pendingAction.current = action;
      setDiscardOpen(true);
    } else action();
  };
  const requestClose = () => requestTransition(() => callback.current?.(false));
  const keepEditing = () => {
    setDiscardOpen(false);
    requestAnimationFrame(() => previousFocus.current?.isConnected && previousFocus.current.focus());
  };
  const keepEditingRef = useRef(null);
  useLayoutEffect(() => { if (discardOpen) keepEditingRef.current?.focus(); }, [discardOpen]);
  if (!open) return null;
  return (
    <DialogContext.Provider value={{ titleId, requestClose, requestTransition }}>
      <dialog ref={ref} className={`rt-dialog-host ${variant === "panel" && !discardOpen ? "rt-dialog-panel" : ""}`} aria-modal="true" aria-labelledby={discardOpen ? `${titleId}-discard` : titleId}
        onCancel={(event) => { event.preventDefault(); event.stopPropagation(); discardOpen ? keepEditing() : requestClose(); }}
        onClick={(event) => { if (event.target === event.currentTarget && !discardOpen) requestClose(); }}>
        <div className="relative max-h-full w-full overflow-y-auto" hidden={discardOpen} onClick={(event) => { if (event.target === event.currentTarget && !discardOpen) requestClose(); }}>{children}</div>
        {discardOpen && <div role="alertdialog" aria-labelledby={`${titleId}-discard`} aria-describedby={`${titleId}-discard-description`} className="mx-auto w-full max-w-md rounded-xl border bg-white p-6 shadow-xl">
          <h2 id={`${titleId}-discard`} className="text-lg font-semibold">Discard unsaved changes?</h2>
          <p id={`${titleId}-discard-description`} className="mt-2 text-sm text-slate-600">Your changes have not been saved. Keep editing, or discard them and close.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button ref={keepEditingRef} type="button" className="rounded-md border px-3 py-2 text-sm" onClick={keepEditing}>Keep editing</button>
            <Button variant="destructive" onClick={() => {
              const action = pendingAction.current;
              setDiscardOpen(false);
              onDiscardChanges?.();
              requestAnimationFrame(() => {
                // Restore the initiating control before a nested dialog captures focus.
                if (previousFocus.current?.isConnected) previousFocus.current.focus();
                action?.();
              });
            }}>Discard changes</Button>
          </div>
        </div>}
      </dialog>
    </DialogContext.Provider>
  );
}

export function DialogClose(props) {
  const dialog = useContext(DialogContext);
  return <Button {...props} onClick={dialog?.requestClose} />;
}

export function DialogAction({ onProceed, ...props }) {
  const dialog = useContext(DialogContext);
  return <Button {...props} onClick={() => dialog?.requestTransition(onProceed)} />;
}

export function DialogContent({ children, className, ...props }) {
  return <div className={["mx-auto w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-xl", className].filter(Boolean).join(" ")} {...props}>{children}</div>;
}

export function DialogHeader({ children, className, ...props }) {
  return <div className={["space-y-1.5", className].filter(Boolean).join(" ")} {...props}>{children}</div>;
}

export function DialogTitle({ children, className, ...props }) {
  const dialog = useContext(DialogContext);
  return <h2 className={["text-lg font-semibold text-slate-900", className].filter(Boolean).join(" ")} {...props} id={dialog?.titleId || props.id} tabIndex={-1} data-dialog-title>{children}</h2>;
}
