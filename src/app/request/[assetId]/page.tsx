import { redirect } from "next/navigation";

export default async function RequestAssetPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  redirect(`/request/new?assets=${assetId}`);
}
