import { ReportIssueScreen } from "@/features/assets/report-issue-screen";
export default async function IssuePage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  return <ReportIssueScreen assetId={assetId} />;
}
