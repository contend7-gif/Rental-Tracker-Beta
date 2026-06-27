import { Archive, CalendarRange, CheckCircle2, FilePlus2, Hammer, Landmark, Trash2 } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { DialogLoadFallback } from "../shared/CommonDialogs.jsx";
import { readinessBadgeClass } from "../shared/auditBadges.js";
import {
  transactionCategoryStatusLabel,
  transactionReconciliationStatusLabel,
  transactionScheduleLabel,
  transactionSupportStatusLabel,
  transactionTaxStatusLabel,
} from "./transactionPresentation.js";

export function BankImportReviewDialog({
  applyBankImportVendorMemoryToDraft,
  bankImportReviewDrafts,
  bankImportReviewRows,
  buildBankImportReviewDraft,
  categories,
  currency,
  dialogContentLgClass,
  getBankImportRowVendorMemory,
  importReviewedBankRows,
  open,
  properties,
  setBankImportReviewOpen,
  typeOptions,
  units,
  updateBankImportReviewDraft,
}) {
  return (
    <Dialog open={open} onOpenChange={setBankImportReviewOpen}>
      <DialogContent className={dialogContentLgClass}>
        <DialogHeader>
          <DialogTitle>Review Unmatched Bank Rows</DialogTitle>
        </DialogHeader>
        <div className="mt-2 text-sm text-slate-600">
          Review each row before import. Type/category defaults are suggested and can be adjusted.
        </div>

        {bankImportReviewRows.length === 0 ? (
          <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No unmatched rows remaining.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {bankImportReviewRows.map((row) => {
              const draft = bankImportReviewDrafts[row.id] || buildBankImportReviewDraft(row);
              const categoryOptions = categories[draft.type] || [];
              const rowVendorMemory = getBankImportRowVendorMemory?.(row);
              const unitOptions = ["Shared", ...units.filter((unit) => unit.propertyId === draft.propertyId).map((unit) => unit.name)];
              return (
                <div key={`bank-review-${row.id}`} className="rounded border border-slate-200 bg-slate-50/60 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-slate-500">{row.date} | Source line {row.sourceLine}</div>
                    <div className={`text-sm font-semibold ${row.amount < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                      {row.amount < 0 ? "-" : "+"}{currency(Math.abs(row.amount))}
                    </div>
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-4">
                    <div>
                      <Label className="text-xs text-slate-600">Type</Label>
                      <Select value={draft.type} onValueChange={(value) => updateBankImportReviewDraft(row.id, { type: value })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {typeOptions.map((value) => (
                            <SelectItem key={`bank-review-type-${row.id}-${value}`} value={value}>{value}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Category</Label>
                      <Select value={draft.category} onValueChange={(value) => updateBankImportReviewDraft(row.id, { category: value })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {categoryOptions.map((value) => (
                            <SelectItem key={`bank-review-category-${row.id}-${value}`} value={value}>{value}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Property</Label>
                      <Select value={draft.propertyId || "none"} onValueChange={(value) => updateBankImportReviewDraft(row.id, { propertyId: value === "none" ? "" : value, unit: "Shared" })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select property</SelectItem>
                          {properties.map((property) => (
                            <SelectItem key={`bank-review-property-${row.id}-${property.id}`} value={property.id}>{property.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600">Unit</Label>
                      <Select value={draft.unit || "Shared"} onValueChange={(value) => updateBankImportReviewDraft(row.id, { unit: value })}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from(new Set(unitOptions)).map((unitName) => (
                            <SelectItem key={`bank-review-unit-${row.id}-${unitName}`} value={unitName}>{unitName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs text-slate-600">Description</Label>
                      <Input className="mt-1" value={draft.description} onChange={(event) => updateBankImportReviewDraft(row.id, { description: event.target.value })} />
                    </div>
                  </div>
                  {rowVendorMemory ? (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded border border-blue-100 bg-blue-50 px-2 py-1 text-xs text-blue-800">
                      <span>
                        Vendor memory: {rowVendorMemory.label} usually posts as {rowVendorMemory.category} for Unit {rowVendorMemory.unit || "Shared"}.
                      </span>
                      <Button size="sm" variant="secondary" onClick={() => applyBankImportVendorMemoryToDraft(row.id)}>
                        Apply memory
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-slate-500">Suggestion source: bank description rules.</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <Button onClick={importReviewedBankRows} disabled={bankImportReviewRows.length === 0}>Import reviewed rows</Button>
          <Button variant="secondary" onClick={() => setBankImportReviewOpen(false)}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function statusBadgeClass(tone) {
  if (tone === "ready") return "!bg-emerald-100 !text-emerald-700";
  if (tone === "warning") return "!bg-amber-100 !text-amber-800";
  if (tone === "info") return "!bg-blue-100 !text-blue-700";
  return "!bg-slate-100 !text-slate-700";
}

function statusCardTone(label, warningLabels = []) {
  return warningLabels.includes(label) ? "warning" : "ready";
}

export function TransactionDetailsDialog({
  canDeleteRecords,
  canReconcileRecords,
  currency,
  dialogContentLgClass,
  editReturnView,
  handleClearSelectedTxnOwnerUseOverride,
  handleDeleteSelectedTxn,
  handleDuplicateSelectedTxn,
  handleEditSelectedTxn,
  handleCreateAssetFromSelectedTxn,
  handleMarkSelectedTxnCapitalImprovement,
  handleMarkSelectedTxnTaxReviewed,
  handleMarkSelectedTxnRepair,
  handleToggleSelectedTxnReconciled,
  handleToggleSelectedTxnTaxChecked,
  handleUseSelectedTxnDateAsServicePeriod,
  handleVoidSelectedTxn,
  isTaxReviewRelevantTransaction,
  onTransactionInlineAttachmentChange,
  open,
  openDocumentPreview,
  openTransactionInlineAttachmentPicker,
  propertyNameById,
  selectedTransactionDocuments,
  selectedTxn,
  selectedTxnReview,
  selectedTxnReviewFocusKey,
  selectedTxnLinkedWorkOrder,
  selectedTxnReconcileWarning,
  selectedTxnReconcileWarningText,
  selectedTxnToggleReconcileDisabled,
  setSelectedTxn,
  txnInlineAttachmentInputRef,
  view,
  confirmAndDeleteDocument,
}) {
  const selectedIssueKeys = new Set((selectedTxnReview?.issues || []).map((issue) => issue.key));
  const selectedTxnIsTaxRelevant = selectedTxn ? isTaxReviewRelevantTransaction(selectedTxn) : false;
  const selectedTxnDocumentCount = selectedTransactionDocuments?.length || 0;
  const selectedTxnReconciliationLabel = selectedTxn ? transactionReconciliationStatusLabel(selectedTxn) : "";
  const selectedTxnSupportLabel = selectedTxn
    ? transactionSupportStatusLabel(selectedTxn, {
        missingReceipt: selectedIssueKeys.has("missing_receipt"),
        documentCount: selectedTxnDocumentCount,
      })
    : "";
  const selectedTxnTaxLabel = selectedTxn ? transactionTaxStatusLabel(selectedTxn, selectedTxnReview?.readiness, selectedTxnIsTaxRelevant) : "";
  const selectedTxnCategoryLabel = selectedTxn ? transactionCategoryStatusLabel(selectedTxn) : "";
  const selectedTxnScheduleLabel = selectedTxn ? transactionScheduleLabel(selectedTxn) : "";
  const selectedTxnStatusCards = selectedTxn
    ? [
        {
          key: "source",
          label: "Source",
          value: selectedTxnReconciliationLabel,
          helper: selectedTxn.bankImportId ? "Imported bank row" : "Manual ledger entry",
          tone: statusCardTone(selectedTxnReconciliationLabel, ["Needs bank match"]),
        },
        {
          key: "support",
          label: "Support",
          value: selectedTxnSupportLabel,
          helper: selectedTxnDocumentCount > 0 ? `${selectedTxnDocumentCount} file${selectedTxnDocumentCount === 1 ? "" : "s"} attached` : "No linked files",
          tone: statusCardTone(selectedTxnSupportLabel, ["Receipt missing"]),
        },
        {
          key: "tax",
          label: "Tax",
          value: selectedTxnTaxLabel,
          helper: selectedTxnScheduleLabel || (selectedTxnIsTaxRelevant ? "Tax relevant" : "Ledger only"),
          tone: statusCardTone(selectedTxnTaxLabel, ["Needs tax review", "Review open"]),
        },
        {
          key: "category",
          label: "Category",
          value: selectedTxnCategoryLabel,
          helper: selectedTxn.type || "Transaction",
          tone: statusCardTone(selectedTxnCategoryLabel, ["Uncategorized", "Other", "Other expenses", "Other income"]),
        },
      ]
    : [];
  const issueActions = (issue) => {
    if (issue.key === "missing_receipt") return [{ key: "attach", label: "Attach document", icon: FilePlus2, onClick: openTransactionInlineAttachmentPicker }];
    if (issue.key === "missing_service_period") return [{ key: "period", label: "Use date as period", icon: CalendarRange, onClick: handleUseSelectedTxnDateAsServicePeriod }];
    if (issue.key === "owner_use_override") return [{ key: "owner-use", label: "Clear override", icon: CheckCircle2, onClick: handleClearSelectedTxnOwnerUseOverride }];
    if (issue.key === "possible_improvement") {
      return [
        { key: "repair", label: "Mark repair", icon: Hammer, onClick: handleMarkSelectedTxnRepair },
        { key: "capital", label: "Mark capital", icon: Landmark, onClick: handleMarkSelectedTxnCapitalImprovement },
      ];
    }
    if (issue.key === "capital_improvement_needs_asset") return [{ key: "asset", label: "Create asset", icon: Landmark, onClick: handleCreateAssetFromSelectedTxn, primary: true }];
    if (issue.key === "tax_open" || issue.key === "de_minimis_review") return [{ key: "tax", label: "Mark tax reviewed", icon: CheckCircle2, onClick: handleMarkSelectedTxnTaxReviewed }];
    if (issue.key === "unreconciled_import") return [{ key: "match", label: selectedTxn?.bankImportId ? "Mark bank matched" : "Mark accepted", icon: CheckCircle2, onClick: handleToggleSelectedTxnReconciled, disabled: !canReconcileRecords || selectedTxnToggleReconcileDisabled }];
    return [{ key: "edit", label: "Edit fields", icon: CheckCircle2, onClick: handleEditSelectedTxn }];
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) setSelectedTxn(null);
      }}
    >
      <DialogContent className={dialogContentLgClass}>
        {!selectedTxn ? (
          <DialogLoadFallback message="We could not load this transaction. Close and try opening it again." onClose={() => setSelectedTxn(null)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{selectedTxn.description}</DialogTitle>
            </DialogHeader>
            <div className="mt-2 text-sm text-slate-700">
              {selectedTxn.date} | {propertyNameById[selectedTxn.propertyId] || selectedTxn.propertyId} | Unit {selectedTxn.unit} | {selectedTxn.category}
            </div>
            <div className="mt-1 text-sm font-semibold">{currency(selectedTxn.amount)}</div>
            {selectedTxn.category === "Auto and travel" && Number(selectedTxn.mileageMiles || 0) > 0 ? (
              <div className="mt-1 text-xs text-slate-500">
                Mileage support: {Number(selectedTxn.mileageMiles || 0)} miles
                {Number(selectedTxn.mileageRate || 0) > 0 ? ` x ${currency(Number(selectedTxn.mileageRate || 0))}/mi` : ""}
              </div>
            ) : null}
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {selectedTxnStatusCards.map((card) => (
                <div key={`txn-status-${card.key}`} className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
                  <div className="text-[11px] font-medium uppercase text-slate-500">{card.label}</div>
                  <Badge variant="secondary" className={`mt-1 ${statusBadgeClass(card.tone)}`}>
                    {card.value}
                  </Badge>
                  <div className="mt-1 text-[11px] leading-4 text-slate-500">{card.helper}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded border border-blue-200 bg-blue-50/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-slate-900">Guided review</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {selectedTxnReview?.readiness?.key === "ready"
                      ? "This transaction is ready for Tax Center in the current review rules."
                      : "Clear the items below or edit the transaction fields before this feeds Tax Center cleanly."}
                  </div>
                </div>
                <Badge variant="secondary" className={readinessBadgeClass(selectedTxnReview?.readiness || "needs_review")}>
                  {selectedTxnReview?.readiness?.label || "Review"}
                </Badge>
              </div>
              {selectedTxnReview?.issues?.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {selectedTxnReview.issues.map((issue) => (
                    <div
                      key={`${selectedTxn.id}-detail-${issue.key}`}
                      className={`rounded border px-3 py-2 text-xs ${selectedTxnReviewFocusKey === issue.key ? "border-blue-300 bg-white" : "border-blue-100 bg-blue-50/40"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-slate-800">{issue.label}</div>
                          {issue.help ? <div className="mt-1 text-slate-600">{issue.help}</div> : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-1.5">
                          {issueActions(issue).map((action) => {
                            const ActionIcon = action.icon;
                            return (
                              <Button key={`${issue.key}-${action.key}`} size="sm" variant={action.primary ? "default" : "secondary"} className="h-7 gap-1 px-2 text-xs" disabled={action.disabled} onClick={action.onClick}>
                                <ActionIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                {action.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {selectedTxnReview?.issues?.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={handleMarkSelectedTxnTaxReviewed}>
                    Mark reviewed for tax
                  </Button>
                  {selectedTxnReview.issues.some((issue) => issue.key === "missing_service_period") ? (
                    <Button size="sm" variant="secondary" onClick={handleUseSelectedTxnDateAsServicePeriod}>
                      Use date as service period
                    </Button>
                  ) : null}
                  {selectedTxnReview.issues.some((issue) => issue.key === "owner_use_override") ? (
                    <Button size="sm" variant="secondary" onClick={handleClearSelectedTxnOwnerUseOverride}>
                      Clear owner-use override
                    </Button>
                  ) : null}
                  {selectedTxnReview.issues.some((issue) => issue.key === "missing_receipt") ? (
                    <Button size="sm" variant="secondary" onClick={openTransactionInlineAttachmentPicker}>
                      Attach document
                    </Button>
                  ) : null}
                  {selectedTxnReview.issues.some((issue) => issue.key === "possible_improvement" || issue.key === "capital_improvement_needs_asset") ? (
                    <>
                      {selectedTxnReview.issues.some((issue) => issue.key === "possible_improvement") ? (
                        <>
                          <Button size="sm" variant="secondary" onClick={handleMarkSelectedTxnRepair}>
                            Mark as repair
                          </Button>
                          <Button size="sm" variant="secondary" onClick={handleMarkSelectedTxnCapitalImprovement}>
                            Mark capital improvement
                          </Button>
                        </>
                      ) : null}
                      <Button size="sm" onClick={handleCreateAssetFromSelectedTxn}>
                        Create asset
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="mt-3 rounded border border-slate-200 p-3">
              <div className="text-sm font-medium">Receipts & files</div>
              <input ref={txnInlineAttachmentInputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={onTransactionInlineAttachmentChange} />
              <div className="mt-2">
                <Button size="sm" variant="secondary" onClick={openTransactionInlineAttachmentPicker}>Attach receipt/PDF</Button>
              </div>
              {selectedTransactionDocuments.length === 0 && <div className="mt-2 text-xs text-slate-500">No files attached to this transaction yet.</div>}
              {selectedTransactionDocuments.map((document) => (
                <div key={document.id} className="mt-2 flex items-center justify-between rounded border p-2 text-sm">
                  <span>{document.name}</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openDocumentPreview(document)}>View</Button>
                    <Button size="sm" variant="destructive" onClick={() => confirmAndDeleteDocument(document)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={handleEditSelectedTxn}>Edit</Button>
              <Button variant="secondary" onClick={handleDuplicateSelectedTxn}>Duplicate</Button>
              <Button
                variant="secondary"
                disabled={!canReconcileRecords || selectedTxnToggleReconcileDisabled}
                onClick={handleToggleSelectedTxnReconciled}
              >
                {selectedTxn.reconciled ? "Mark not accepted" : selectedTxn.bankImportId ? "Mark bank matched" : "Mark accepted"}
              </Button>
              {isTaxReviewRelevantTransaction(selectedTxn) && (
                <Button variant="secondary" onClick={handleToggleSelectedTxnTaxChecked}>
                  {selectedTxn.taxChecked ? "Mark tax unchecked" : "Mark tax checked"}
                </Button>
              )}
              {selectedTxnReview?.issues?.length > 0 ? (
                <Button variant="secondary" onClick={handleEditSelectedTxn}>
                  Review tax fields
                </Button>
              ) : null}
              <Button variant="secondary" onClick={handleVoidSelectedTxn}>
                <Archive className="mr-1 h-4 w-4" />
                Void
              </Button>
              <Button variant="destructive" onClick={handleDeleteSelectedTxn} disabled={!canDeleteRecords}>
                <Trash2 className="mr-1 h-4 w-4" />
                Delete
              </Button>
              <Button variant="secondary" onClick={() => setSelectedTxn(null)}>Close</Button>
            </div>
            {selectedTxnReconcileWarning && (
              <div className="mt-2 text-xs text-amber-700">
                Linked work order is {selectedTxnLinkedWorkOrder?.status}. {selectedTxnReconcileWarningText}
              </div>
            )}
            <div className="mt-2 text-xs text-slate-500">Void keeps a historical record. Delete permanently removes the transaction.</div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DeleteTransactionDialog({
  confirmDeleteTransaction,
  currency,
  dialogContentLgClass,
  open,
  setTxnToDelete,
  txnToDelete,
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) setTxnToDelete(null);
      }}
    >
      <DialogContent className={dialogContentLgClass}>
        {!txnToDelete ? (
          <DialogLoadFallback message="We could not load this delete confirmation. Close and try again." onClose={() => setTxnToDelete(null)} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Delete transaction?</DialogTitle>
            </DialogHeader>
            <div className="mt-2 text-sm text-slate-700">
              This will permanently remove <span className="font-medium">{txnToDelete.description}</span> ({txnToDelete.date}, {currency(txnToDelete.amount)}).
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="destructive" onClick={confirmDeleteTransaction}>
                Confirm delete
              </Button>
              <Button variant="secondary" onClick={() => setTxnToDelete(null)}>Cancel</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function TaxPrintDialog({
  dialogContentLgClass,
  formatPropertyLabel,
  formatUnitLabel,
  onPrint,
  open,
  properties,
  propertyFilter,
  setTaxPrintDialogOpen,
  setTaxPrintProperty,
  setTaxPrintScope,
  setTaxPrintUnit,
  taxPrintProperty,
  taxPrintScope,
  taxPrintUnit,
  taxPrintUnitOptions,
  unitFilter,
  yearFilter,
}) {
  return (
    <Dialog open={open} onOpenChange={setTaxPrintDialogOpen}>
      <DialogContent className={dialogContentLgClass}>
        <DialogHeader>
          <DialogTitle>Print Tax Report</DialogTitle>
        </DialogHeader>
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <Label>Print scope</Label>
            <Select value={taxPrintScope} onValueChange={setTaxPrintScope}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current selection</SelectItem>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="property_unit">By property/unit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {taxPrintScope === "property_unit" && (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Property</Label>
                <Select value={taxPrintProperty} onValueChange={setTaxPrintProperty}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All properties</SelectItem>
                    {properties.map((property) => <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unit</Label>
                <Select value={taxPrintUnit} onValueChange={setTaxPrintUnit}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {taxPrintUnitOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
            Printing year {yearFilter} | {formatPropertyLabel(taxPrintScope === "current" ? propertyFilter : taxPrintScope === "all" ? "all" : taxPrintProperty)} | {formatUnitLabel(taxPrintScope === "current" ? unitFilter : taxPrintScope === "all" ? "all" : taxPrintUnit)}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={onPrint}>Print</Button>
          <Button variant="secondary" onClick={() => setTaxPrintDialogOpen(false)}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
