import { notFound } from "next/navigation";
import { RequestFlowScreen } from "@/features/requests/request-flow-screen";
import { getFixtureAsset } from "@/lib/fixtures/prototype-data";
export default async function RequestFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ assets?: string }>;
}) {
  const { assets: encoded } = await searchParams;
  const items = (encoded ?? "")
    .split(",")
    .filter(Boolean)
    .map((item) => {
      const [assetId, quantity] = item.split(":");
      return {
        asset: getFixtureAsset(assetId),
        quantity: Number(quantity) || 1,
      };
    })
    .filter((item) => item.asset);
  if (!items.length) notFound();
  return (
    <RequestFlowScreen
      items={
        items as Array<{
          asset: NonNullable<(typeof items)[number]["asset"]>;
          quantity: number;
        }>
      }
    />
  );
}
