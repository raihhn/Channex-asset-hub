import { MaintenanceCreateScreen } from "@/features/operations/maintenance-screen";

export default async function CreateMaintenancePage({ searchParams }: {
  searchParams: Promise<{ assetId?: string; requestId?: string; requestItemId?: string; issueId?: string }>;
}) {
  const { assetId, requestId, requestItemId, issueId } = await searchParams;
  return <MaintenanceCreateScreen assetId={assetId} requestId={requestId} requestItemId={requestItemId} issueId={issueId} />;
}
