import type { Asset } from "../models.ts";
import { normalizeStringArray } from "./storeUtils.ts";

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
