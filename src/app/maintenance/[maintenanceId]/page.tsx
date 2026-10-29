import { MaintenanceDetailScreen } from "@/features/operations/maintenance-screen";

export default async function MaintenancePage({ params }: {
  params: Promise<{ maintenanceId: string }>;
}) {
  const { maintenanceId } = await params;
  return <MaintenanceDetailScreen maintenanceId={maintenanceId} />;
}
