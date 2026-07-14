import type { Asset, Transaction, WorkOrder } from "../models.ts";
import type { AppendActivityLog } from "./activityStore.ts";
import { normalizeWorkOrder } from "./maintenanceStore.ts";
import { normalizeStringArray } from "./storeUtils.ts";

type StateSetter<T> = (updater: T[] | ((previous: T[]) => T[])) => void;

export function normalizeAsset(asset: Asset): Asset {
  const basis = Number(asset.basis || 0);
  const life = Number(asset.life || 27.5);
  const sourceTransactionId = String(asset.sourceTransactionId || "").trim();
  const sourceTransactionIds = normalizeStringArray([
    sourceTransactionId,
    ...normalizeStringArray(asset.sourceTransactionIds),
  ]);
  const createdFrom = String(asset.createdFrom || "").trim();

  return {
    ...asset,
    unit: asset.unit || "Shared",
    placedInService: String(asset.placedInService || "").trim(),
    cost: Number(asset.cost || 0),
    basis,
    life,
    landValue: Number(asset.landValue || 0),
    bonusEligible: Boolean(asset.bonusEligible),
    bonusElected: Boolean(asset.bonusElected),
    bonusRate: Number(asset.bonusRate || 0),
    currentYearDep: life ? basis / life : 0,
    sourceTransactionId: sourceTransactionId || sourceTransactionIds[0] || undefined,
    sourceTransactionIds: sourceTransactionIds.length > 0 ? sourceTransactionIds : undefined,
    sourceWorkOrderId: String(asset.sourceWorkOrderId || "").trim() || undefined,
    sourceDocumentIds: normalizeStringArray(asset.sourceDocumentIds),
    assetReviewChecked: Boolean(asset.assetReviewChecked),
    assetReviewNotes: String(asset.assetReviewNotes || "").trim(),
    createdFrom: createdFrom === "transaction" || createdFrom === "document" || createdFrom === "maintenance" ? createdFrom : "manual",
  };
}

export function createAssetActions({
  getAssets,
  getTransactions,
  setAssets,
  setWorkOrders,
  appendActivityLog,
}: {
  getAssets: () => Asset[];
  getTransactions: () => Transaction[];
  setAssets: StateSetter<Asset>;
  setWorkOrders: StateSetter<WorkOrder>;
  appendActivityLog: AppendActivityLog;
}) {
  return {
    addOrUpdateAsset(asset: Asset) {
      const normalized = normalizeAsset(asset);
      const existsBefore = getAssets().some((item) => item.id === normalized.id);
      setAssets((previous) => {
        const exists = previous.some((item) => item.id === normalized.id);
        return exists
          ? previous.map((item) => item.id === normalized.id ? normalized : item)
          : [normalized, ...previous];
      });
      if (normalized.sourceWorkOrderId) {
        setWorkOrders((previous) => previous.map((workOrder) => workOrder.id === normalized.sourceWorkOrderId
          ? normalizeWorkOrder({ ...workOrder, assetId: normalized.id })
          : workOrder));
      }
      const sourceTransaction = normalized.sourceTransactionId
        ? getTransactions().find((transaction) => transaction.id === normalized.sourceTransactionId)
        : undefined;
      appendActivityLog({
        action: existsBefore ? "update" : "create",
        entityType: "asset",
        entityId: normalized.id,
        propertyId: normalized.propertyId,
        unit: normalized.unit,
        summary: !existsBefore && normalized.createdFrom === "transaction"
          ? "Asset created from transaction."
          : !existsBefore && normalized.createdFrom === "maintenance"
            ? "Asset created from work order."
            : existsBefore ? "Asset updated." : "Asset created.",
        details: sourceTransaction
          ? `${sourceTransaction.date} | ${sourceTransaction.description || sourceTransaction.vendor || sourceTransaction.category} | ${sourceTransaction.amount}`
          : normalized.sourceTransactionId
            ? `${normalized.description} | Source transaction ${normalized.sourceTransactionId}`
            : normalized.description,
      });
    },
    linkAssetToTransaction(assetId: string, transactionId: string) {
      const existingAsset = getAssets().find((asset) => asset.id === assetId);
      const sourceId = String(transactionId || "").trim();
      if (!existingAsset || !sourceId) return;
      const sourceIds = normalizeStringArray([existingAsset.sourceTransactionId, ...(existingAsset.sourceTransactionIds || []), sourceId]);
      const normalized = normalizeAsset({
        ...existingAsset,
        sourceTransactionId: existingAsset.sourceTransactionId || sourceId,
        sourceTransactionIds: sourceIds,
      });
      setAssets((previous) => previous.map((asset) => asset.id === assetId ? normalized : asset));
      appendActivityLog({
        action: "link",
        entityType: "asset",
        entityId: assetId,
        propertyId: existingAsset.propertyId,
        unit: existingAsset.unit,
        summary: "Asset linked to transaction.",
        details: sourceId,
      });
    },
    updateAssetReview(assetId: string, patch: Partial<Pick<Asset, "assetReviewChecked" | "assetReviewNotes">>) {
      const existingAsset = getAssets().find((asset) => asset.id === assetId);
      setAssets((previous) => previous.map((asset) => asset.id === assetId
        ? normalizeAsset({
            ...asset,
            assetReviewChecked: patch.assetReviewChecked ?? asset.assetReviewChecked,
            assetReviewNotes: patch.assetReviewNotes ?? asset.assetReviewNotes,
          })
        : asset));
      if (!existingAsset) return;
      appendActivityLog({
        action: "review",
        entityType: "asset",
        entityId: assetId,
        propertyId: existingAsset.propertyId,
        unit: existingAsset.unit,
        summary: "Asset review updated.",
        details: existingAsset.description,
      });
    },
    deleteAsset(id: string) {
      const existingAsset = getAssets().find((asset) => asset.id === id);
      setAssets((previous) => previous.filter((asset) => asset.id !== id));
      appendActivityLog({
        action: "delete",
        entityType: "asset",
        entityId: id,
        propertyId: existingAsset?.propertyId,
        unit: existingAsset?.unit,
        summary: "Asset deleted.",
        details: existingAsset?.description,
      });
    },
  };
}
