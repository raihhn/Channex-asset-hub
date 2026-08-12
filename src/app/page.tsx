import { AppShell } from "@/components/shared/app-shell";
import { FoundationPreview } from "@/features/foundation/foundation-preview";
import { getCurrentSession } from "@/server/auth/session";

export default async function HomePage() {
  const session = await getCurrentSession();
  const workspaceName = session?.user.displayName ?? "AssetHub workspace";

  return (
    <AppShell workspaceName={workspaceName}>
      <FoundationPreview
        sessionSource={session?.source ?? "unconfigured"}
        workspaceName={workspaceName}
      />
    </AppShell>
  );
}
