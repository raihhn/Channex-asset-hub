"use client";
import Link from "next/link";
import { AppShell } from "@/components/shared/app-shell";
import { AssetGallery } from "@/components/domain/asset-gallery";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { AssetDocumentationEditor } from "./asset-documentation-editor";
export function PhotoDocumentationScreen({ assetId }: { assetId: string }) {
  const { assets, assetLoading, assetError } = usePrototype();
  const asset = assets.find((a) => a.id === assetId);
  return (
    <AppShell pageLabel="Asset documentation">
      <div className="mx-auto grid max-w-4xl min-w-0 gap-6">
        <Link href={`/assets/${assetId}`}>← Back to asset</Link>
        <h1>Asset documentation</h1>
        {assetLoading ? (
          <p role="status">Loading asset database…</p>
        ) : assetError ? (
          <p role="alert">{assetError}</p>
        ) : asset ? (
          <>
            <AssetGallery asset={asset} />
            <AssetDocumentationEditor asset={asset} />
          </>
        ) : (
          <p>Asset not found.</p>
        )}
      </div>
    </AppShell>
  );
}
