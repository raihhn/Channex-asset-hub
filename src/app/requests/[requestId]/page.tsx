import { RequestDetailScreen } from "@/features/requests/request-detail-screen";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <RequestDetailScreen requestId={requestId} />;
}
