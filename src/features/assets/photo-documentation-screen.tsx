"use client";

import Link from "next/link";
import { Button, Card, Chip } from "@heroui/react";

import { AppShell } from "@/components/shared/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { usePrototype } from "@/features/prototype/prototype-provider";
import type { AssetPhotoView } from "@/types/prototype";

const views: Array<{
  view: AssetPhotoView;
  required: boolean;
  guidance: string;
}> = [
  {
    view: "Front",
    required: true,
    guidance: "Capture the entire front structure.",
  },
  {
    view: "Left side",
    required: true,
    guidance: "Keep all panels and edges visible.",
  },
  {
    view: "Right side",
    required: true,
    guidance: "Capture unobstructed side condition.",
  },
  {
    view: "Rear",
    required: false,
    guidance: "Recommended for access and cable areas.",
  },
  {
    view: "Detail",
    required: false,
    guidance: "Use for clear damage or component evidence.",
  },
  {
    view: "Installed",
    required: false,
    guidance: "Use for in-use operational context.",
  },
];

export function PhotoDocumentationScreen({ assetId }: { assetId: string }) {
  const { assets, documentPhoto } = usePrototype();
  const asset = assets.find((item) => item.id === assetId);
  if (!asset)
    return (
      <AppShell pageLabel="Asset documentation">
        <EmptyState
          title="Asset not found"
          detail="This fixture asset is unavailable in the current session."
          actionHref="/assets"
          actionLabel="Back to assets"
        />
      </AppShell>
    );
  return (
    <AppShell pageLabel="Asset documentation">
      <div className="photo-documentation-screen">
        <Link className="back-link" href={`/assets/${asset.id}`}>
          ← {asset.name}
        </Link>
        <section className="screen-intro">
          <p>Asset photos</p>
          <h1>Maintain documentation</h1>
          <span>
            Required documentation is operational evidence, not just a gallery.
          </span>
        </section>
        <Card className="photo-guidance">
          <strong>Capture guidance</strong>
          <span>
            Show the full structure, avoid obstruction, use adequate lighting,
            capture clear damage detail, and avoid unnecessary people in frame.
          </span>
        </Card>
        <div className="photo-documentation-list">
          {views.map((item) => {
            const photo = asset.photos.find(
              (candidate) => candidate.view === item.view,
            );
            return (
              <Card key={item.view}>
                <div>
                  <Chip
                    className={
                      item.required
                        ? "photo-kind photo-kind--required"
                        : "photo-kind"
                    }
                    size="sm" variant="soft">
                    {item.required ? "Required" : "Optional"}
                  </Chip>
                  <h2>{item.view}</h2>
                  <p>{photo?.caption ?? item.guidance}</p>
                </div>
                {photo ? (
                  <Chip className="photo-complete" color="success" size="sm" variant="soft">Documented</Chip>
                ) : (
                  <Button
                    onClick={() => documentPhoto(asset.id, item.view)}
                    size="sm" variant="secondary">Add photo</Button>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
