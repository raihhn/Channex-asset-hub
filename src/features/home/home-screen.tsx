"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, isValid, parse, parseISO } from "date-fns";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  ClipboardList,
  MapPin,
  RotateCcw,
  Wrench,
} from "lucide-react";
import { Button, Card, Chip, SearchField } from "@heroui/react";

import { deriveReturnTasks } from "@/lib/domain/request-journey";
import { useLocalNow } from "@/components/shared/use-local-now";
import { ReturnReminder } from "@/components/domain/return-reminder";
import { AssetPreviewCard } from "@/components/domain/asset-preview-card";
import { RequestStatus } from "@/components/domain/request-status";
import { AppShell } from "@/components/shared/app-shell";
import { usePrototype } from "@/features/prototype/prototype-provider";
import type { PrototypeRequest } from "@/types/prototype";

const closedStatuses = new Set(["Completed", "Rejected", "Cancelled"]);
const linkStyle =
  "inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus";
const rowStyle =
  "group flex min-w-0 items-center gap-3 rounded-lg p-3 transition-colors hover:bg-default focus-visible:outline-2 focus-visible:outline-focus";

function requestDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}/.test(value)
    ? parseISO(value)
    : parse(value, "dd MMM yyyy", new Date(0));
}
function dateLabel(value: string) {
  const date = requestDate(value);
  return isValid(date) ? format(date, "d MMM yyyy") : value;
}
function requestTitle(request: PrototypeRequest) {
  return (
    request.projectName ||
    request.activityName ||
    request.purpose ||
    "Asset request"
  );
}

