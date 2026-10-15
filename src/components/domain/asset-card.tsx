import Link from "next/link";

import { AssetArtwork } from "@/components/domain/asset-artwork";
import { AssetClassification } from "@/components/domain/asset-classification";
import { AssetStatus } from "@/components/domain/asset-status";
import { AppIcon } from "@/components/shared/app-icon";
import type { Asset } from "@/types/prototype";

export function AssetCard({
  asset,
  featured = false,
}: {
  asset: Asset;
  featured?: boolean;
}) {
  return (
    <article className={`asset-card ${featured ? "asset-card--featured" : ""}`}>
      <Link
        aria-label={`View ${asset.name}`}
        className="asset-card__link"
        href={`/assets/${asset.id}`}
      >
        <AssetArtwork asset={asset} priority={featured} variant="tile" />
        <div className="asset-card__content">
          <div className="asset-card__topline">
            <span>{asset.brand}</span>
            <AssetStatus status={asset.availability} />
          </div>
          <h3 className="line-clamp-2" title={asset.name}>{asset.name}</h3>
          <p className="asset-card__type line-clamp-2" title={asset.type}>{asset.type}</p>
          {asset.importInfo ? <p className="text-muted text-sm">{asset.totalQuantity ?? "—"} {asset.unitPolicy?.stockUnit ?? "UoM belum diisi"}{asset.importInfo.eventName ? ` · ${asset.importInfo.eventName}` : ""}</p> : null}
          <div className="asset-card__classification"><AssetClassification asset={asset} /></div>
          <dl className="asset-card__facts">
            <div>
              <dt>
                <AppIcon name="location" />
                Location
              </dt>
              <dd>{asset.location}</dd>
            </div>
            <div>
              <dt>
                <AppIcon name="clock" />
                Age
              </dt>
              <dd>{asset.ageLabel}</dd>
            </div>
            <div>
              <dt>
                <AppIcon name="condition" />
                Condition
              </dt>
              <dd>{asset.condition}</dd>
            </div>
          </dl>
          {asset.issues.length ? (
            <p className="asset-card__issue">
              <AppIcon name="issue" /> {asset.issues.length} open issue
              {asset.issues.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
