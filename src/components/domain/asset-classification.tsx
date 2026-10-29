import { Chip } from "@heroui/react";

import { getAssetClassificationLabel } from "@/lib/domain/asset-governance";
import type { Asset } from "@/types/prototype";

export function AssetClassification({ asset }: { asset: Pick<Asset, "classification"> }) {
  return <Chip color={asset.classification === "INVENTORY" ? "accent" : "default"} size="sm" variant="soft">{getAssetClassificationLabel(asset)}</Chip>;
}
