"use client";

import Link from "next/link";
import {stockUnit} from "@/lib/domain/asset-units";
import { MapPin, Undo2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, Card, Chip } from "@heroui/react";

import { AssetArtwork } from "@/components/domain/asset-artwork";
import { AppShell } from "@/components/shared/app-shell";
import { WorkflowDisclosure } from "@/components/shared/workflow-disclosure";
import { EmptyState } from "@/components/shared/empty-state";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { getParentEvent } from "@/lib/domain/events";
import {
  deriveReservations,
  getReservationPhaseState,
} from "@/lib/domain/reservations";
import { requestJourney } from "@/lib/domain/request-journey";
import { JourneyTimeline } from "@/components/domain/journey-timeline";
import { useLocalNow } from "@/components/shared/use-local-now";
import { RequestOutboundSection } from "@/features/requests/request-outbound-section";
import { RequestReviewSection } from "@/features/requests/request-review-section";
import { FinancialReferencesSection } from "@/components/domain/financial-references-section";

export function RequestDetailScreen({ requestId }: { requestId: string }) {
  const {
    requests,
    currentUser,
    approvalAssignments,
    wbsReferences,
    events,
    assets,
    returnReceipts,
    outboundDispatches,
    bookingLoading,
    bookingError,
  } = usePrototype();
  const [actionPanel, setActionPanel] = useState<"review" | "delivery" | null>(
    null,
  );
  const localNow = useLocalNow();
  if (bookingLoading)
    return (
      <AppShell pageLabel="Request detail">
        <p className="p-6" role="status">
          Loading saved request…
        </p>
      </AppShell>
    );
  if (bookingError)
    return (
      <AppShell pageLabel="Request detail">
        <p className="p-6" role="alert">
          Could not load saved request: {bookingError}
        </p>
      </AppShell>
    );
  const request = requests.find((item) => item.id === requestId);
  const requestWbsReferences = (request?.wbsReferenceIds ?? []).flatMap(
    (id) => {
      const reference = wbsReferences.find((item) => item.id === id);
      return reference ? [reference] : [];
    },
  );
  const requestEvent = request?.eventId
    ? events.find((event) => event.id === request.eventId)
    : undefined;
  const requestReservations = request
    ? deriveReservations(
        [request],
        assets,
        events,
        returnReceipts,
        outboundDispatches,
      )
    : [];

  if (!request) {
    return (
      <AppShell pageLabel="Request detail">
        <EmptyState
          actionHref="/requests"
          actionLabel="Back to requests"
          detail="This prototype request is no longer available in this session."
          title="Request not found"
        />
      </AppShell>
    );
  }

  const dimensions = [
    request.spaceLength,
    request.spaceWidth,
    request.spaceHeight,
  ].some(Boolean)
    ? `${request.spaceLength || "—"} × ${request.spaceWidth || "—"} × ${request.spaceHeight || "—"} m`
    : "Not provided";

  const journey = requestJourney(
    request,
    outboundDispatches,
    returnReceipts,
    localNow,
  );
  const reviewActive = journey.review;
  const outboundActive = journey.needsDelivery;
  const actionOpen = actionPanel === (reviewActive ? "review" : "delivery");
  const dispatches = outboundDispatches.filter(
    (record) => record.requestId === request.id,
  );
  const canManageReview =
    currentUser.roles.includes("SUPER_ADMIN") ||
    approvalAssignments.some(
      (assignment) =>
        assignment.requestId === request.id &&
        assignment.status === "Pending" &&
        assignment.reviewerUserId === currentUser.id,
    );

  return (
    <AppShell pageLabel="Request detail" showHeaderSearch={false}>
      <div className="mx-auto max-w-6xl space-y-6 pb-24">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <Link className="text-accent text-xs font-medium" href="/requests">
              ← Requests
            </Link>
            <p className="text-muted text-xs">{request.id}</p>
            <h1 className="text-3xl font-bold tracking-tight break-words">
              {request.projectName ?? request.purpose}
            </h1>
            <p className="text-muted text-sm">
              {request.startDate} – {request.endDate} ·{" "}
              {request.projectAddress ?? request.destination}
            </p>
          </div>
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
        </header>
        <Card
          className="border-border gap-5 border p-4 sm:p-6"
          aria-label="Current request step"
        >
          <Card.Header className="gap-2">
            <p className="text-accent text-xs font-medium">Booking status</p>
            <h2 className="text-2xl font-semibold">{journey.label}</h2>
            <p className="text-muted text-sm">{journey.description}</p>
          </Card.Header>
          <Card.Content>
            <JourneyTimeline steps={journey.steps} />
          </Card.Content>
          <Card.Footer className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <span className="text-muted text-xs">
              Return by {request.returnDate ?? request.endDate} ·{" "}
              {request.returnTime ?? "23:59"}
            </span>
            {request.status === "Needs update" ? (
              <Link
                className="text-accent text-sm font-medium"
                href={`/request/new?revise=${request.id}`}
              >
                Revise request →
              </Link>
            ) : reviewActive &&
              canManageReview &&
              request.status === "Pending approval" ? (
              <Button
                variant="secondary"
                onPress={() => setActionPanel(actionOpen ? null : "review")}
              >
                {actionOpen ? "Close approval actions" : "Manage approval"}
              </Button>
            ) : outboundActive ? (
              <Button
                variant="secondary"
                onPress={() => setActionPanel(actionOpen ? null : "delivery")}
              >
                {actionOpen ? "Close delivery actions" : "Manage delivery"}
              </Button>
            ) : journey.tasks.length ? (
              <Link
                className="text-accent text-sm font-medium"
                href={`/requests/${request.id}/return`}
              >
                {journey.complete ? "View return records" : "Process return"} →
              </Link>
            ) : null}
          </Card.Footer>
        </Card>
        {request.approvalComment ? (
          <Card className="gap-2 p-4">
            <p className="text-sm font-medium">Reviewer feedback</p>
            <p className="text-muted text-sm">{request.approvalComment}</p>
          </Card>
        ) : null}
        {actionOpen && reviewActive ? (
          <RequestReviewSection request={request} compact />
        ) : null}
        {actionOpen && outboundActive ? (
          <RequestOutboundSection request={request} />
        ) : null}
        <Card className="border-border gap-4 border p-4 sm:p-5">
          <p className="text-muted text-xs font-medium">Requested assets</p>
          <h2 className="text-lg font-semibold">
            {request.items.length
              ? `${request.items.length} ${request.items.length === 1 ? "asset" : "assets"} in this request`
              : request.boothType === "Custom Booth"
                ? "Custom Booth · no existing Asset required"
                : "No physical assets selected"}
          </h2>
          <div className="request-record__items grid gap-3 sm:grid-cols-2">
            {request.items.map((item) => {
              const asset = assets.find(
                (candidate) => candidate.id === item.assetId,
              );
              return asset ? (
                <article
                  className="border-border flex min-w-0 items-start gap-3 rounded-xl border p-3"
                  key={item.id}
                >
                  <div className="w-14 shrink-0 overflow-hidden rounded-lg">
                    <AssetArtwork
                      asset={asset}
                      variant="tile"
                      aspectRatio="1:1"
                      showLabels={false}
                    />
                  </div>
                  <div className="grid min-w-0 flex-1 gap-1 text-xs">
                    <Link
                      className="text-accent line-clamp-2 text-sm font-semibold"
                      title={asset.name}
                      href={`/assets/${asset.id}`}
                    >
                      {asset.name}
                    </Link>
                    <span>
                      {item.quantity} {item.stockUnit ?? stockUnit(asset)} · {asset.category} · {asset.brand}
                    </span>
                    <small className="text-muted line-clamp-2">
                      Planned return to{" "}
                      {request.returnGroups?.find((group) =>
                        group.itemIds.includes(item.id),
                      )?.to ??
                        outboundDispatches
                          .flatMap((record) => record.items)
                          .find((entry) => entry.requestItemId === item.id)
                          ?.sourceLocation ??
                        asset.location}
                    </small>
                  </div>
                </article>
              ) : null;
            })}
          </div>
        </Card>

        {journey.tasks.length ? (
          <Card
            aria-label="Request return"
            className="border-border gap-4 border p-4 sm:p-5"
          >
            <Card.Header>
              <Card.Title>Return tracking</Card.Title>
              <Card.Description>
                The return is linked to this booking automatically.
              </Card.Description>
            </Card.Header>
            <Card.Content className="grid gap-3">
              {journey.tasks.map((task) => {
                const receipt = returnReceipts.find(
                  (receipt) => receipt.requestItemId === task.requestItemId,
                );
                const asset = assets.find((asset) => asset.id === task.assetId);
                return (
                  <div
                    key={task.id}
                    className="border-border flex flex-wrap items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium">
                        {asset?.name ?? task.assetId}
                      </p>
                      <p className="text-muted mt-1 text-xs">
                        Return by {task.dueAt.replace("T", " · ")} ·{" "}
                        {task.destination ?? "Destination confirmed on receipt"}
                      </p>
                      {task.historical ? (
                        <p className="text-muted mt-1 text-xs">
                          Receipt evidence unavailable · physical return not
                          confirmed
                        </p>
                      ) : null}
                      {receipt?.receivedAt ? (
                        <p className="text-muted mt-1 text-xs">
                          Actual inbound ·{" "}
                          {new Date(receipt.receivedAt).toLocaleString("en-GB")}{" "}
                          · {receipt.conditionAtReceipt}
                        </p>
                      ) : null}
                    </div>
                    <Chip
                      size="sm"
                      variant="soft"
                      color={
                        task.state === "Completed"
                          ? "success"
                          : ["Overdue", "On hold"].includes(task.state)
                            ? "danger"
                            : "accent"
                      }
                    >
                      {task.state}
                    </Chip>
                  </div>
                );
              })}
            </Card.Content>
            <Card.Footer>
              <Link
                className="text-accent text-sm font-medium"
                href={`/requests/${request.id}/return`}
              >
                {journey.complete ? "View return records" : "Process return"} →
              </Link>
            </Card.Footer>
          </Card>
        ) : null}
        <section
          className="grid gap-3"
          aria-label="Additional request information"
        >
          <h2 className="text-muted text-sm font-semibold">
            Additional information
          </h2>
          <RequestDetails
            key="Project details and documents"
            title="Project details and documents"
          >
            <Card className="request-record__overview">
              <div>
                <p>Project address</p>
                <h2>{request.projectAddress ?? request.destination}</h2>
                <span>
                  <MapPin size={15} />{" "}
                  {request.destinationType ?? "Event venue"}
                </span>
              </div>
              <Chip color="accent" variant="soft">
                {request.campaign ?? request.eventMode ?? "Activation"}
              </Chip>
            </Card>
            <Card className="request-record__panel">
              <p>Project information</p>
              <h2>
                {request.projectName ??
                  request.activityName ??
                  requestEvent?.name ??
                  request.purpose}
              </h2>
              <dl className="request-event-detail">
                <div>
                  <dt>Usage type</dt>
                  <dd>
                    {request.usageType ?? request.eventMode ?? "Legacy request"}
                  </dd>
                </div>
                <div>
                  <dt>Brand</dt>
                  <dd>{request.brand ?? requestEvent?.brand ?? "—"}</dd>
                </div>
                <div>
                  <dt>Booth requirement</dt>
                  <dd>{request.boothType ?? "No booth specified"}</dd>
                </div>
                {requestEvent ? (
                  <>
                    <div>
                      <dt>Parent event</dt>
                      <dd>
                        {getParentEvent(events, requestEvent)?.name ??
                          "Standalone event"}
                      </dd>
                    </div>
                    <div>
                      <dt>Event dates</dt>
                      <dd>
                        {requestEvent.startDate} to {requestEvent.endDate}
                      </dd>
                    </div>
                  </>
                ) : null}
                {request.adHocPurpose ? (
                  <div>
                    <dt>Purpose / place type</dt>
                    <dd>
                      {request.adHocPurpose} · {request.adHocLocationType}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>Requesting PIC</dt>
                  <dd>{request.contact}</dd>
                </div>
                <div>
                  <dt>Project-site PIC</dt>
                  <dd>{request.siteContact ?? "Not provided"}</dd>
                </div>
                <div>
                  <dt>Space dimensions</dt>
                  <dd>{dimensions}</dd>
                </div>
                {request.projectDetails ? (
                  <div>
                    <dt>Other event details</dt>
                    <dd>{request.projectDetails}</dd>
                  </div>
                ) : null}
              </dl>
            </Card>
            {request.supportingDocuments?.length ? (
              <Card className="request-record__panel">
                <p>Supporting documents</p>
                <h2>Venue and loading documents</h2>
                <ul className="request-document-list">
                  {request.supportingDocuments.map((document) => (
                    <li key={document.id}>
                      <span>
                        <strong>{document.category}</strong>
                        <small>{document.name}</small>
                      </span>
                      {document.dataUrl ? (
                        <a
                          href={document.dataUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Open file
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <small>
                  Prototype documents are held in this browser session only.
                </small>
              </Card>
            ) : null}
          </RequestDetails>
          <RequestDetails key="Schedule and routes" title="Schedule and routes">
            <Card className="request-record__panel">
              <p>Fulfillment</p>
              <h2>Loading plan</h2>
              <dl className="request-event-detail">
                <div>
                  <dt>Loading in</dt>
                  <dd>
                    {request.pickupDate ?? "—"} · {request.pickupTime ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt>Loading out</dt>
                  <dd>
                    {request.returnDate ?? "—"} · {request.returnTime ?? "—"}
                  </dd>
                </div>
              </dl>
              {request.fulfillmentGroups?.length ? (
                request.fulfillmentGroups.map((group) => (
                  <div className="request-record__route" key={group.id}>
                    <strong>{group.method}</strong>
                    <span>
                      {group.source} to {group.destination}
                    </span>
                    <small>{group.window}</small>
                  </div>
                ))
              ) : (
                <span>To be scheduled after approval.</span>
              )}
            </Card>
            <Card className="request-record__panel request-reservation-panel">
              <p>Operational reservation</p>
              <h2>Outbound · usage · inbound</h2>
              <dl className="request-event-detail">
                <div>
                  <dt>Usage</dt>
                  <dd>
                    {request.startDate} – {request.endDate}
                  </dd>
                </div>
                <div>
                  <dt>Planned outbound</dt>
                  <dd>
                    {request.pickupDate ?? request.startDate} ·{" "}
                    {request.pickupTime ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt>Planned inbound</dt>
                  <dd>
                    {request.returnDate ?? request.endDate} ·{" "}
                    {request.returnTime ?? "—"}
                  </dd>
                </div>
              </dl>
              {requestReservations.length ? (
                <ul className="request-reservation-panel__items">
                  {requestReservations.map((reservation) => (
                    <li key={reservation.id}>
                      <Link href={`/assets/${reservation.assetId}`}>
                        {reservation.assetName}
                      </Link>
                      <span>
                        {reservation.activityName} · {reservation.assetBrand}
                      </span>
                      <small>
                        Planned outbound{" "}
                        {getReservationPhaseState(
                          reservation,
                          "Outbound",
                          localNow,
                        )}{" "}
                        · Planned usage{" "}
                        {getReservationPhaseState(
                          reservation,
                          "Event usage",
                          localNow,
                        )}{" "}
                        · Planned inbound{" "}
                        {getReservationPhaseState(
                          reservation,
                          "Inbound",
                          localNow,
                        )}
                      </small>
                      {reservation.actualOutboundAt ? (
                        <small>
                          Actual outbound ·{" "}
                          {new Date(
                            reservation.actualOutboundAt,
                          ).toLocaleString("en-GB", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </small>
                      ) : null}
                      {reservation.destinationReceivedAt ? (
                        <small>
                          Received at usage destination ·{" "}
                          {new Date(
                            reservation.destinationReceivedAt,
                          ).toLocaleString("en-GB", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </small>
                      ) : null}
                      {reservation.actualInboundAt ? (
                        <small>
                          Actual inbound ·{" "}
                          {new Date(reservation.actualInboundAt).toLocaleString(
                            "en-GB",
                            { dateStyle: "medium", timeStyle: "short" },
                          )}
                        </small>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Custom Booth has no physical Asset reservation.</p>
              )}
              <small>
                Planned dates are not physical receipt. Actual inbound is shown
                only after Confirm Received; Request status alone never creates
                it.
              </small>
            </Card>
          </RequestDetails>
          <RequestDetails
            key="Budget and references"
            title="Budget and references"
          >
            <FinancialReferencesSection
              ownerType="REQUEST"
              ownerId={request.id}
              budgetCode={request.budgetCode}
              wbsCodes={requestWbsReferences.map((reference) => reference.code)}
            />
          </RequestDetails>
          {!reviewActive || !actionOpen ? (
            <RequestDetails key="Review history" title="Review history">
              <RequestReviewSection request={request} />
            </RequestDetails>
          ) : null}
          {!outboundActive && dispatches.length ? (
            <RequestDetails key="Handover history" title="Handover history">
              <RequestOutboundSection request={request} />
            </RequestDetails>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

function RequestDetails({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <WorkflowDisclosure
      title={title}
      variant="ghost"
      className="border-border bg-surface rounded-xl border p-3"
    >
      {children}
    </WorkflowDisclosure>
  );
}
