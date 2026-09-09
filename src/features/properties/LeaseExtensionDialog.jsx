import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { useState } from "react";
import { leaseExtensionCoverageLabel } from "../../domain/leaseExtensions.ts";

function field(label, control) {
  return <label className="space-y-1 text-xs text-slate-700"><span className="block font-medium">{label}</span>{control}</label>;
}

export function LeaseExtensionDialog({
  currency,
  extensionPdfInputRef,
  lease,
  draft,
  document,
  preview,
  open,
  onClose,
  onChange,
  onPdfPicker,
  onPdfInputChange,
  onSave,
  onCancelExtension,
  onEditExtension,
}) {
  const [saving, setSaving] = useState(false);
  if (!lease || !draft) return null;
  const extensionRows = lease.extensions || [];
  const previewExtension = preview?.extension;
  const outstanding = previewExtension ? Math.max(0, Number(previewExtension.rentAmount || 0) - Number(previewExtension.amountPaid || 0)) : 0;
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl rounded-xl border bg-white shadow-lg">
        <DialogHeader>
          <DialogTitle>Extend lease â€” {lease.tenantName || lease.unit}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-950">
            <div className="font-semibold">Original agreement stays unchanged</div>
            <div className="mt-1">The extension is recorded as a separate fixed-term period and linked charge/payment. The actual move-out date remains separate.</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {!lease.originalTerm && field("Original agreement end (before any manual extension)", <Input type="date" value={draft.originalEndDate || lease.endDate} onChange={(event) => onChange({ ...draft, originalEndDate: event.target.value, startDate: event.target.value })} />)}
            {field("Extension starts", <Input type="date" value={draft.startDate || ""} onChange={(event) => onChange({ ...draft, startDate: event.target.value })} />)}
            {field("Extension ends", <Input type="date" value={draft.endDate || ""} onChange={(event) => onChange({ ...draft, endDate: event.target.value })} />)}
            {field("Expected departure time (optional)", <Input type="time" value={draft.endTime || ""} onChange={(event) => onChange({ ...draft, endTime: event.target.value })} />)}
            {field("Additional fixed-term rent", <Input type="number" min="0" step="0.01" value={draft.rentAmount || ""} onChange={(event) => onChange({ ...draft, rentAmount: event.target.value })} placeholder="350.00" />)}
            {field("Total amount received", <Input type="number" min="0" step="0.01" value={draft.amountPaid || ""} onChange={(event) => onChange({ ...draft, amountPaid: event.target.value })} placeholder="0.00" />)}
            {field("Actual payment-received date (latest receipt)", <Input type="date" value={draft.paymentReceivedDate || ""} onChange={(event) => onChange({ ...draft, paymentReceivedDate: event.target.value })} />)}
            {field("Signed date (optional)", <Input type="date" value={draft.signedDate || ""} onChange={(event) => onChange({ ...draft, signedDate: event.target.value })} />)}
          </div>
          <p className="text-xs text-slate-500">For another payment, increase the total received and enter the new receipt date. Earlier receipts keep their dates. Editing an existing amount is recorded as a correction.</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            {field("Notes (optional)", <Input value={draft.notes || ""} onChange={(event) => onChange({ ...draft, notes: event.target.value })} placeholder="Signed extension, noon departure, etc." />)}
            <div>
              <input ref={extensionPdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={onPdfInputChange} />
              <Button variant="secondary" onClick={onPdfPicker}>{document?.name || "Attach signed PDF"}</Button>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="font-semibold text-slate-900">Save preview</div>
            {preview?.existingEntryNotice && <div className="mt-2"><p>{preview.existingEntryNotice}</p><label className="flex gap-2"><input type="checkbox" checked={Boolean(draft.reuseExistingEntries)} onChange={(event) => onChange({ ...draft, reuseExistingEntries: event.target.checked })} />Use these existing entries for this extension</label></div>}
            {!preview?.ok ? <div className="mt-1 text-rose-700">{preview?.message || "Complete the extension fields to preview the save."}</div> : (
              <div className="mt-2 space-y-1 text-xs text-slate-700">
                <div><span className="font-medium">Coverage:</span> {leaseExtensionCoverageLabel(previewExtension)}</div>
                <div><span className="font-medium">Payment status:</span> {previewExtension.paymentStatus.replaceAll("_", " ")}</div>
                <div><span className="font-medium">Charge:</span> {currency(previewExtension.rentAmount)} on {preview.charge?.date}</div>
                <div><span className="font-medium">Payment:</span> {preview.payment ? `${currency(preview.payment.amount)} received ${preview.payment.date}` : "No payment entry"}</div>
                <div><span className="font-medium">Remaining balance:</span> {currency(outstanding)}</div>
                <div><span className="font-medium">Combined lease rent:</span> {currency(preview.combinedRent)}</div>
                {document ? <div><span className="font-medium">Document:</span> {document.name}</div> : null}
              </div>
            )}
          </div>
          {extensionRows.length > 0 && (
            <div className="rounded-lg border border-slate-200 p-3 text-xs">
              <div className="font-semibold text-slate-900">Recorded extensions</div>
              <div className="mt-2 space-y-1">{extensionRows.map((extension) => <div key={extension.id} className="flex items-center justify-between gap-2"><span>{leaseExtensionCoverageLabel(extension)} Â· {currency(extension.rentAmount)}</span><span className="flex items-center gap-2 text-slate-500">{extension.canceledAt ? "Canceled" : extension.paymentStatus.replaceAll("_", " ")}<Button disabled={Boolean(extension.canceledAt)} size="sm" variant="ghost" onClick={() => onEditExtension(extension)}>Edit</Button><Button size="sm" variant="ghost" disabled={Boolean(extension.canceledAt)} onClick={() => onCancelExtension(extension)}>Cancel</Button></span></div>)}</div>
            </div>
          )}
        </div>
        {(lease.extensionRevisions || []).length > 0 && <details className="text-xs"><summary>Correction history ({lease.extensionRevisions.length})</summary>{lease.extensionRevisions.map((revision, index) => <p key={index}>{revision.recordedAt.slice(0, 10)}: {leaseExtensionCoverageLabel(revision.extension)}, rent {currency(revision.extension.rentAmount)}, received {currency(revision.extension.amountPaid)} on {revision.extension.paymentReceivedDate || "—"}</p>)}</details>}
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={async () => { setSaving(true); try { await onSave(); } finally { setSaving(false); } }} disabled={saving || !preview?.ok}>{saving ? "Saving to desktop…" : "Save extension"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
