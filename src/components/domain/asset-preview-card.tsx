import Link from "next/link";
import { Card, Chip } from "@heroui/react";
import { ArrowUpRight, MapPin } from "lucide-react";

import {
  AssetArtwork,
  type AssetPreviewRatio,
} from "@/components/domain/asset-artwork";
import { AssetStatus } from "@/components/domain/asset-status";
import type { Asset } from "@/types/prototype";

const conditionColors = {
  Good: "success",
  Fair: "warning",
  "Needs review": "danger",
} as const;

const heightLimits = {
  "1:1": "max-h-(--asset-preview-max-height-square)",
  "4:5": "max-h-(--asset-preview-max-height-portrait)",
  "16:9": "max-h-(--asset-preview-max-height-landscape)",
};

/** Compact discovery preview; media and status use the shared asset components. */
export function AssetPreviewCard({
  asset,
  aspectRatio = "16:9",
}: {
  asset: Asset;
  aspectRatio?: AssetPreviewRatio;
}) {
  return (
    <Card
      className={`w-full max-w-(--asset-preview-max-width) min-w-0 gap-0 overflow-hidden p-0 ${heightLimits[aspectRatio]}`}
    >
      <Link
        className="group focus-visible:outline-focus block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2"
        href={`/assets/${asset.id}`}
        aria-label={`View ${asset.name}`}
      >
        <div className="relative">
          <AssetArtwork
            asset={asset}
            variant="tile"
            aspectRatio={aspectRatio}
            className="w-full"
          />
          {asset.availability === "available" ? (
            <div className="bg-surface absolute top-2 right-2 rounded-full">
              <Chip
                color="default"
                variant="tertiary"
                size="sm"
                className="border-border border"
              >
                Available
              </Chip>
            </div>
          ) : null}
        </div>
        <div className="flex h-(--asset-preview-body-height) flex-col">
          <Card.Header className="min-h-0 gap-2 p-3 pb-2">
            <div className="flex min-w-0 items-start gap-2">
              <span
                className="text-muted line-clamp-2 min-w-0 flex-1 text-xs break-words"
                title={`${asset.brand} · ${asset.category}`}
              >
                {asset.brand} · {asset.category}
              </span>
              {asset.availability !== "available" ? (
                <AssetStatus status={asset.availability} />
              ) : null}
            </div>
            <div className="flex items-start justify-between gap-2">
              <Card.Title className="min-w-0 flex-1 text-base">
                <span className="line-clamp-2 break-words" title={asset.name}>
                  {asset.name}
                </span>
              </Card.Title>
              <ArrowUpRight
                aria-hidden="true"
                className="text-muted group-hover:text-accent mt-1 size-4 shrink-0"
              />
            </div>
            <Card.Description className="flex shrink-0 items-start gap-2 text-xs">
              <MapPin aria-hidden="true" className="size-3 shrink-0" />
              <span
                className="line-clamp-2 min-w-0 break-words"
                title={asset.location}
              >
                {asset.location}
              </span>
            </Card.Description>
          </Card.Header>
          <Card.Footer className="border-border mx-3 mt-auto h-14 shrink-0 flex-wrap content-center justify-between gap-x-2 gap-y-1 border-t py-2 text-xs">
            <span className="text-muted line-clamp-1" title={asset.ageLabel}>
              {asset.ageLabel}
            </span>
            <Chip
              color={conditionColors[asset.condition]}
              variant="soft"
              size="sm"
            >
              {asset.condition}
            </Chip>
          </Card.Footer>
        </div>
      </Link>
    </Card>
  );
}
