import { AssetDiscoveryScreen } from "@/features/assets/asset-discovery-screen";

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <AssetDiscoveryScreen initialQuery={q ?? ""} />;
}
