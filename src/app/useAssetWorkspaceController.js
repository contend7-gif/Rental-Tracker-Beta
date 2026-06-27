import { useEffect } from "react";
import { buildAssetDraftFromTransaction } from "../features/assets/assetReview.js";
import { buildAssetDraftFromWorkOrder } from "../features/maintenance/maintenanceReview.js";
import {
  defaultLifeForAssetType,
  normalizeBonusRate,
} from "./accountingShared.js";

export function useAssetWorkspaceController({
  actions,
  appSettings,
  assetDraft,
  assetEditorDraft,
  documents,
  openConfirmDialog,
  openTransaction,
  prefetchDialog,
  properties,
  propertyFilter,
  requirePermission,
  setAssetDraft,
  setAssetEditorDraft,
  setAssetEditorOpen,
  setNotice,
  setView,
  todayIso,
  transactionById,
  workOrderById,
}) {
  useEffect(() => {
    if (!assetDraft.propertyId && properties[0]?.id) {
      setAssetDraft((prev) => ({ ...prev, propertyId: properties[0].id }));
    }
  }, [assetDraft.propertyId, properties, setAssetDraft]);

  const resetAssetDraft = (propertyId) => {
    setAssetDraft((prev) => ({
      ...prev,
      propertyId: propertyId || prev.propertyId || properties[0]?.id || "",
      unit: "Shared",
      description: "",
      type: "Capital Improvement",
      placedInService: todayIso,
      cost: "",
      landValue: "",
      basis: "",
      life: String(defaultLifeForAssetType("Capital Improvement")),
      bonusElected: "No",
      bonusRate: "1",
      sourceTransactionId: "",
      sourceWorkOrderId: "",
      sourceDocumentIds: [],
      assetReviewChecked: false,
      assetReviewNotes: "",
      createdFrom: "manual",
    }));
  };

  const buildAssetPayloadFromDraft = (draft, idOverride) => {
    const propertyId = draft.propertyId || properties[0]?.id;
    if (!propertyId || !draft.description.trim()) return null;

    const cost = Number(draft.cost || 0);
    const landValue = Number(draft.landValue || 0);
    const isBuilding = draft.type === "Residential Building";
    const computedBasis = isBuilding ? Math.max(cost - landValue, 0) : Number(draft.basis || cost);
    const life = Number(draft.life || defaultLifeForAssetType(draft.type));
    const bonusEligible = life <= 20 && !isBuilding;

    return {
      id: idOverride || "a" + Date.now(),
      propertyId,
      unit: draft.unit || "Shared",
      description: draft.description.trim(),
      type: draft.type,
      placedInService: draft.placedInService,
      cost,
      landValue: isBuilding ? landValue : 0,
      basis: computedBasis,
      life,
      bonusEligible,
      bonusElected: bonusEligible ? draft.bonusElected === "Yes" : false,
      bonusRate: bonusEligible ? normalizeBonusRate(draft.bonusRate) : 0,
      currentYearDep: computedBasis / life,
      sourceTransactionId: String(draft.sourceTransactionId || "").trim() || undefined,
      sourceTransactionIds: String(draft.sourceTransactionId || "").trim() ? [String(draft.sourceTransactionId).trim()] : undefined,
      sourceWorkOrderId: String(draft.sourceWorkOrderId || "").trim() || undefined,
      sourceDocumentIds: Array.isArray(draft.sourceDocumentIds) ? draft.sourceDocumentIds : [],
      assetReviewChecked: Boolean(draft.assetReviewChecked),
      assetReviewNotes: String(draft.assetReviewNotes || "").trim(),
      createdFrom: draft.createdFrom || "manual",
    };
  };

  const saveAsset = () => {
    if (!requirePermission("create_edit_records", "This access profile cannot save assets.")) return;
    const payload = buildAssetPayloadFromDraft(assetDraft);
    if (!payload) {
      setNotice("Asset description and property are required.");
      return;
    }

    actions.addOrUpdateAsset(payload);
    if (payload.sourceWorkOrderId) {
      actions.linkWorkOrderAsset(payload.sourceWorkOrderId, payload.id);
    }
    setNotice("Asset added.");
    resetAssetDraft(payload.propertyId);
  };

  const openAssetEditor = (asset) => {
    prefetchDialog("assetEditor");
    setAssetEditorDraft({
      id: asset.id,
      propertyId: asset.propertyId,
      unit: asset.unit,
      description: asset.description,
      type: asset.type,
      placedInService: asset.placedInService,
      cost: String(asset.cost || ""),
      landValue: String(asset.landValue || ""),
      basis: String(asset.basis || ""),
      life: String(asset.life || defaultLifeForAssetType(asset.type)),
      bonusElected: asset.bonusElected ? "Yes" : "No",
      bonusRate: String(asset.bonusRate || 0),
      sourceTransactionId: asset.sourceTransactionId || asset.sourceTransactionIds?.[0] || "",
      sourceWorkOrderId: asset.sourceWorkOrderId || "",
      sourceDocumentIds: asset.sourceDocumentIds || [],
      assetReviewChecked: Boolean(asset.assetReviewChecked),
      assetReviewNotes: asset.assetReviewNotes || "",
      createdFrom: asset.createdFrom || "manual",
    });
    setAssetEditorOpen(true);
  };

  const openAssetSourceTransaction = (assetOrId) => {
    const sourceId = typeof assetOrId === "string" ? assetOrId : (assetOrId?.sourceTransactionId || assetOrId?.sourceTransactionIds?.[0]);
    const transaction = transactionById[sourceId];
    if (!transaction) {
      setNotice("Source transaction was not found.");
      return;
    }
    openTransaction(transaction, "assets", false);
  };

  const openAssetSourceWorkOrder = (assetOrId) => {
    const sourceId = typeof assetOrId === "string" ? assetOrId : assetOrId?.sourceWorkOrderId;
    const workOrder = workOrderById[sourceId];
    if (!workOrder) {
      setNotice("Source work order was not found.");
      return;
    }
    setView("maintenance");
    setNotice(`Source work order: ${workOrder.title}.`);
  };

  const startCreateAssetFromTransaction = (transaction) => {
    if (!transaction) return;
    if (!requirePermission("create_edit_records", "This access profile cannot create assets.")) return;
    prefetchDialog("assetEditor");
    setAssetEditorDraft(buildAssetDraftFromTransaction(transaction, {
      documents,
      defaultLifeForAssetType,
    }));
    setAssetEditorOpen(true);
  };

  const startCreateAssetFromWorkOrder = (workOrder) => {
    if (!workOrder) return;
    if (!requirePermission("create_edit_records", "This access profile cannot create assets.")) return;
    prefetchDialog("assetEditor");
    setAssetEditorDraft(buildAssetDraftFromWorkOrder(workOrder, {
      documents,
      defaultLifeForAssetType,
      todayIso,
    }));
    setAssetEditorOpen(true);
  };

  const markTransactionCapitalImprovement = (transactionId, isCapitalImprovement) => {
    if (!requirePermission("create_edit_records", "This access profile cannot update transactions.")) return;
    actions.markTransactionCapitalImprovement(transactionId, isCapitalImprovement);
    setNotice(isCapitalImprovement ? "Marked transaction as a capital improvement." : "Marked transaction as repair / not capitalized.");
  };

  const startAddAsset = () => {
    prefetchDialog("assetEditor");
    const propertyId = propertyFilter === "all" ? (assetDraft.propertyId || properties[0]?.id || "") : propertyFilter;
    setAssetEditorDraft({
      propertyId,
      unit: "Shared",
      description: "",
      type: "Capital Improvement",
      placedInService: todayIso,
      cost: "",
      landValue: "",
      basis: "",
      life: String(defaultLifeForAssetType("Capital Improvement")),
      bonusElected: "No",
      bonusRate: "1",
      sourceTransactionId: "",
      sourceWorkOrderId: "",
      sourceDocumentIds: [],
      assetReviewChecked: false,
      assetReviewNotes: "",
      createdFrom: "manual",
    });
    setAssetEditorOpen(true);
  };

  const saveEditedAsset = () => {
    if (!assetEditorDraft) return;
    const payload = buildAssetPayloadFromDraft(assetEditorDraft, assetEditorDraft.id);
    if (!payload) {
      setNotice("Asset description and property are required.");
      return;
    }

    actions.addOrUpdateAsset(payload);
    if (payload.sourceWorkOrderId) {
      actions.linkWorkOrderAsset(payload.sourceWorkOrderId, payload.id);
    }
    if (payload.sourceTransactionId) {
      const sourceTransaction = transactionById[payload.sourceTransactionId];
      if (sourceTransaction && !sourceTransaction.capitalImprovement) {
        actions.markTransactionCapitalImprovement(payload.sourceTransactionId, true);
      }
    }
    setNotice(assetEditorDraft.id ? "Asset updated." : "Asset added.");
    setAssetEditorOpen(false);
    setAssetEditorDraft(null);
    resetAssetDraft(payload.propertyId);
  };

  const deleteAsset = () => {
    if (!requirePermission("delete_records", "Admin access is required to delete assets.")) return;
    if (!assetEditorDraft?.id) return;
    const runDelete = () => {
      actions.deleteAsset(assetEditorDraft.id);
      setAssetEditorOpen(false);
      setAssetEditorDraft(null);
      setNotice("Asset deleted.");
    };
    if (!appSettings.confirmDestructiveActions) {
      runDelete();
      return;
    }
    openConfirmDialog({
      title: "Delete asset?",
      message: `Delete asset "${assetEditorDraft.description}"? This cannot be undone.`,
      confirmLabel: "Delete asset",
      onConfirm: runDelete,
    });
  };

  return {
    deleteAsset,
    markTransactionCapitalImprovement,
    openAssetEditor,
    openAssetSourceTransaction,
    openAssetSourceWorkOrder,
    saveAsset,
    saveEditedAsset,
    startAddAsset,
    startCreateAssetFromTransaction,
    startCreateAssetFromWorkOrder,
  };
}
