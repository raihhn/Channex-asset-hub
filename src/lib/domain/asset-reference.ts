import type { Asset } from "@/types/prototype";

/** User-facing references must not fall back to an internal database identity. */
export function assetReference(asset: Asset): string | undefined {
  return (
    asset.assetNumber ||
    asset.legacyReference ||
    asset.importInfo?.sourceCode ||
    (asset.code !== asset.id && !asset.code.startsWith("xls-")
      ? asset.code
      : undefined)
  );
}
