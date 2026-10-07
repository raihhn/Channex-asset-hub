"use client";

import { useState } from "react";
import { Button, Chip } from "@heroui/react";

import { AppIcon } from "@/components/ui/app-icon";
import type { Asset } from "@/types/prototype";
import { AssetArtwork } from "./asset-artwork";

export function AssetGallery({ asset }: { asset: Asset }) {
  const [selected, setSelected] = useState(0);
  const photo = asset.photos[selected];
  return (
    <section className="asset-gallery" aria-label="Asset photo gallery">
      <AssetArtwork asset={asset} priority />
      <Chip className="asset-gallery__count" size="sm" variant="soft">
        {selected + 1} / {asset.photos.length}
      </Chip>
      <div className="asset-gallery__controls">
        <Button
          aria-label="Previous photo"
          isDisabled={!selected}
          onClick={() => setSelected((value) => value - 1)}
          isIconOnly size="sm" variant="secondary">
          <AppIcon name="chevron-left" />
        </Button>
        <span>
          {photo.view} · {photo.caption}
        </span>
        <Button
          aria-label="Next photo"
          isDisabled={selected === asset.photos.length - 1}
          onClick={() => setSelected((value) => value + 1)}
          isIconOnly size="sm" variant="secondary">
          <AppIcon name="chevron-right" />
        </Button>
      </div>
      <div className="asset-gallery__thumbs">
        {asset.photos.map((item, index) => (
          <Button
            aria-pressed={selected === index}
            className={selected === index ? "is-selected" : ""}
            key={item.id}
            onClick={() => setSelected(index)}
            size="sm" variant={selected === index ? "primary" : "ghost"}>
            {item.view}
          </Button>
        ))}
      </div>
    </section>
  );
}
