import { StatusLegend } from "@/components/domain/status-legend";
import { PageSection } from "@/components/shared/page-section";
import { Button } from "@/components/ui/button";

type FoundationPreviewProps = { sessionSource: string; workspaceName: string };

export function FoundationPreview({
  sessionSource,
  workspaceName,
}: FoundationPreviewProps) {
  return (
    <div className="foundation-preview" id="foundation">
      <section className="foundation-intro">
        <p className="foundation-intro__eyebrow">Slice 0 · Foundation</p>
        <h1>Operational clarity, before operational features.</h1>
        <p>
          The shell, token system, navigation patterns, and server boundaries
          are ready for the product slices that follow.
        </p>
        <div className="foundation-intro__actions">
          <Button type="button">Foundation ready</Button>
          <Button type="button" variant="subtle">
            {workspaceName}
          </Button>
        </div>
      </section>
      <div className="foundation-grid">
        <PageSection eyebrow="Design system" title="Semantic foundations">
          <p className="section-copy">
            Status meaning is centralized in tokens before it reaches asset and
            request workflows.
          </p>
          <StatusLegend />
        </PageSection>
        <PageSection eyebrow="Application boundary" title="Session contract">
          <p className="section-copy">
            A provider-neutral session boundary is active through the{" "}
            <strong>{sessionSource}</strong> adapter.
          </p>
          <p className="section-copy section-copy--muted">
            No production identity provider, role policy, or business data has
            been selected.
          </p>
        </PageSection>
      </div>
    </div>
  );
}
