import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { DialogLoadFallback } from "../shared/CommonDialogs.jsx";
import { field } from "../shared/uiHelpers.jsx";
import { selectableProperties } from "../../domain/propertyLifecycle.js";
import { getAssetReadiness, getAssetReviewIssues } from "./assetReview.js";

export function AssetEditorDialog({
  assetEditorDraft,
  assetEditorOpen,
  assetReviewContext,
  currency,
  defaultLifeForAssetType,
  deleteAsset,
  dialogContentLgClass,
  openAssetSourceTransaction,
  openAssetSourceWorkOrder,
  properties,
  saveEditedAsset,
  setAssetEditorDraft,
  setAssetEditorOpen,
  transactionById,
  workOrderById,
  units,
}) {
  const propertyOptions = selectableProperties(properties, assetEditorDraft?.propertyId);
  const draftForReview = assetEditorDraft ? {
    ...assetEditorDraft,
    cost: Number(assetEditorDraft.cost || 0),
    basis: assetEditorDraft.type === "Residential Building"
      ? Math.max(Number(assetEditorDraft.cost || 0) - Number(assetEditorDraft.landValue || 0), 0)
      : Number(assetEditorDraft.basis || assetEditorDraft.cost || 0),
    landValue: Number(assetEditorDraft.landValue || 0),
    life: Number(assetEditorDraft.life || defaultLifeForAssetType(assetEditorDraft.type)),
    bonusElected: assetEditorDraft.bonusElected === "Yes",
    bonusRate: Number(assetEditorDraft.bonusRate || 0),
  } : null;
  const sourceTransaction = assetEditorDraft?.sourceTransactionId ? transactionById?.[assetEditorDraft.sourceTransactionId] : null;
  const sourceWorkOrder = assetEditorDraft?.sourceWorkOrderId ? workOrderById?.[assetEditorDraft.sourceWorkOrderId] : null;
  const reviewIssues = draftForReview ? getAssetReviewIssues(draftForReview, assetReviewContext || {}) : [];
  const readiness = draftForReview ? getAssetReadiness(draftForReview, assetReviewContext || {}) : null;

  return (
    <Dialog open={Boolean(assetEditorOpen || assetEditorDraft)} onOpenChange={(isOpen) => { setAssetEditorOpen(isOpen); if (!isOpen) setAssetEditorDraft(null); }}>
      <DialogContent className={dialogContentLgClass}>
        {!assetEditorDraft ? (
          <DialogLoadFallback message="We could not load this asset editor. Close and try opening it again." onClose={() => { setAssetEditorOpen(false); setAssetEditorDraft(null); }} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{assetEditorDraft?.id ? "Edit Asset" : "Add Asset"}</DialogTitle>
            </DialogHeader>
            <div className="mt-2 rounded border border-blue-200 bg-blue-50/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-slate-900">Asset readiness</div>
                  <div className="mt-1 text-xs text-slate-600">Warnings are review prompts and will not block saving.</div>
                </div>
                <Badge variant="secondary" className={readiness?.key === "ready" ? "!bg-emerald-100 !text-emerald-700" : readiness?.key === "not_current_year" ? "" : "!bg-amber-100 !text-amber-800"}>
                  {readiness?.label || "Review"}
                </Badge>
              </div>
              {reviewIssues.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {reviewIssues.map((issue) => (
                    <span key={`asset-editor-${issue.key}`} title={issue.help} className="rounded-full border border-blue-100 bg-white px-2 py-0.5 text-[11px] text-slate-700">
                      {issue.label}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-xs text-emerald-700">No asset warnings from the current review checks.</div>
              )}
              {sourceTransaction ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span>Source txn: {sourceTransaction.date} | {sourceTransaction.description || sourceTransaction.vendor || sourceTransaction.category} | {currency(sourceTransaction.amount)}</span>
                  <Button size="sm" variant="secondary" onClick={() => openAssetSourceTransaction(assetEditorDraft.sourceTransactionId)}>Open transaction</Button>
                </div>
              ) : assetEditorDraft.sourceTransactionId ? (
                <div className="mt-2 text-xs text-amber-700">Source transaction {assetEditorDraft.sourceTransactionId} was not found.</div>
              ) : null}
              {sourceWorkOrder ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span>Source work order: {sourceWorkOrder.reportedOn || sourceWorkOrder.completedAt || ""} | {sourceWorkOrder.title}</span>
                  <Button size="sm" variant="secondary" onClick={() => openAssetSourceWorkOrder(assetEditorDraft.sourceWorkOrderId)}>Open work order</Button>
                </div>
              ) : assetEditorDraft.sourceWorkOrderId ? (
                <div className="mt-2 text-xs text-amber-700">Source work order {assetEditorDraft.sourceWorkOrderId} was not found.</div>
              ) : null}
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {field(
                "Property",
                <Select value={assetEditorDraft.propertyId} onValueChange={(value) => setAssetEditorDraft({ ...assetEditorDraft, propertyId: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {propertyOptions.map((property) => <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>)}
                  </SelectContent>
                </Select>,
              )}
              {field(
                "Unit",
                <Select value={assetEditorDraft.unit} onValueChange={(value) => setAssetEditorDraft({ ...assetEditorDraft, unit: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Shared">Shared</SelectItem>
                    {units.filter((unit) => unit.propertyId === assetEditorDraft.propertyId).map((unit) => <SelectItem key={unit.id} value={unit.name}>{unit.name}</SelectItem>)}
                  </SelectContent>
                </Select>,
              )}
              {field(
                "Asset type",
                <Select value={assetEditorDraft.type} onValueChange={(value) => setAssetEditorDraft({ ...assetEditorDraft, type: value, life: String(defaultLifeForAssetType(value)), unit: value === "Residential Building" ? "Shared" : assetEditorDraft.unit })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Residential Building">Residential Building</SelectItem>
                    <SelectItem value="Capital Improvement">Capital Improvement</SelectItem>
                    <SelectItem value="Appliance">Appliance</SelectItem>
                    <SelectItem value="Furniture">Furniture</SelectItem>
                    <SelectItem value="Equipment">Equipment</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>,
              )}
              {field("Description", <Input value={assetEditorDraft.description} onChange={(e) => setAssetEditorDraft({ ...assetEditorDraft, description: e.target.value })} />)}
              {field("Placed in service", <Input type="date" value={assetEditorDraft.placedInService} onChange={(e) => setAssetEditorDraft({ ...assetEditorDraft, placedInService: e.target.value })} />)}
              {field("Cost / purchase price", <Input type="number" value={assetEditorDraft.cost} onChange={(e) => setAssetEditorDraft({ ...assetEditorDraft, cost: e.target.value })} />)}
              {assetEditorDraft.type === "Residential Building"
                ? field("Land value", <Input type="number" value={assetEditorDraft.landValue} onChange={(e) => setAssetEditorDraft({ ...assetEditorDraft, landValue: e.target.value })} />)
                : field("Depreciable basis", <Input type="number" value={assetEditorDraft.basis} onChange={(e) => setAssetEditorDraft({ ...assetEditorDraft, basis: e.target.value })} />)}
              {field("Recovery life (years)", <Input type="number" value={assetEditorDraft.life} onChange={(e) => setAssetEditorDraft({ ...assetEditorDraft, life: e.target.value })} />)}
              {field(
                "Bonus depreciation",
                <Select
                  value={Number(assetEditorDraft.life || 0) > 20 || assetEditorDraft.type === "Residential Building" ? "No" : assetEditorDraft.bonusElected}
                  onValueChange={(value) => setAssetEditorDraft({ ...assetEditorDraft, bonusElected: Number(assetEditorDraft.life || 0) > 20 || assetEditorDraft.type === "Residential Building" ? "No" : value })}
                  disabled={Number(assetEditorDraft.life || 0) > 20 || assetEditorDraft.type === "Residential Building"}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No">No</SelectItem>
                    {!(Number(assetEditorDraft.life || 0) > 20 || assetEditorDraft.type === "Residential Building") && <SelectItem value="Yes">Yes</SelectItem>}
                  </SelectContent>
                </Select>,
              )}
              {field("Bonus rate (% or decimal)", <Input type="number" step="0.01" value={assetEditorDraft.bonusRate} onChange={(e) => setAssetEditorDraft({ ...assetEditorDraft, bonusRate: e.target.value })} />)}
              {field("Asset reviewed", (
                <label className="flex items-center gap-2 rounded border border-slate-200 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(assetEditorDraft.assetReviewChecked)}
                    onChange={(e) => setAssetEditorDraft({ ...assetEditorDraft, assetReviewChecked: e.target.checked })}
                  />
                  <span>Ready after manual review</span>
                </label>
              ))}
              {field("Review notes", <Input value={assetEditorDraft.assetReviewNotes || ""} onChange={(e) => setAssetEditorDraft({ ...assetEditorDraft, assetReviewNotes: e.target.value })} />)}
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={saveEditedAsset}>{assetEditorDraft?.id ? "Save changes" : "Add asset"}</Button>
              {assetEditorDraft?.id && <Button variant="destructive" onClick={deleteAsset}>Delete</Button>}
              <Button variant="secondary" onClick={() => { setAssetEditorOpen(false); setAssetEditorDraft(null); }}>Cancel</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
