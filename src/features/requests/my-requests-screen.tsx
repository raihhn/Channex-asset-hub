"use client";

import { AppShell } from "@/components/shared/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { RequestCard } from "@/components/domain/request-card";
import { getFixtureAsset } from "@/lib/fixtures/prototype-data";
import { usePrototype } from "@/features/prototype/prototype-provider";
import type { RequestStatus } from "@/types/prototype";

const groups: Array<{ title: string; statuses: RequestStatus[] }> = [
  {
    title: "Waiting for an update",
    statuses: ["Pending approval", "Needs update"],
  },
  { title: "Upcoming", statuses: ["Approved"] },
  { title: "Active", statuses: ["In use"] },
  { title: "Closed", statuses: ["Completed", "Rejected", "Cancelled"] },
];

export function MyRequestsScreen() {
  const { requests } = usePrototype();
  return (
    <AppShell pageLabel="My requests">
      <div className="requests-screen">
        <section className="screen-intro">
          <p>Requests</p>
          <h1>My requests</h1>
          <span>Track each asset booking from submission to return.</span>
        </section>
        {requests.length ? (
          groups.map((group) => {
            const grouped = requests.filter((request) =>
              group.statuses.includes(request.status),
            );
            if (!grouped.length) return null;
            return (
              <section
                className="request-group"
                aria-labelledby={group.title.toLowerCase().replaceAll(" ", "-")}
                key={group.title}
              >
                <div className="section-heading">
                  <h2 id={group.title.toLowerCase().replaceAll(" ", "-")}>
                    {group.title}
                  </h2>
                  <span>{grouped.length}</span>
                </div>
                <div className="request-list">
                  {grouped.map((request) => {
                    const asset = getFixtureAsset(request.items[0]?.assetId);
                    return (
                      <RequestCard
                        asset={asset}
                        key={request.id}
                        request={request}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })
        ) : (
          <EmptyState
            actionHref="/assets"
            actionLabel="Browse assets"
            detail="Start from an asset to create your first request."
            title="You have no requests yet"
          />
        )}
      </div>
    </AppShell>
  );
}
