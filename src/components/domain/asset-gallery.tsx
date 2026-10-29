"use client";

import { useState } from "react";
import { Button, Chip } from "@heroui/react";

import { AppIcon } from "@/components/shared/app-icon";
import type { Asset } from "@/types/prototype";
import { AssetArtwork } from "./asset-artwork";

export function AssetGallery({ asset }: { asset: Asset }) {
  const [selected, setSelected] = useState(0);
  const photo = asset.photos[selected];
  return (
    <section className="asset-gallery" aria-label="Asset photo gallery">
      <AssetArtwork asset={asset} photo={photo} priority />
      <Chip className="asset-gallery__count" size="sm" variant="soft">
        {asset.photos.length ? selected + 1 : 0} / {asset.photos.length}
      </Chip>
      <div className="asset-gallery__controls">
        <Button
          aria-label="Previous photo"
          isDisabled={!selected}
          onPress={() => setSelected((value) => value - 1)}
          isIconOnly
          size="sm"
          variant="secondary"
        >
          <AppIcon name="chevron-left" />
        </Button>
        <span>
          {photo
            ? photo.category
              ? `${photo.category} Photo · ${photo.view} · ${photo.caption}`
              : asset.importInfo
                ? `Source photo ${selected + 1}`
                : `${photo.view} · ${photo.caption}`
            : "Documentation not available"}
        </span>
        <Button
          aria-label="Next photo"
          isDisabled={
            !asset.photos.length || selected >= asset.photos.length - 1
          }
          onPress={() => setSelected((value) => value + 1)}
          isIconOnly
          size="sm"
          variant="secondary"
        >
          <AppIcon name="chevron-right" />
        </Button>
      </div>
      <div className="asset-gallery__thumbs">
        {asset.photos.map((item, index) => (
          <Button
            aria-pressed={selected === index}
            className={selected === index ? "is-selected" : ""}
            key={item.id}
            onPress={() => setSelected(index)}
            size="sm"
            variant={selected === index ? "primary" : "ghost"}
          >
            {item.category
              ? `${item.category} · ${index + 1}`
              : asset.importInfo
                ? `Source ${index + 1}`
                : item.view}
          </Button>
        ))}
      </div>
    </section>
  );
}
