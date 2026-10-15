"use client";
import Link from "next/link";
import { useState } from "react";
import { Card, Chip, Tabs, SearchField } from "@heroui/react";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { AppShell } from "@/components/shared/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { AssetArtwork } from "@/components/domain/asset-artwork";
import { ReturnReminder } from "@/components/domain/return-reminder";
import { JourneyTimeline } from "@/components/domain/journey-timeline";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { requestJourney } from "@/lib/domain/request-journey";
import { useLocalNow } from "@/components/shared/use-local-now";

const filters = [
  { id: "all", label: "All requests" },
  { id: "approval", label: "Approval" },
  { id: "delivery", label: "Delivery" },
  { id: "returns", label: "Use & returns" },
  { id: "closed", label: "Closed" },
];
export function MyRequestsScreen() {
  const {
    requests,
    assets,
    outboundDispatches,
    returnReceipts,
    bookingLoading,
    bookingError,
  } = usePrototype();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const now = useLocalNow();
  const orders = requests.map((request) => ({
    request,
    journey: requestJourney(request, outboundDispatches, returnReceipts, now),
  }));
  const filtered = orders.filter(
    ({ request, journey }) =>
      (filter === "all" || journey.filter === filter) &&
      `${request.id} ${request.projectName ?? request.purpose} ${request.destination} ${request.items.map((item) => assets.find((asset) => asset.id === item.assetId)?.name).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <AppShell pageLabel="Requests" showHeaderSearch={false}>
      <div className="mx-auto max-w-5xl space-y-6 pb-24">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-muted text-xs font-medium">Bookings</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              My requests
            </h1>
            <p className="text-muted mt-2 text-sm">
              Approval, delivery and return — all in one booking.
            </p>
          </div>
        </header>
        <ReturnReminder />
        <SearchField
          aria-label="Search requests"
          value={query}
          onChange={setQuery}
          className="w-full max-w-md"
        >
          <SearchField.Group>
            <SearchField.SearchIcon>
              <Search size={16} />
            </SearchField.SearchIcon>
            <SearchField.Input placeholder="Search request, project or asset" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        {bookingLoading ? (
          <p role="status">Loading requests…</p>
        ) : bookingError ? (
          <p role="alert">{bookingError}</p>
        ) : (
          <Tabs
            selectedKey={filter}
            onSelectionChange={(key) => setFilter(String(key))}
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="Request status filters">
                {filters.map((tab) => (
                  <Tabs.Tab
                    id={tab.id}
                    key={tab.id}
                    className="gap-2 whitespace-nowrap"
                  >
                    {tab.label}
                    <span className="text-xs">
                      {
                        orders.filter(
                          (entry) =>
                            tab.id === "all" || entry.journey.filter === tab.id,
                        ).length
                      }
                    </span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            {filters.map((tab) => (
              <Tabs.Panel id={tab.id} key={tab.id} className="pt-4">
                <div className="grid gap-4">
                  {filtered.map(({ request, journey }) => (
                    <Card
                      key={request.id}
                      aria-label={`Request ${request.id}`}
                      className="border-border gap-4 border p-4 sm:p-5"
                    >
                      <Card.Header className="flex-row flex-wrap items-center justify-between gap-2">
                        <p className="text-muted text-xs">
                          {request.id} · {request.items.length} item(s)
                        </p>
                        <Chip
                          size="sm"
                          variant="soft"
                          color={
                            journey.attention.length
                              ? "warning"
                              : journey.complete
                                ? "success"
                                : "accent"
                          }
                        >
                          {journey.label}
                        </Chip>
                      </Card.Header>
                      <Card.Content className="grid gap-4">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="size-16 shrink-0 overflow-hidden rounded-xl">
                            {assets.find(
                              (asset) => asset.id === request.items[0]?.assetId,
                            ) ? (
                              <AssetArtwork
                                asset={assets.find(
                                  (asset) =>
                                    asset.id === request.items[0]?.assetId,
                                )!}
                                variant="tile"
                                aspectRatio="1:1"
                                showLabels={false}
                              />
                            ) : (
                              <div className="bg-surface-secondary flex h-full items-center justify-center text-xs">
                                Custom
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <h2
                              className="line-clamp-2 text-base font-semibold"
                              title={request.projectName ?? request.purpose}
                            >
                              {request.projectName ?? request.purpose}
                            </h2>
                            <p className="text-muted text-xs">
                              {request.startDate} – {request.endDate}
                            </p>
                            <p className="text-muted flex items-start gap-1 text-xs">
                              <MapPin
                                size={13}
                                className="shrink-0"
                                aria-hidden="true"
                              />
                              <span className="line-clamp-2">
                                {request.destination}
                              </span>
                            </p>
                          </div>
                        </div>
                        <JourneyTimeline steps={journey.steps} compact />
                      </Card.Content>
                      <Card.Footer className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                        <p className="text-muted max-w-xl text-xs">
                          {journey.description}
                        </p>
                        <Link
                          aria-label={`View request ${request.id}`}
                          className="text-accent inline-flex shrink-0 items-center gap-1 text-sm font-medium"
                          href={`/requests/${request.id}`}
                        >
                          Track request
                          <ArrowRight size={15} aria-hidden="true" />
                        </Link>
                      </Card.Footer>
                    </Card>
                  ))}
                  {!filtered.length && (
                    <EmptyState
                      title="No requests in this view"
                      detail="Try another status or search term."
                      actionHref="/request/new"
                      actionLabel="New request"
                    />
                  )}
                </div>
              </Tabs.Panel>
            ))}
          </Tabs>
        )}
      </div>
    </AppShell>
  );
}
