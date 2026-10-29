import { notFound } from "next/navigation";

import { AssetDetailScreen } from "@/features/assets/asset-detail-screen";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  if (!assetId) notFound();
  return <AssetDetailScreen assetId={assetId} />;
}
