import Image from "next/image";
import type { Asset, AssetPhoto } from "@/types/prototype";

export type AssetPreviewRatio = "1:1" | "4:5" | "16:9";

type ArtworkVariant = "wide" | "tile" | "portrait";

export function AssetArtwork({
  asset,
  photo,
  priority = false,
  variant = "wide",
  className = "",
  aspectRatio,
  showLabels = true,
}: {
  asset: Asset;
  photo?: AssetPhoto;
  priority?: boolean;
  variant?: ArtworkVariant;
  className?: string;
  aspectRatio?: AssetPreviewRatio;
  showLabels?: boolean;
}) {
  const image =
    photo ?? asset.photos.find((photo) => photo.url || photo.dataUrl);
  const imageUrl = image?.url ?? image?.dataUrl;
  if (imageUrl)
    return (
      <div
        className={`asset-artwork asset-artwork--${variant} relative overflow-hidden ${className}`}
        data-aspect-ratio={aspectRatio}
      >
        <Image
          src={imageUrl}
          alt={`${asset.name} — ${image?.caption ?? "Asset photo"}`}
          fill
          unoptimized
          priority={priority}
          sizes="(max-width: 640px) 50vw, 33vw"
          className="object-contain"
        />
      </div>
    );
  return (
    <div
      aria-label={`${asset.name} visual placeholder`}
      className={`asset-artwork asset-artwork--${variant} asset-artwork--${asset.tone} asset-artwork--${asset.artwork} ${className}`}
      data-aspect-ratio={aspectRatio}
      role="img"
    >
      <span className="asset-artwork__glow" />
      <span className="asset-artwork__form asset-artwork__form--one" />
      <span className="asset-artwork__form asset-artwork__form--two" />
      {showLabels ? (
        <>
          <span className="asset-artwork__brand">{asset.brand}</span>
          <span className="asset-artwork__caption">
            {asset.importInfo ? "Photo not available" : asset.category}
          </span>
        </>
      ) : null}
    </div>
  );
}