export function HomeScreen() {
  const {
    catalogAssets: assets,
    requests,
    outboundDispatches,
    returnReceipts,
    role,
    currentUser,
    approvalAssignments,
    bookingLoading,
    bookingError,
  } = usePrototype();
  const now = useLocalNow();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const attentionAssets = assets.filter(
    (asset) =>
      asset.condition === "Needs review" ||
      asset.issues.some((issue) => issue.status !== "Resolved") ||
      asset.availability === "maintenance" ||
      Boolean(asset.lifecycleNote),
  );
  const returnRequests = requests.filter((request) =>
    deriveReturnTasks(request, outboundDispatches, returnReceipts, now).some(
      (task) =>
        ["Due today", "Overdue", "Inspection pending", "On hold"].includes(
          task.state,
        ),
    ),
  );
  const assignedReviews = requests.filter(
    (request) =>
      request.status === "Pending approval" &&
      approvalAssignments.some(
        (assignment) =>
          assignment.requestId === request.id &&
          assignment.cycle === (request.reviewRound ?? 1) &&
          assignment.status === "Pending" &&
          assignment.reviewerUserId === currentUser.id,
      ),
  );
  const revisionRequests = requests.filter(
    (request) =>
      request.status === "Needs update" &&
      request.submittedByUserId === currentUser.id,
  );
  const activeRequests = requests
    .filter((request) => !closedStatuses.has(request.status))
    .sort(
      (a, b) =>
        (requestDate(b.submittedAt).getTime() || 0) -
        (requestDate(a.submittedAt).getTime() || 0),
    );
  const availableAssets = assets.filter(
    (asset) => asset.availability === "available",
  );
  const personalTasks = [...assignedReviews, ...revisionRequests];
  const attentionCount =
    returnRequests.length + attentionAssets.length + personalTasks.length;
  const latestSubmissions = requests
    .filter((request) => request.status !== "Draft")
    .sort(
      (a, b) =>
        (requestDate(b.submittedAt).getTime() || 0) -
        (requestDate(a.submittedAt).getTime() || 0),
    )
    .slice(0, 3);

  function searchInventory() {
    const term = query.trim();
    router.push(term ? `/assets?q=${encodeURIComponent(term)}` : "/assets");
  }

  return (
    <AppShell pageLabel="Today" showHeaderSearch={false}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:gap-8">
        <ReturnReminder />
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <p className="text-muted text-xs font-medium tracking-wide uppercase">
              Your workspace
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              Hello, {currentUser.name.split(" ")[0]}.
            </h1>
            <p className="text-muted text-sm">
              A clear view of your assets and what needs to happen next.
            </p>
          </div>
          <Chip variant="soft" size="sm">
            <Boxes aria-hidden="true" className="size-3" /> Asset operations
          </Chip>
        </header>

        <Card className="gap-4 p-4 sm:p-6" variant="secondary">
          <Card.Header className="gap-2">
            <Card.Title
              render={(props) => <h2 {...props} />}
              className="text-xl font-semibold tracking-tight"
            >
              Find it. Reuse it. Put it to work.
            </Card.Title>
            <Card.Description className="text-sm">
              Search existing inventory before planning your next activation.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <form
              role="search"
              aria-label="Inventory search"
              className="flex w-full max-w-2xl flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                searchInventory();
              }}
            >
              <SearchField
                aria-label="Find an asset"
                className="min-w-0 flex-1"
                value={query}
                onChange={setQuery}
                onSubmit={searchInventory}
              >
                <SearchField.Group className="min-h-11">
                  <SearchField.SearchIcon />
                  <SearchField.Input
                    className="w-full"
                    placeholder="Search name, brand, or location"
                  />
                  <SearchField.ClearButton aria-label="Clear inventory search" />
                </SearchField.Group>
              </SearchField>
              <Button type="submit" variant="primary">
                Search inventory{" "}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            </form>
          </Card.Content>
          <Card.Footer className="text-muted flex-wrap justify-between gap-3 text-xs">
            <p>
              <strong className="text-foreground font-medium">
                {availableAssets.length} assets currently available
              </strong>{" "}
              · Booking dates are checked in your request.
            </p>
            <Link href="/assets" className={linkStyle}>
              Browse all inventory{" "}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </Card.Footer>
        </Card>

        <section aria-labelledby="home-attention-title">
          <Card className="gap-4 p-4 sm:p-6">
            <Card.Header className="flex-row flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <Card.Title
                  render={(props) => (
                    <h2 {...props} id="home-attention-title" />
                  )}
                  className="text-lg"
                >
                  Needs attention
                </Card.Title>
                <Card.Description className="text-sm">
                  Returns, reviews, and asset health in the workspace.
                </Card.Description>
              </div>
              <Chip
                color={attentionCount ? "warning" : "success"}
                variant="soft"
                size="sm"
              >
                {attentionCount} to follow up
              </Chip>
            </Card.Header>
            <Card.Content className="grid gap-4 lg:grid-cols-2 lg:gap-6">
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <RotateCcw aria-hidden="true" className="text-muted size-4" />
                  Returns & request follow-up{" "}
                  <span className="text-muted">
                    {returnRequests.length + personalTasks.length}
                  </span>
                </h3>
                <div className="divide-border divide-y">
                  {[...personalTasks, ...returnRequests]
                    .slice(0, 3)
                    .map((request) => (
                      <Link
                        key={request.id}
                        href={`/requests/${request.id}`}
                        className={rowStyle}
                      >
                        <span className="bg-warning-soft text-warning-soft-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                          <ClipboardList
                            aria-hidden="true"
                            className="size-4"
                          />
                        </span>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="truncate text-sm font-medium">
                            {requestTitle(request)}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-muted text-xs">
                              {request.id}
                            </span>
                            <RequestStatus status={request.status} />
                          </div>
                        </div>
                        <ArrowUpRight
                          aria-hidden="true"
                          className="text-muted group-hover:text-accent size-4 shrink-0"
                        />
                      </Link>
                    ))}
                  {!returnRequests.length && !personalTasks.length ? (
                    <p className="text-muted py-4 text-sm">
                      No return or assigned review needs follow-up.
                    </p>
                  ) : null}
                </div>
              </div>
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Wrench aria-hidden="true" className="text-muted size-4" />
                  Asset health{" "}
                  <span className="text-muted">{attentionAssets.length}</span>
                </h3>
                <div className="divide-border divide-y">
                  {attentionAssets.slice(0, 3).map((asset) => {
                    const openIssues = asset.issues.filter(
                      (issue) => issue.status !== "Resolved",
                    ).length;
                    return (
                      <Link
                        key={asset.id}
                        href={`/assets/${asset.id}`}
                        className={rowStyle}
                      >
                        <span className="bg-warning-soft text-warning-soft-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                          <Wrench aria-hidden="true" className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="truncate text-sm font-medium">
                            {asset.name}
                          </p>
                          <p className="text-muted text-xs">
                            {openIssues
                              ? `${openIssues} open issue${openIssues === 1 ? "" : "s"}`
                              : asset.lifecycleNote ||
                                "Condition review required"}
                          </p>
                        </div>
                        <ArrowUpRight
                          aria-hidden="true"
                          className="text-muted group-hover:text-accent size-4 shrink-0"
                        />
                      </Link>
                    );
                  })}
                  {!attentionAssets.length ? (
                    <p className="text-muted py-4 text-sm">
                      No asset health follow-up right now.
                    </p>
                  ) : null}
                </div>
              </div>
            </Card.Content>
            <Card.Footer className="border-border flex-wrap justify-between gap-3 border-t pt-4">
              <Link href="/operations" className={linkStyle}>
                Open operations{" "}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              {assignedReviews.length || role === "Approver" ? (
                <Link href="/requests/approvals" className={linkStyle}>
                  Approval inbox{" "}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              ) : null}
            </Card.Footer>
          </Card>
        </section>

        <div className="grid items-stretch gap-6 lg:grid-cols-2 lg:gap-8">
          <section aria-labelledby="home-requests-title" className="min-h-0">
            <Card className="gap-4 p-4 sm:p-6 lg:h-full">
              <Card.Header className="flex-row items-start justify-between gap-3">
                <div className="space-y-1">
                  <Card.Title
                    render={(props) => (
                      <h2 {...props} id="home-requests-title" />
                    )}
                    className="text-lg"
                  >
                    Requests in motion
                  </Card.Title>
                  <Card.Description className="text-sm">
                    {activeRequests.length} active requests across the
                    workspace.
                  </Card.Description>
                </div>
                <Link href="/requests" className={`${linkStyle} shrink-0`}>
                  View all
                </Link>
              </Card.Header>
              <Card.Content>
                {bookingError ? (
                  <p role="alert" className="text-danger mb-3 text-sm">
                    {bookingError}
                  </p>
                ) : null}
                {bookingLoading ? (
                  <p role="status" className="text-muted mb-3 text-sm">
                    Loading saved requests…
                  </p>
                ) : null}
                <div className="divide-border divide-y">
                  {activeRequests.slice(0, 4).map((request) => (
                    <Link
                      href={`/requests/${request.id}`}
                      key={request.id}
                      className={rowStyle}
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted text-xs">
                            {request.id}
                          </span>
                          <RequestStatus status={request.status} />
                        </div>
                        <p className="text-sm font-medium">
                          {requestTitle(request)}
                        </p>
                        <p className="text-muted flex items-start gap-1 text-xs">
                          <MapPin
                            aria-hidden="true"
                            className="mt-0.5 size-3 shrink-0"
                          />
                          {request.destination}
                        </p>
                        <p className="text-muted text-xs">
                          {dateLabel(request.startDate)} –{" "}
                          {dateLabel(request.endDate)}
                        </p>
                      </div>
                      <ArrowUpRight
                        aria-hidden="true"
                        className="text-muted group-hover:text-accent size-4 shrink-0"
                      />
                    </Link>
                  ))}
                </div>
                {!activeRequests.length && !bookingLoading ? (
                  <p className="text-muted py-4 text-sm">
                    No active requests. Explore inventory to plan your next
                    booking.
                  </p>
                ) : null}
              </Card.Content>
            </Card>
          </section>
          <section aria-labelledby="home-available-title" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h2 id="home-available-title" className="text-lg font-semibold">
                  Ready to reuse
                </h2>
                <p className="text-muted text-sm">
                  Explore assets with a currently available status.
                </p>
              </div>
              <Link href="/assets" className={linkStyle}>
                Inventory <ArrowUpRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
            <div className="grid w-full max-w-lg grid-cols-2 items-start gap-3 sm:gap-4">
              {availableAssets.slice(0, 4).map((asset, index) => (
                <AssetPreviewCard
                  key={asset.id}
                  asset={
                    index === 0
                      ? {
                          ...asset,
                          name: "Glow Pavilion 4×6 — Modular Consultation and Product Discovery Booth with Integrated Display Shelves, Lighting, Storage and Sampling Counter for Large Multi-brand Retail Activations",
                          location:
                            "Jakarta Central Distribution Hub · Warehouse B · Event Asset Storage and Preparation Area",
                        }
                      : asset
                  }
                />
              ))}
            </div>
            {!availableAssets.length ? (
              <p className="text-muted text-sm">
                No assets currently available. Browse inventory for all
                statuses.
              </p>
            ) : (
              <p className="text-muted text-xs">
                Check condition and your booking dates before requesting.
              </p>
            )}
          </section>
        </div>

        <section
          aria-labelledby="home-recent-title"
          className="border-border space-y-4 border-t pt-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="home-recent-title" className="text-lg font-semibold">
              Recent submissions
            </h2>
            <span className="text-muted text-xs">
              Latest requests in the workspace
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {latestSubmissions.map((request) => (
              <Link
                key={request.id}
                href={`/requests/${request.id}`}
                className={`${rowStyle} p-0`}
              >
                <span className="bg-default text-muted flex size-10 shrink-0 items-center justify-center rounded-full">
                  <ClipboardList aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-medium">
                    {requestTitle(request)}
                  </p>
                  <p className="text-muted text-xs">
                    {request.id} · {dateLabel(request.submittedAt)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          {!latestSubmissions.length ? (
            <p className="text-muted text-sm">
              Submitted requests will appear here.
            </p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
