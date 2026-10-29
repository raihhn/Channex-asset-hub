import { ReturnInspectionScreen } from "@/features/requests/return-inspection-screen";
export default async function ReturnPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <ReturnInspectionScreen requestId={requestId} />;
}
