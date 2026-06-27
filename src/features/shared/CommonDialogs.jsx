import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";

export function DialogLoadFallback({ message, onClose }) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-slate-700">{message}</div>
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

export function LeaseValidationDialog({
  dialogContentSmClass,
  leaseValidationDialog,
  setLeaseValidationDialog,
}) {
  return (
    <Dialog
      open={leaseValidationDialog.open}
      onOpenChange={(isOpen) => {
        if (!isOpen) setLeaseValidationDialog({ open: false, message: "" });
      }}
    >
      <DialogContent className={dialogContentSmClass}>
        <DialogHeader>
          <DialogTitle>Lease details required</DialogTitle>
        </DialogHeader>
        <div className="mt-2 text-sm text-slate-700">{leaseValidationDialog.message}</div>
        <div className="mt-3 flex justify-end">
          <Button variant="secondary" onClick={() => setLeaseValidationDialog({ open: false, message: "" })}>OK</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmActionDialog({
  closeConfirmDialog,
  confirmDialog,
  dialogContentMdClass,
}) {
  return (
    <Dialog
      open={confirmDialog.open}
      onOpenChange={(isOpen) => {
        if (!isOpen) closeConfirmDialog();
      }}
    >
      <DialogContent className={dialogContentMdClass}>
        <DialogHeader>
          <DialogTitle>{confirmDialog.title || "Confirm action"}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 text-sm text-slate-700">{confirmDialog.message}</div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="destructive"
            onClick={() => {
              const action = confirmDialog.onConfirm;
              closeConfirmDialog();
              if (typeof action === "function") action();
            }}
          >
            {confirmDialog.confirmLabel || "Confirm"}
          </Button>
          <Button variant="secondary" onClick={closeConfirmDialog}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ReleaseNotesDialog({
  closeReleaseNotesDialog,
  currentReleaseHistory,
  desktopUpdateState,
  dialogContentLgClass,
  releaseNotesDialog,
  releaseNotesDialogDateLabel,
  releaseNotesDialogEntry,
  releaseNotesDialogLines,
  releaseNotesDialogSummary,
  releaseNotesDialogTitle,
  releaseNotesDialogVersion,
}) {
  return (
    <Dialog
      open={releaseNotesDialog.open}
      onOpenChange={(isOpen) => {
        if (!isOpen) closeReleaseNotesDialog();
      }}
    >
      <DialogContent className={dialogContentLgClass}>
        <DialogHeader>
          <DialogTitle>{releaseNotesDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-slate-700">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="font-medium text-slate-900">
              {releaseNotesDialogEntry?.title || (releaseNotesDialogVersion ? (`Version ${releaseNotesDialogVersion}`) : "Release notes")}
            </div>
            {releaseNotesDialogDateLabel && <div className="mt-1 text-xs text-slate-500">Release date: {releaseNotesDialogDateLabel}</div>}
            {releaseNotesDialogSummary && <div className="mt-2 text-sm text-slate-600">{releaseNotesDialogSummary}</div>}
          </div>
          {releaseNotesDialogLines.length > 0 ? (
            <div className="rounded-md border border-slate-200 bg-white p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">What changed</div>
              <div className="mt-2 space-y-2">
                {releaseNotesDialogLines.map((line) => (
                  <div key={`${releaseNotesDialogVersion}-${line}`} className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
              No detailed notes were bundled for this version yet.
            </div>
          )}
          {currentReleaseHistory.length > 0 && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Recent versions with in-app notes</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {currentReleaseHistory.map((entry) => (
                  <Badge key={`release-history-${entry.version}`} variant="secondary">v{entry.version}</Badge>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {desktopUpdateState.releaseNotesUrl && releaseNotesDialog.mode === "update" && (
              <a
                href={desktopUpdateState.releaseNotesUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded border px-3 py-1.5 text-sm text-blue-700 hover:underline"
              >
                Open GitHub release
              </a>
            )}
            <Button variant="secondary" onClick={closeReleaseNotesDialog}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
