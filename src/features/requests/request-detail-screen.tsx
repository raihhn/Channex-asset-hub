"use client";

import Link from "next/link";
import { MapPin, Undo2 } from "lucide-react";
import { Card, Chip } from "@heroui/react";

import { AssetArtwork } from "@/components/domain/asset-artwork";
import { RequestStatus } from "@/components/domain/request-status";
import { AppShell } from "@/components/shared/app-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { usePrototype } from "@/features/prototype/prototype-provider";
import { getParentEvent } from "@/lib/domain/events";
import {
  deriveReservations,
  getReservationPhaseState,
} from "@/lib/domain/reservations";
import { findReturnReceipt, getReturnProgress } from "@/lib/domain/returns";
import { RequestReviewSection } from "@/features/requests/request-review-section";
import { FinancialReferencesSection } from "@/components/domain/financial-references-section";

export function RequestDetailScreen({ requestId }: { requestId: string }) {
  const { requests, wbsReferences, events, assets, returnReceipts, maintenanceRecords, bookingLoading, bookingError } =
    usePrototype();
  if (bookingLoading) return <AppShell pageLabel="Request detail"><p className="p-6" role="status">Loading saved request…</p></AppShell>;
  if (bookingError) return <AppShell pageLabel="Request detail"><p className="p-6" role="alert">Could not load saved request: {bookingError}</p></AppShell>;
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
    ? deriveReservations([request], assets, events, returnReceipts)
    : [];
  const now = new Date();
  const localNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

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

  return (
    <AppShell pageLabel="Request detail">
      <div className="request-detail-screen request-record">
        <header className="request-record__header">
          <div>
            <Link href="/requests">← Requests</Link>
            <p>{request.id}</p>
            <h1>{request.projectName ?? request.purpose}</h1>
            <span>
              Borrowing period · {request.startDate} to {request.endDate}
            </span>
          </div>
          <RequestStatus status={request.status} />
        </header>
        <RequestReviewSection request={request} />
        <div className="request-record__grid">
          <section>
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
            <Card className="request-record__panel">
              <p>Requested assets</p>
              <h2>
                {request.items.length
                  ? `${request.items.length} assets in this request`
                  : request.boothType === "Custom Booth"
                    ? "Custom Booth · no existing Asset required"
                    : "No physical assets selected"}
              </h2>
              <div className="request-record__items">
                {request.items.map((item) => {
                  const asset = assets.find(
                    (candidate) => candidate.id === item.assetId,
                  );
                  return asset ? (
                    <article key={asset.id}>
                      <AssetArtwork asset={asset} variant="tile" />
                      <div>
                        <strong>{asset.name}</strong>
                        <span>
                          {item.quantity} x {asset.category} · {asset.brand}
                        </span>
                        <small>Return to {asset.location}</small>
                        <Link href={`/assets/${asset.id}`}>View asset</Link>
                      </div>
                    </article>
                  ) : null;
                })}
              </div>
            </Card>
            <FinancialReferencesSection ownerType="REQUEST" ownerId={request.id} budgetCode={request.budgetCode} wbsCodes={requestWbsReferences.map((reference) => reference.code)} />
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
          </section>
          <aside>
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
            <Card className="request-record__panel">
              <p>Returns</p>
              <h2>Item return status</h2>
              {request.items.length ? (
                <ul className="request-reservation-panel__items">
                  {request.items.map((item) => {
                    const asset = assets.find(
                      (candidate) => candidate.id === item.assetId,
                    );
                    const receipt = findReturnReceipt(returnReceipts, item.id);
                    return (
                      <li key={item.id}>
                        <strong>{asset?.name ?? item.assetId}</strong>
                        {maintenanceRecords.filter((record) => record.sourceRequestItemId === item.id).map((record) => <small key={record.id}>Maintenance: <Link href={`/maintenance/${record.id}`}>{record.status} · {record.id}</Link></small>)}
                        <span>
                          {getReturnProgress(
                            receipt,
                            request.returnDate
                              ? `${request.returnDate}T${request.returnTime ?? "23:59"}`
                              : `${request.endDate}T23:59`,
                            localNow,
                          )}
                        </span>
                        <small>
                          Expected · {request.returnDate ?? request.endDate} ·{" "}
                          {request.returnTime ?? "23:59"}
                        </small>
                        {receipt?.receivedAt ? (
                          <small>
                            Received ·{" "}
                            {new Date(receipt.receivedAt).toLocaleString(
                              "en-GB",
                              { dateStyle: "medium", timeStyle: "short" },
                            )}{" "}
                            · Condition: {receipt.conditionAtReceipt}
                          </small>
                        ) : (
                          <small>
                            {request.status === "Completed"
                              ? "Receipt evidence unavailable · physical return not confirmed"
                              : "No actual inbound recorded"}
                          </small>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {request.items.length ? (
                <Link
                  className="return-workflow-link"
                  href={`/requests/${request.id}/return`}
                >
                  Open return workflow →
                </Link>
              ) : null}
              <h2>Where assets return</h2>
              {request.returnGroups?.length ? (
                request.returnGroups.map((group) => (
                  <div className="request-record__route" key={group.id}>
                    <strong>
                      <Undo2 size={14} /> {group.to}
                    </strong>
                    <span>{group.itemIds.length} asset(s)</span>
                    <small>{group.window}</small>
                  </div>
                ))
              ) : (
                <span>
                  Return instructions will be assigned after approval.
                </span>
              )}
            </Card>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
