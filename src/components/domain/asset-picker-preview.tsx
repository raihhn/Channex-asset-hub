"use client";

import { useRef, useState } from "react";
import { Button } from "@heroui/react";
import { AppIcon } from "@/components/ui/app-icon";
import type { Asset } from "@/types/prototype";
import { AssetArtwork } from "./asset-artwork";

export function AssetPickerPreview({ asset }: { asset: Asset }) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const photo = asset.photos[index] ?? asset.photos[0];
  const move = (direction: -1 | 1) =>
    setIndex((value) =>
      Math.max(0, Math.min(asset.photos.length - 1, value + direction)),
    );
  return (
    <div
      className="asset-picker-preview"
      onClick={(event) => event.stopPropagation()}
      onTouchEnd={(event) => {
        if (touchStart.current === null) return;
        const delta = event.changedTouches[0].clientX - touchStart.current;
        if (Math.abs(delta) > 28) move(delta < 0 ? 1 : -1);
        touchStart.current = null;
      }}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0].clientX;
      }}
    >
      <AssetArtwork asset={asset} />
      <span>
        {photo?.view ?? "No photo"} · {index + 1}/{asset.photos.length}
      </span>
      <div>
        <Button
          aria-label={`Previous preview for ${asset.name}`}
          isDisabled={!index}
          onClick={() => move(-1)}
          isIconOnly size="sm" variant="secondary">
          <AppIcon name="chevron-left" />
        </Button>
        <Button
          aria-label={`Next preview for ${asset.name}`}
          isDisabled={index === asset.photos.length - 1}
          onClick={() => move(1)}
          isIconOnly size="sm" variant="secondary">
          <AppIcon name="chevron-right" />
        </Button>
      </div>
    </div>
  );
}
