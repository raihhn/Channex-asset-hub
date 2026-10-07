import { NewRequestScreen } from "@/features/requests/new-request-screen";
export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ assets?: string; revise?: string }>;
}) {
  const { assets, revise } = await searchParams;
  return (
    <NewRequestScreen
      initialAssetIds={assets?.split(",").filter(Boolean) ?? []}
      revisionRequestId={revise}
    />
  );
}
