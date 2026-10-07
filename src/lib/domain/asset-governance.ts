import type { Asset, AssetClassification } from "@/types/prototype";

export function getAssetClassification(asset: Pick<Asset, "classification">): AssetClassification {
  return asset.classification ?? "ASSET";
}

export function getAssetClassificationLabel(
  asset: Pick<Asset, "classification">,
) {
  return getAssetClassification(asset) === "INVENTORY"
    ? "Reusable Inventory"
    : "Asset";
}

export function isDisposalReviewRecommended(
  asset: Pick<Asset, "classification" | "lastUsedAt">,
  now = new Date(),
) {
  if (getAssetClassification(asset) !== "INVENTORY" || !asset.lastUsedAt) {
    return false;
  }

  const lastUsedAt = new Date(`${asset.lastUsedAt}T00:00:00.000Z`);
  if (
    Number.isNaN(lastUsedAt.getTime()) ||
    lastUsedAt.toISOString().slice(0, 10) !== asset.lastUsedAt
  ) {
    return false;
  }

  const threshold = new Date(now);
  threshold.setUTCFullYear(threshold.getUTCFullYear() - 2);
  return lastUsedAt <= threshold;
}
