import { notFound } from "next/navigation";
import { PhotoDocumentationScreen } from "@/features/assets/photo-documentation-screen";
export default async function AssetPhotosPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  if (!assetId) notFound();
  return <PhotoDocumentationScreen assetId={assetId} />;
}
