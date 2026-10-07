import type { Asset } from "@/types/prototype";

type ArtworkVariant = "wide" | "tile" | "portrait";

export function AssetArtwork({
  asset,
  variant = "wide",
}: {
  asset: Asset;
  priority?: boolean;
  variant?: ArtworkVariant;
}) {
  return (
    <div
      aria-label={`${asset.name} visual placeholder`}
      className={`asset-artwork asset-artwork--${variant} asset-artwork--${asset.tone} asset-artwork--${asset.artwork}`}
      role="img"
    >
      <span className="asset-artwork__glow" />
      <span className="asset-artwork__form asset-artwork__form--one" />
      <span className="asset-artwork__form asset-artwork__form--two" />
      <span className="asset-artwork__brand">{asset.brand}</span>
      <span className="asset-artwork__caption">{asset.category}</span>
    </div>
  );
}
